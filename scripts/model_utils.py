"""
Model training and evaluation helpers for spedition_mlp.ipynb and b29_fleet_mlp.ipynb.

Encapsulates MLPRegressor training, metric computation (MAE, RMSE, R²)
with ELI5 explanations, and architecture comparison sweeps.
"""

import numpy as np
import pandas as pd
from sklearn.neural_network import MLPRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


# ── ELI5 metric descriptions ─────────────────────────────────────────────────

_ELI5_METRICS = {
    "MAE": (
        "MAE (Mean Absolute Error) — Wie weit daneben im Schnitt?\n"
        "  → Stell dir vor, du tippst jeden Tag den Dieselpreis. Der MAE sagt dir:\n"
        "    ‹Im Durchschnitt liegst du X Cent pro Liter daneben.›\n"
        "  → Kleiner = besser. 0,00 wäre perfekt — aber das gibt es nie in der echten Welt."
    ),
    "RMSE": (
        "RMSE (Root Mean Squared Error) — Wie schlimm sind die größten Fehler?\n"
        "  → Wie der MAE, aber große Ausreißer zählen extra stark — wie ein Lehrer,\n"
        "    der sehr falsche Antworten doppelt bewertet.\n"
        "  → RMSE > MAE bedeutet: es gibt einzelne Stunden mit besonders großem Fehler."
    ),
    "R2": (
        "R² (Bestimmtheitsmaß) — Wie viel der Preisschwankungen erklären wir?\n"
        "  → 0,0 = wir sind so gut wie pures Raten; 1,0 = wir erklären alles perfekt.\n"
        "  → Werte nahe 1 bedeuten: das Modell hat die Muster wirklich verstanden,\n"
        "    nicht nur auswendig gelernt."
    ),
}


# ── B29 metric helpers ────────────────────────────────────────────────────────

def compute_metrics_by_horizon(
    y_true: pd.DataFrame,
    y_pred: pd.DataFrame,
    base_targets: list[str],
    horizon: int,
) -> pd.DataFrame:
    """
    Compute MAE, RMSE, R² for each forecast horizon step (1 … horizon).

    Parameters
    ----------
    y_true       : ground-truth target DataFrame (columns: {cluster}_t+{h}h)
    y_pred       : predicted target DataFrame (same columns and index as y_true)
    base_targets : list of cluster/station column prefixes (without _t+{h}h suffix)
    horizon      : maximum forecast horizon in hours

    Returns
    -------
    pd.DataFrame indexed by horizon_h with columns MAE, RMSE, R2
    """
    rows = []
    for step in range(1, horizon + 1):
        cols = [f"{c}_t+{step}h" for c in base_targets]
        mae  = mean_absolute_error(y_true[cols], y_pred[cols], multioutput="uniform_average")
        rmse = np.sqrt(mean_squared_error(y_true[cols], y_pred[cols], multioutput="uniform_average"))
        r2   = r2_score(y_true[cols], y_pred[cols], multioutput="uniform_average")
        rows.append({"horizon_h": step, "MAE": mae, "RMSE": rmse, "R2": r2})
    return pd.DataFrame(rows).set_index("horizon_h")


def build_persistence_baseline(
    X_data: pd.DataFrame,
    y_data: pd.DataFrame,
    base_targets: list[str],
    horizon: int,
) -> pd.DataFrame:
    """
    Persistence baseline: last known price repeated for all forecast horizons.

    Parameters
    ----------
    X_data       : feature DataFrame containing {cluster}_price_t columns
    y_data       : target DataFrame (used only for index and columns)
    base_targets : list of cluster/station prefixes
    horizon      : maximum forecast horizon in hours

    Returns
    -------
    pd.DataFrame with same shape as y_data, filled with the last known price per cluster
    """
    pred = pd.DataFrame(index=y_data.index, columns=y_data.columns, dtype=float)
    for step in range(1, horizon + 1):
        for cluster in base_targets:
            pred[f"{cluster}_t+{step}h"] = X_data[f"{cluster}_price_t"].values
    return pred


