"""
Visualization utilities for spedition_mlp.ipynb.

All functions accept tidy DataFrames / arrays and call plt.show()
internally so notebook cells stay concise.
"""

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import seaborn as sns
from IPython.display import display


# ── Time-series helpers ───────────────────────────────────────────────────────

def plot_price_timeseries(
    df_hourly: pd.DataFrame,
    fuel_type: str = "diesel",
) -> None:
    """
    Multi-year price time series (one line per station) plus correlation heatmap.

    Parameters
    ----------
    df_hourly : hourly DataFrame with columns "{fuel_type}_Route_{X}"
    fuel_type : fuel type prefix used in column names
    """
    price_cols = [c for c in df_hourly.columns if c.startswith(f"{fuel_type}_")]
    labels = [c.replace(f"{fuel_type}_Route_", "") for c in price_cols]

    fig, ax = plt.subplots(figsize=(14, 4))
    for col, label in zip(price_cols, labels):
        ax.plot(df_hourly.index, df_hourly[col], lw=0.5, label=label)
    ax.set_title("Diesel-Preise an 5 Speditionsstationen")
    ax.set_ylabel("€/L")
    ax.legend(loc="upper left", fontsize=8)
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
    plt.tight_layout()
    plt.show()

    fig, ax = plt.subplots(figsize=(6, 5))
    corr_labels = [c.replace(f"{fuel_type}_Route_", "") for c in price_cols]
    sns.heatmap(
        df_hourly[price_cols].corr(),
        annot=True, fmt=".2f", cmap="coolwarm",
        xticklabels=corr_labels, yticklabels=corr_labels, ax=ax,
    )
    ax.set_title("Korrelationsmatrix: Dieselpreise")
    plt.tight_layout()
    plt.show()


def plot_intraday_by_region(
    df_hourly: pd.DataFrame,
    fuel_type: str = "diesel",
) -> None:
    """
    Mean price by hour-of-day, one line per region.

    Shows whether any route is systematically cheaper at specific hours —
    actionable intelligence for the dispatcher.
    """
    price_cols = [c for c in df_hourly.columns if c.startswith(f"{fuel_type}_")]
    labels = [c.replace(f"{fuel_type}_Route_", "") for c in price_cols]

    df = df_hourly[price_cols].copy()
    df["hour"] = df.index.hour
    mean_by_hour = df.groupby("hour")[price_cols].mean()

    fig, ax = plt.subplots(figsize=(11, 4))
    for col, label in zip(price_cols, labels):
        ax.plot(mean_by_hour.index, mean_by_hour[col], marker="o", ms=3, label=label)

    ax.set_title("Intraday-Profil: Mittlerer Dieselpreis je Stunde und Region")
    ax.set_xlabel("Stunde des Tages (0 = Mitternacht, 12 = Mittag)")
    ax.set_ylabel("Mittlerer Preis €/L")
    ax.set_xticks(range(0, 24))
    ax.legend(fontsize=8)
    plt.tight_layout()
    plt.show()


# ── Feature display ───────────────────────────────────────────────────────────

def plot_feature_list(X: pd.DataFrame) -> None:
    """
    Display all input features grouped by type in a readable table.

    Groups: Lag, Rolling, Trend/Momentum, Preis_t, Temporal.
    """
    groups = {
        "Lag":           [c for c in X.columns if "_lag_"     in c],
        "Rolling Mean":  [c for c in X.columns if "_roll_mean" in c],
        "Rolling Std":   [c for c in X.columns if "_roll_std"  in c],
        "Trend/Momentum":[c for c in X.columns if "_trend"    in c or "_momentum" in c or "_diff" in c],
        "Preis_t":       [c for c in X.columns if "_price_t"  in c],
        "Temporal":      [c for c in X.columns
                          if c in ("hour_sin", "hour_cos", "dow_sin", "dow_cos",
                                   "hour", "day_of_week", "is_weekend", "is_holiday")],
    }

    rows = []
    for group, cols in groups.items():
        for col in cols:
            rows.append({"Gruppe": group, "Feature": col})

    print(f"Gesamt: {len(X.columns)} Input-Features\n")
    df_feat = pd.DataFrame(rows)
    display(df_feat.style.hide(axis="index"))


