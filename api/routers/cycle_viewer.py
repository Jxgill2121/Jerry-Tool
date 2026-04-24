"""
Cycle Viewer router – dual y-axis Plotly figures
"""

import tempfile
from typing import List

import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from fastapi import APIRouter, File, Form, UploadFile, HTTPException

from api.utils import save_uploads
from powertech_tools.utils.file_parser import read_headers_only, load_table_allow_duplicate_headers

router = APIRouter()

_COLORS = {
    "Ptank": "#00d4ff", "Tskin": "#ff6bcb", "Tamb": "#ffd93d",
    "Tfluid": "#00ff88", "SOC": "#a78bfa",
}
_DEFAULT_COLORS = ["#00d4ff","#ff6bcb","#00ff88","#ffd93d","#ff8a50","#a78bfa","#34d399"]

_BG    = "#1a1a2e"
_PLOT  = "#16213e"
_GRID  = "#334155"
_TEXT  = "#e2e8f0"
_DIM   = "#94a3b8"


@router.post("/headers")
async def get_headers(files: List[UploadFile] = File(...)):
    tmpdir = tempfile.mkdtemp(prefix="jerry_cv_")
    try:
        paths = await save_uploads(files, tmpdir)
        headers, _, _, _ = read_headers_only(paths[0])
        return {"headers": headers, "file_count": len(paths)}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/figure")
async def get_figure(
    files: List[UploadFile] = File(...),
    config_json: str = Form(...),
    # {
    #   "time_col": str,
    #   "ptank_col": str,
    #   "tskin_col": str,
    #   "extra_cols": [str],         # left-axis extras
    #   "right_cols": [str],         # right-axis cols
    #   "mode": "per_cycle"|"duration",
    #   "file_index": int,           # which file (0-based) for per_cycle mode
    #   "limits": {colName: {lower: f, upper: f}},
    #   "title": str,
    # }
):
    import json

    tmpdir = tempfile.mkdtemp(prefix="jerry_cv_")
    try:
        paths = await save_uploads(files, tmpdir)
        cfg = json.loads(config_json)

        mode       = cfg.get("mode", "per_cycle")
        file_index = int(cfg.get("file_index", 0))
        time_col   = cfg.get("time_col", "")
        ptank_col  = cfg.get("ptank_col", "")
        tskin_col  = cfg.get("tskin_col", "")
        extra_left = cfg.get("extra_cols", [])
        right_cols = cfg.get("right_cols", [tskin_col] if tskin_col else [])
        limits     = cfg.get("limits", {})
        title      = cfg.get("title", "")
        time_unit  = cfg.get("time_unit", "seconds")   # seconds | minutes | hours | days
        left_label = cfg.get("left_label", "")
        right_label= cfg.get("right_label", "")

        _time_divisors = {"seconds": 1, "minutes": 60, "hours": 3600, "days": 86400}
        time_divisor = _time_divisors.get(time_unit, 1)
        time_label = f"Time ({time_unit})"

        if mode == "per_cycle":
            idx = max(0, min(file_index, len(paths) - 1))
            df  = load_table_allow_duplicate_headers(paths[idx])
            fname = paths[idx].split("/")[-1]
        else:
            # duration mode: load all files, offset time
            frames = []
            offset = 0.0
            for p in paths:
                d = load_table_allow_duplicate_headers(p)
                if time_col in d.columns:
                    t = pd.to_numeric(d[time_col], errors="coerce")
                    if not t.isna().all():
                        t0 = t.iloc[0] if not pd.isna(t.iloc[0]) else 0.0
                        d[time_col] = t - t0 + offset
                        offset += float(t.max() - t.min()) + 0.5
                frames.append(d)
            df = pd.concat(frames, ignore_index=True)
            fname = f"{len(paths)} files"

        # Build time axis
        if time_col and time_col in df.columns:
            t = pd.to_numeric(df[time_col], errors="coerce")
            if t.isna().all():
                t = pd.to_datetime(df[time_col], errors="coerce")
                if not t.isna().all():
                    t = (t - t.iloc[0]).dt.total_seconds()
                else:
                    t = pd.Series(range(len(df)), dtype=float)
            else:
                t0 = t.iloc[0] if not pd.isna(t.iloc[0]) else 0.0
                t = t - t0
        else:
            t = pd.Series(range(len(df)), dtype=float)

        # Apply time unit divisor
        t = t / time_divisor

        # Decide which cols are left vs right
        left_cols = [ptank_col] + [c for c in extra_left if c and c != ptank_col]
        left_cols = [c for c in left_cols if c and c in df.columns]
        right_cols_f = [c for c in right_cols if c and c in df.columns]

        fig = make_subplots(specs=[[{"secondary_y": bool(right_cols_f)}]])

        all_series = [(c, False) for c in left_cols] + [(c, True) for c in right_cols_f]
        for idx_c, (col, secondary) in enumerate(all_series):
            y = pd.to_numeric(df[col], errors="coerce")
            color = _COLORS.get(col, _DEFAULT_COLORS[idx_c % len(_DEFAULT_COLORS)])
            fig.add_trace(go.Scatter(
                x=t, y=y, mode="lines", name=col,
                line=dict(color=color, width=1.5),
            ), secondary_y=secondary)

            # Limit lines
            lim = limits.get(col, {})
            x_span = [float(t.iloc[0]), float(t.iloc[-1])]
            for lkey, lcolor, ldash in [("lower", "#ff4d4d", "dot"), ("upper", "#ff4d4d", "dot")]:
                lval = lim.get(lkey)
                if lval is not None:
                    fig.add_trace(go.Scatter(
                        x=x_span, y=[lval, lval], mode="lines",
                        name=f"{col} {lkey}", line=dict(color=lcolor, width=1, dash=ldash),
                        showlegend=False,
                    ), secondary_y=secondary)

        fig.update_layout(
            title=dict(text=title or fname, font=dict(color=_TEXT, size=12)),
            height=480,
            paper_bgcolor=_BG, plot_bgcolor=_PLOT,
            font=dict(color=_TEXT),
            xaxis=dict(title=time_label, gridcolor=_GRID, color=_DIM),
            hovermode="x unified",
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1,
                        bgcolor="rgba(26,26,46,0.8)", bordercolor=_GRID),
            margin=dict(t=60, b=50, l=60, r=60),
        )
        fig.update_yaxes(title_text=left_label or "Left Axis", gridcolor=_GRID, color=_DIM, secondary_y=False)
        if right_cols_f:
            fig.update_yaxes(title_text=right_label or "Right Axis", gridcolor=_GRID, color=_DIM, secondary_y=True)

        return {
            "figure": fig.to_dict(),
            "file_count": len(paths),
            "current_file": fname,
            "file_index": file_index,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))