def print_metrics_summary(name: str, metrics_df: pd.DataFrame) -> None:
    """
    Print a compact per-horizon metrics table plus the overall mean.

    Parameters
    ----------
    name       : label shown in the header (e.g. 'MLP', 'Persistence')
    metrics_df : DataFrame returned by compute_metrics_by_horizon()
    """
    print(f"\n{name} — Performance je Horizont:")
    print(metrics_df.head(6).round(5))
    print("  ...")
    print(metrics_df.tail(3).round(5))
    m = metrics_df.mean()
    print(f"\n{name} Gesamt (Ø):  MAE={m['MAE']:.5f} €/L  RMSE={m['RMSE']:.5f}  R²={m['R2']:.4f}")
# ── MLP defaults (single source of truth) ────────────────────────────────────

MLP_DEFAULTS: dict = dict(
    early_stopping=True,
    validation_fraction=0.1,
    n_iter_no_change=100,   # war 50, für große modelle als test
    tol=1e-5,               # war 1e-4, für große modelle als test
    max_iter=2000,          # war 1000, für große modelle als test
    learning_rate='adaptive',
    learning_rate_init=0.001,
    random_state=42,
)


# ── Training ─────────────────────────────────────────────────────────────────

def build_mlp(
    hidden_layer_sizes: tuple = (256, 128),
    **kwargs,
) -> MLPRegressor:
    """Return an unfitted MLPRegressor with MLP_DEFAULTS merged with kwargs."""
    return MLPRegressor(
        hidden_layer_sizes=hidden_layer_sizes,
        **{**MLP_DEFAULTS, **kwargs},
    )


def train_mlp(
    X_train_sc: np.ndarray,
    y_train_sc: np.ndarray,
    hidden_layer_sizes: tuple = (256, 128),
    **kwargs,
) -> MLPRegressor:
    """
    Build and fit an MLPRegressor.

    Override any MLP_DEFAULTS parameter via kwargs (e.g. max_iter=300).
    """
    model = build_mlp(hidden_layer_sizes=hidden_layer_sizes, **kwargs)
    model.fit(X_train_sc, y_train_sc)
    return model


# ── Evaluation ───────────────────────────────────────────────────────────────

def evaluate_model(
    model: MLPRegressor,
    X_sc: np.ndarray,
    y_true: np.ndarray,
    scaler_y,
    label: str = "Set",
) -> dict:
    """
    Compute MAE, RMSE, R² and print each with an ELI5 description.

    Parameters
    ----------
    model    : fitted MLPRegressor
    X_sc     : scaled feature matrix (numpy array)
    y_true   : unscaled ground-truth targets (numpy array)
    scaler_y : fitted StandardScaler used to inverse-transform predictions
    label    : display label shown in the header (e.g. 'Validation', 'Test')

    Returns
    -------
    dict with keys: mae, rmse, r2, y_pred (unscaled predictions)
    """
    y_pred = scaler_y.inverse_transform(model.predict(X_sc))
    mae  = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    r2   = r2_score(y_true, y_pred)

    print(f"\n{'═' * 58}")
    print(f"  Bewertungsmetriken — {label}")
    print(f"{'═' * 58}")
    print(f"  MAE  : {mae:.5f} €/L")
    print(f"  RMSE : {rmse:.5f} €/L")
    print(f"  R²   : {r2:.5f}")
    print()
    # for name, eli5 in _ELI5_METRICS.items():
    #     print(f"  [{name}]")
    #     print(f"  {eli5}")
    #     print()

    return {"mae": mae, "rmse": rmse, "r2": r2, "y_pred": y_pred}


# ── Architecture comparison ───────────────────────────────────────────────────