# ── Evaluation plots ──────────────────────────────────────────────────────────

def plot_eval_mae_rmse(
    steps: list[int],
    mae_per_step: dict,
    rmse_per_step: dict,
    baseline_mae: float | None = None,
    baseline_rmse: float | None = None,
) -> None:
    """
    Three evaluation figures:
      1. MAE per forecast horizon only
      2. RMSE per forecast horizon only
      3. MAE + RMSE combined in one diagram

    Parameters
    ----------
    steps         : list of horizon indices (e.g. list(range(1, 73)))
    mae_per_step  : dict mapping step → MAE value
    rmse_per_step : dict mapping step → RMSE value
    baseline_mae  : optional horizontal reference line for MAE
    baseline_rmse : optional horizontal reference line for RMSE
    """
    mae_vals  = [mae_per_step[s]  for s in steps]
    rmse_vals = [rmse_per_step[s] for s in steps]

    # Figure 1 — MAE only
    fig, ax = plt.subplots(figsize=(10, 3))
    ax.plot(steps, mae_vals, color="steelblue", label="MLP MAE")
    if baseline_mae is not None:
        ax.axhline(baseline_mae, ls="--", color="gray", label=f"Baseline {baseline_mae:.4f}")
    ax.set_title("MAE pro Forecast-Horizont")
    ax.set_xlabel("Horizont h")
    ax.set_ylabel("MAE €/L")
    ax.legend()
    plt.tight_layout()
    plt.show()

    # Figure 2 — RMSE only
    fig, ax = plt.subplots(figsize=(10, 3))
    ax.plot(steps, rmse_vals, color="tomato", label="MLP RMSE")
    if baseline_rmse is not None:
        ax.axhline(baseline_rmse, ls="--", color="gray", label=f"Baseline {baseline_rmse:.4f}")
    ax.set_title("RMSE pro Forecast-Horizont")
    ax.set_xlabel("Horizont h")
    ax.set_ylabel("RMSE €/L")
    ax.legend()
    plt.tight_layout()
    plt.show()

    # Figure 3 — both combined
    fig, ax = plt.subplots(figsize=(10, 3))
    ax.plot(steps, mae_vals,  color="steelblue", label="MAE")
    ax.plot(steps, rmse_vals, color="tomato",    label="RMSE")
    if baseline_mae is not None:
        ax.axhline(baseline_mae,  ls="--", color="steelblue", alpha=0.4, label="Baseline MAE")
    if baseline_rmse is not None:
        ax.axhline(baseline_rmse, ls="--", color="tomato",    alpha=0.4, label="Baseline RMSE")
    ax.set_title("MAE & RMSE kombiniert — pro Forecast-Horizont")
    ax.set_xlabel("Horizont h")
    ax.set_ylabel("Fehler €/L")
    ax.legend()
    plt.tight_layout()
    plt.show()


def plot_actual_vs_predicted_14d(
    y_test: pd.DataFrame,
    y_true: np.ndarray,
    y_pred: np.ndarray,
    horizon_h: int = 1,
    n_days: int = 14,
) -> None:
    """
    14-day window of Actual vs. Predicted for each station at a given forecast horizon.

    Parameters
    ----------
    y_test    : test-set target DataFrame (provides timestamp index and column names)
    y_true    : unscaled true values as numpy array (shape: T × n_targets)
    y_pred    : unscaled predictions as numpy array (shape: T × n_targets)
    horizon_h : forecast horizon to plot (e.g. 1, 24, 48, 72)
    n_days    : length of the shown window in days
    """
    sample_end = y_test.index[0] + pd.Timedelta(days=n_days)
    mask = (y_test.index >= y_test.index[0]) & (y_test.index < sample_end)

    horizon_cols = [c for c in y_test.columns if f"t+{horizon_h}h" in c]
    station_labels = [
        c.replace("diesel_Route_", "").replace(f"_t+{horizon_h}h", "")
        for c in horizon_cols
    ]
    col_indices = [list(y_test.columns).index(c) for c in horizon_cols]

    fig, axes = plt.subplots(
        len(horizon_cols), 1,
        figsize=(14, 3 * len(horizon_cols)),
        sharex=True,
    )
    if len(horizon_cols) == 1:
        axes = [axes]

    for ax, label, ci in zip(axes, station_labels, col_indices):
        ax.plot(y_test.index[mask], y_true[mask, ci], label="Actual",    lw=1)
        ax.plot(y_test.index[mask], y_pred[mask, ci], label="Predicted", lw=1, ls="--", color="tomato")
        ax.set_title(f"Route {label} — t+{horizon_h}h")
        ax.set_ylabel("€/L")
        ax.legend(fontsize=7)

    plt.suptitle(f"14-Tage Actual vs. Predicted (Horizont t+{horizon_h}h)", y=1.01)
    plt.tight_layout()
    plt.show()


