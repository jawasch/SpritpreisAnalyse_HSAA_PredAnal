"""
Build a small, all-years REGIONAL price history for the interactive map.

  • Regions = first two PLZ digits (~95 German postal regions) — every region of
    the country is represented; all stations are aggregated (averaged) into theirs.
  • Time = one representative day per ISO week (≈ 4–5 days/month) over the full
    history → ~620 frames. Only those daily CSVs are read, so the 116 GB tree is
    barely touched and the build runs in a few minutes.
  • Per (week, region, fuel): the mean of that day's posted prices across the
    region's stations.

Output:
  data/processed/region_history.parquet   columns: date, plz2, diesel, e5, e10
  data/processed/region_meta.parquet       columns: plz2, lat, lng, label, n_stations

Run:  python scripts/build_region_history.py [--every 7]
"""
import argparse
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from scripts.data_transform import load_config  # noqa: E402

FUELS = ["diesel", "e5", "e10"]


def plz2_of(pc) -> str | None:
    s = str(pc).strip()
    if len(s) < 2 or not s[:2].isdigit():
        return None
    return s[:2]


def weekly_files(prices_root: Path) -> list[tuple[pd.Timestamp, Path]]:
    """One CSV per ISO week (the first available day of each week)."""
    all_files = sorted(prices_root.rglob("*-prices.csv"))
    seen, out = set(), []
    for f in all_files:
        try:
            d = pd.Timestamp(f.stem.replace("-prices", ""))
        except Exception:
            continue
        key = (d.isocalendar().year, d.isocalendar().week)
        if key in seen:
            continue
        seen.add(key)
        out.append((d, f))
    return out


def read_day(date: pd.Timestamp, path: Path, uuid2plz: dict) -> pd.DataFrame | None:
    try:
        df = pd.read_csv(path, usecols=["station_uuid", *FUELS],
                         dtype={"station_uuid": str, **{f: "float32" for f in FUELS}})
    except Exception:
        return None
    df["plz2"] = df["station_uuid"].map(uuid2plz)
    df = df.dropna(subset=["plz2"])
    for f in FUELS:
        df.loc[~(df[f] > 0.5), f] = np.nan
    agg = df.groupby("plz2")[FUELS].mean().reset_index()
    agg["date"] = date.normalize()
    return agg


def build(every: int = 7, workers: int = 8):
    cfg = load_config()
    processed = cfg["processed_dir"]
    geo = pd.read_parquet(processed / "stations_geo.parquet").copy()
    geo["plz2"] = geo["post_code"].map(plz2_of)
    geo = geo.dropna(subset=["plz2", "latitude", "longitude"])

    uuid2plz = dict(zip(geo["uuid"].astype(str), geo["plz2"]))
    print(f"Stationen: {len(geo):,} · Regionen (PLZ-2): {geo['plz2'].nunique()}")

    # Region metadata (centroid + size + a human label)
    meta = (geo.groupby("plz2")
            .agg(lat=("latitude", "mean"), lng=("longitude", "mean"),
                 n_stations=("uuid", "count"),
                 city=("city", lambda s: s.mode().iat[0] if len(s.mode()) else ""))
            .reset_index())
    meta["label"] = meta["plz2"] + " · " + meta["city"].astype(str)

    prices_root = cfg["data_path"] / "prices"
    files = weekly_files(prices_root)
    if every != 7:                            # coarser/finer sub-sampling if requested
        files = files[::max(1, round(every / 7))]
    print(f"Repräsentative Tage: {len(files)} (≈ 1 pro Woche, {files[0][0].date()} → {files[-1][0].date()})")

    chunks, done = [], 0
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(read_day, d, p, uuid2plz): d for d, p in files}
        for fut in as_completed(futs):
            r = fut.result(); done += 1
            if done % 50 == 0:
                print(f"  … {done}/{len(files)} Tage gelesen")
            if r is not None:
                chunks.append(r)

    hist = pd.concat(chunks, ignore_index=True).sort_values(["plz2", "date"]).reset_index(drop=True)

    out_h = processed / "region_history.parquet"
    out_m = processed / "region_meta.parquet"
    hist.to_parquet(out_h)
    meta[["plz2", "lat", "lng", "label", "n_stations"]].to_parquet(out_m)

    print(f"\n✓ {out_h.name}: {len(hist):,} Zeilen · {hist['plz2'].nunique()} Regionen · "
          f"{hist['date'].min().date()} → {hist['date'].max().date()}")
    for f in FUELS:
        print(f"    {f}: {int(hist[f].notna().sum()):,} Werte")
    print(f"✓ {out_m.name}: {len(meta)} Regionen")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--every", type=int, default=7,
                    help="approx days between sampled days (7 = one per ISO week)")
    ap.add_argument("--workers", type=int, default=8)
    args = ap.parse_args()
    build(every=args.every, workers=args.workers)


if __name__ == "__main__":
    main()