def recommend_cheapest_station(
    model: MLPRegressor,
    scaler_X,
    scaler_y,
    X: pd.DataFrame,
    y_columns: list[str],
    horizon_h: int = 8,
    tank_liter: int = 400,
) -> dict:
    """
    Return a ranked station recommendation for a given forecast horizon.

    Parameters
    ----------
    model       : fitted MLPRegressor
    scaler_X    : fitted StandardScaler for X
    scaler_y    : fitted StandardScaler for y
    X           : feature DataFrame (uses the last row = current time)
    y_columns   : list of all target column names (for horizon lookup)
    horizon_h   : forecast horizon in hours (1–72)
    tank_liter  : tank volume in litres (used to compute spread in €)

    Returns
    -------
    dict with keys:
        horizon_h, recommendation (str), expected_price (float),
        ranking (list of (route, price) tuples), spread_eur (float)
    """
    latest = X.iloc[[-1]]
    feat_s = scaler_X.transform(latest)
    pred_s = model.predict(feat_s)
    pred   = scaler_y.inverse_transform(pred_s)[0]

    step_cols = [c for c in y_columns if f"t+{horizon_h}h" in c]
    step_idx  = [y_columns.index(c) for c in step_cols]
    prices    = {
        c.replace("diesel_", "").replace(f"_t+{horizon_h}h", ""): pred[i]
        for c, i in zip(step_cols, step_idx)
    }
    ranked   = sorted(prices.items(), key=lambda kv: kv[1])
    cheapest = ranked[0]
    spread   = (ranked[-1][1] - ranked[0][1]) * tank_liter

    return {
        "horizon_h":      horizon_h,
        "recommendation": cheapest[0],
        "expected_price": cheapest[1],
        "ranking":        ranked,
        "spread_eur":     spread,
    }


def run_architecture_comparison(
    architectures: list[tuple],
    X_train_sc: np.ndarray,
    y_train_sc: np.ndarray,
    X_val_sc: np.ndarray,
    y_val: np.ndarray,
    scaler_y,
    **kwargs,
) -> pd.DataFrame:
    """
    Train one MLPRegressor per architecture and evaluate on the validation set.

    Parameters
    ----------
    architectures   : list of hidden_layer_sizes tuples, e.g. [(64,), (128, 64), (256, 128)]
    X_train_sc      : scaled training features
    y_train_sc      : scaled training targets
    X_val_sc        : scaled validation features
    y_val           : unscaled validation targets (for metric computation)
    scaler_y        : fitted StandardScaler for inverse-transforming predictions
    **kwargs        : forwarded to train_mlp / MLPRegressor (override MLP_DEFAULTS)

    Returns
    -------
    pd.DataFrame with columns:
        architecture, n_params, val_mae, val_rmse, val_r2, n_iter
    """
    rows = []
    for arch in architectures:
        arch_str = str(arch)
        print(f"  Training {arch_str:<25} …", end=" ", flush=True)

        model = train_mlp(X_train_sc, y_train_sc, hidden_layer_sizes=arch, **kwargs)

        y_pred = scaler_y.inverse_transform(model.predict(X_val_sc))
        mae  = mean_absolute_error(y_val, y_pred)
        rmse = np.sqrt(mean_squared_error(y_val, y_pred))
        r2   = r2_score(y_val, y_pred)
        n_params = (
            sum(w.size for w in model.coefs_)
            + sum(b.size for b in model.intercepts_)
        )

        print(f"MAE {mae:.5f}  RMSE {rmse:.5f}  iter {model.n_iter_:>4}  params {n_params:>10,}")

        rows.append({
            "architecture": arch_str,
            "n_params":     n_params,
            "val_mae":      mae,
            "val_rmse":     rmse,
            "val_r2":       r2,
            "n_iter":       model.n_iter_,
        })

    df = pd.DataFrame(rows)
    print(f"\nBeste Architektur (Val MAE): {df.loc[df.val_mae.idxmin(), 'architecture']}")
    return df