def plot_cv_folds(
    fold_records: list[dict],
    cv_maes: list[float],
    cv_rmses: list[float],
    cv_r2s: list[float],
    y_train_full: pd.DataFrame,
    rep_col: str,
) -> None:
    """
    Print a formatted CV metrics table and draw an overlay plot of all fold predictions.

    Parameters
    ----------
    fold_records  : list of dicts with keys "idx" (DatetimeIndex), "truth" (1-D array),
                    "pred" (1-D array), "n_iter" (int) — one entry per fold.
                    truth/pred must already be inverse-transformed (€/L).
    cv_maes       : MAE per fold (€/L)
    cv_rmses      : RMSE per fold (€/L)
    cv_r2s        : R² per fold
    y_train_full  : full training target DataFrame (index = DatetimeIndex)
    rep_col       : column name used for the time-series overlay (e.g. "diesel_Route_N_t+1h")
    """
    FOLD_COLORS = ["#e41a1c", "#377eb8", "#4daf4a", "#984ea3", "#ff7f00"]
    mean_mae,  mean_rmse,  mean_r2  = np.mean(cv_maes),  np.mean(cv_rmses),  np.mean(cv_r2s)
    std_mae,   std_rmse,   std_r2   = np.std(cv_maes),   np.std(cv_rmses),   np.std(cv_r2s)

    # ── Metrics table ──────────────────────────────────────────────────────
    W = 74
    print("─" * W)
    print(f"  {'Fold':^6}  │  {'MAE  ct/L':^12}  │  {'RMSE ct/L':^12}  │  {'R²':^8}  │  Δ MAE   │  Iter")
    print("─" * W)
    for i, (mae, rmse, r2, rec) in enumerate(zip(cv_maes, cv_rmses, cv_r2s, fold_records)):
        delta     = mae - mean_mae
        delta_str = f"{delta * 100:+.2f}"
        arrow     = "▲" if delta > 0 else "▼"
        bar       = "█" * min(int(abs(delta) * 2000), 8)
        print(
            f"  Fold {i+1}  │  {mae*100:>8.3f} ct  │  {rmse*100:>8.3f} ct  │"
            f"  {r2:>8.4f}  │ {delta_str:>6} {arrow}{bar}  │  {rec['n_iter']}"
        )
    print("─" * W)
    print(f"  {'Ø':^6}  │  {mean_mae*100:>8.3f} ct  │  {mean_rmse*100:>8.3f} ct  │  {mean_r2:>8.4f}  │")
    print(f"  {'±':^6}  │  {std_mae*100:>8.3f} ct  │  {std_rmse*100:>8.3f} ct  │  {std_r2:>8.4f}  │")
    print("─" * W)
    print(f"\n  MAE  = Modell liegt im Schnitt ±{mean_mae*100:.2f} Cent/L daneben")
    print(f"  RMSE = Ausreißer-gewichtet:      ±{mean_rmse*100:.2f} Cent/L")
    print(f"  R²   = Erklärt {mean_r2*100:.1f} % der Preisvarianz  (0 = raten, 1 = perfekt)")
    print(f"  ▲/▼  = Fold liegt über/unter dem CV-Durchschnitt (Δ in ct/L)")

    # ── Overlay plot ───────────────────────────────────────────────────────
    fig, (ax_main, ax_bar) = plt.subplots(
        2, 1, figsize=(14, 8),
        gridspec_kw={"height_ratios": [3, 1], "hspace": 0.38},
    )

    ax_main.plot(
        y_train_full.index, y_train_full[rep_col],
        color="silver", lw=0.8, zorder=1, label="Actual (Trainingszeitraum)",
    )

    for i, rec in enumerate(fold_records):
        color = FOLD_COLORS[i]
        ax_main.axvspan(rec["idx"][0], rec["idx"][-1], alpha=0.08, color=color, zorder=2)
        ax_main.plot(
            rec["idx"], rec["pred"],
            color=color, lw=1.4, zorder=3,
            label=f"Fold {i+1} Predicted — MAE {cv_maes[i]*100:.2f} ct/L",
        )
        ax_main.plot(
            rec["idx"], rec["truth"],
            color=color, lw=0.6, ls="--", alpha=0.55, zorder=3,
        )

    ax_main.set_title(
        f"CV Fold-Vorhersagen vs. Actual — {rep_col}\n"
        "(durchgezogen = Predicted · gestrichelt = Actual im Fold-Fenster)",
        fontsize=11,
    )
    ax_main.set_ylabel("Diesel €/L")
    ax_main.legend(loc="upper left", fontsize=8, ncol=2)
    ax_main.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
    ax_main.xaxis.set_major_locator(mdates.YearLocator())

    bars = ax_bar.bar(
        range(1, len(cv_maes) + 1), [m * 100 for m in cv_maes],
        color=FOLD_COLORS[: len(cv_maes)], alpha=0.85, width=0.55,
    )
    ax_bar.axhline(mean_mae * 100, ls="--", color="black", lw=1.2,
                   label=f"Ø {mean_mae*100:.2f} ct/L")
    ax_bar.set_xticks(range(1, len(cv_maes) + 1))
    ax_bar.set_xticklabels([f"Fold {i}" for i in range(1, len(cv_maes) + 1)])
    ax_bar.set_ylabel("MAE (ct/L)")
    ax_bar.set_title("MAE je Fold")
    ax_bar.legend(fontsize=9)
    for bar, mae in zip(bars, cv_maes):
        ax_bar.text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height() + 0.03,
            f"{mae*100:.2f}",
            ha="center", va="bottom", fontsize=9,
        )

    plt.tight_layout()
    plt.show()


def plot_model_comparison(results_df: pd.DataFrame) -> None:
    """
    Bar chart comparing Val MAE and Val RMSE across different hidden_layer_sizes.

    Parameters
    ----------
    results_df : DataFrame returned by run_architecture_comparison()
                 (columns: architecture, val_mae, val_rmse, val_r2, n_params, n_iter)
    """
    x = range(len(results_df))
    labels = results_df["architecture"].tolist()

    fig, axes = plt.subplots(1, 2, figsize=(12, 4))

    bars0 = axes[0].bar(x, results_df["val_mae"], color="steelblue")
    axes[0].bar_label(bars0, fmt="%.4f", fontsize=8)
    axes[0].set_xticks(x)
    axes[0].set_xticklabels(labels, rotation=20, ha="right")
    axes[0].set_title("Val MAE je Architektur")
    axes[0].set_ylabel("MAE €/L")

    bars1 = axes[1].bar(x, results_df["val_rmse"], color="tomato")
    axes[1].bar_label(bars1, fmt="%.4f", fontsize=8)
    axes[1].set_xticks(x)
    axes[1].set_xticklabels(labels, rotation=20, ha="right")
    axes[1].set_title("Val RMSE je Architektur")
    axes[1].set_ylabel("RMSE €/L")

    plt.tight_layout()
    plt.show()

    print("\nArchitektur-Vergleich (vollständig):")
    display(
        results_df
        .set_index("architecture")
        .style.format({
            "val_mae":  "{:.5f}",
            "val_rmse": "{:.5f}",
            "val_r2":   "{:.5f}",
            "n_params": "{:,.0f}",
        })
        .highlight_min(subset=["val_mae", "val_rmse"], color="lightgreen")
        .highlight_max(subset=["val_r2"],              color="lightgreen")
    )
