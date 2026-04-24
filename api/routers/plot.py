"""
Data Visualization router – returns Plotly figure JSON
"""

import tempfile
from typing import List

import numpy as np
import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from fastapi import APIRouter, File, Form, UploadFile, HTTPException

from api.utils import save_uploads
from powertech_tools.utils.file_parser import read_headers_only, load_maxmin_for_plot

router = APIRouter()

_COLOR_MIN   = "#0066CC"
_COLOR_MAX   = "#CC0000"
_COLOR_OTHER = "#2E86AB"


@router.post("/headers")
async def get_headers(files: List[UploadFile] = File(...)):
    """Upload maxmin file, return headers with min/max kind info."""
    tmpdir = tempfile.mkdtemp(prefix="jerry_plot_")
    try:
        paths = await save_uploads(files, tmpdir)
        df, int_cols, int_to_disp, int_kind = load_maxmin_for_plot(paths[0])
        return {
            "row_count": len(df),
            "columns": [
                {"id": c, "display": int_to_disp[c], "kind": int_kind.get(c, "other")}
                for c in int_cols
            ],
        }
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/figure")
async def get_figure(
    files: List[UploadFile] = File(...),
    config_json: str = Form(...),
    # config_json schema:
    # {
    #   "main_title": str,
    #   "cycle_col_id": str,
    #   "x_min": number | null,
    #   "x_max": number | null,
    #   "graphs": [
    #     {
    #       "title": str, "y_label": str,
    #       "y1": str, "y2": str,
    #       "y_min": number|null, "y_max": number|null, "y_ticks": int|null,
    #       "min_lower": number|null, "min_upper": number|null,
    #       "max_lower": number|null, "max_upper": number|null,
    #     }
    #   ]
    # }
):
    import json

    tmpdir = tempfile.mkdtemp(prefix="jerry_plot_")
    try:
        paths = await save_uploads(files, tmpdir)
        cfg = json.loads(config_json)

        df, int_cols, int_to_disp, int_kind = load_maxmin_for_plot(paths[0])
        disp_to_int = {v: k for k, v in int_to_disp.items()}

        cycle_int = cfg.get("cycle_col_id")
        if not cycle_int or cycle_int not in df.columns:
            raise HTTPException(400, "Invalid cycle column")

        df[cycle_int] = pd.to_numeric(df[cycle_int], errors="coerce")
        df = df[df[cycle_int].notna()].reset_index(drop=True)
        x = df[cycle_int]

        active = [g for g in cfg.get("graphs", []) if g.get("y1") or g.get("y2")]
        if not active:
            raise HTTPException(400, "No graphs configured")

        n = len(active)
        subplot_titles = [g.get("title") or g.get("y1") or f"Graph {i+1}" for i, g in enumerate(active)]

        fig = make_subplots(
            rows=n, cols=1,
            shared_xaxes=True,
            subplot_titles=subplot_titles,
            vertical_spacing=max(0.03, 0.25 / n),
        )

        for i, g in enumerate(active, start=1):
            y_label   = g.get("y_label") or "Value"
            y_min     = _fv(g.get("y_min"))
            y_max     = _fv(g.get("y_max"))
            y_ticks   = _iv(g.get("y_ticks"))
            min_lower = _fv(g.get("min_lower"))
            min_upper = _fv(g.get("min_upper"))
            max_lower = _fv(g.get("max_lower"))
            max_upper = _fv(g.get("max_upper"))

            for y_disp in [g.get("y1", ""), g.get("y2", "")]:
                if not y_disp:
                    continue
                y_int = disp_to_int.get(y_disp)
                if not y_int or y_int not in df.columns:
                    continue
                y     = pd.to_numeric(df[y_int], errors="coerce")
                kind  = int_kind.get(y_int, "other")
                color = _COLOR_MIN if kind == "min" else _COLOR_MAX if kind == "max" else _COLOR_OTHER
                fig.add_trace(go.Scatter(
                    x=x, y=y, mode="markers",
                    marker=dict(color=color, size=4, opacity=0.75),
                    name=y_disp,
                    hovertemplate=f"<b>{y_disp}</b><br>Cycle: %{{x}}<br>Value: %{{y:.4f}}<extra></extra>",
                ), row=i, col=1)

            for val, color, dash, label in [
                (min_lower, _COLOR_MIN, "dot",  "Min Lower"),
                (min_upper, _COLOR_MIN, "dot",  "Min Upper"),
                (max_lower, _COLOR_MAX, "dash", "Max Lower"),
                (max_upper, _COLOR_MAX, "dash", "Max Upper"),
            ]:
                if val is None:
                    continue
                fig.add_hline(y=val, row=i, col=1,
                              line=dict(color=color, dash=dash, width=1.5),
                              annotation_text=f" {label}: {val}",
                              annotation_font_size=10)

            y_ax = dict(title_text=y_label, gridcolor="rgba(0,0,0,0.08)")
            if y_min is not None and y_max is not None:
                y_ax["range"] = [y_min, y_max]
                if y_ticks and y_ticks > 1:
                    y_ax["tickvals"] = np.linspace(y_min, y_max, y_ticks).tolist()
            fig.update_yaxes(**y_ax, row=i, col=1)

        x_min = _fv(cfg.get("x_min"))
        x_max = _fv(cfg.get("x_max"))
        x_range = None
        if x_min is not None or x_max is not None:
            x_range = [x_min if x_min is not None else float(x.min()),
                       x_max if x_max is not None else float(x.max())]
        fig.update_xaxes(title_text="Cycle", gridcolor="rgba(0,0,0,0.08)", range=x_range, row=n, col=1)
        fig.update_layout(
            title_text=cfg.get("main_title") or None,
            height=max(350, 300 * n),
            plot_bgcolor="white", paper_bgcolor="white",
            hovermode="x",
            legend=dict(orientation="h", yanchor="bottom", y=1.01, xanchor="right", x=1),
            margin=dict(t=80, b=40, l=60, r=40),
        )

        return {"figure": fig.to_dict()}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/load-png")
async def load_png(file: UploadFile = File(...)):
    """Extract jerry_settings metadata from a previously saved graph PNG."""
    import json, io
    from PIL import Image

    try:
        data = await file.read()
        img = Image.open(io.BytesIO(data))
        raw = img.info.get("jerry_settings")
        if not raw:
            raise HTTPException(400, "No settings found in this PNG — was it saved from Jerry?")
        s = json.loads(raw)

        # Map old Streamlit field names → new React field names
        graphs = []
        for g in s.get("graphs", []):
            graphs.append({
                "title":      g.get("title", ""),
                "y_label":    g.get("y_label", "Value"),
                "y1":         g.get("y1_var", g.get("y1", "")),
                "y2":         g.get("y2_var", g.get("y2", "")),
                "y_min":      str(g.get("y_min", "")),
                "y_max":      str(g.get("y_max", "")),
                "y_ticks":    str(g.get("y_ticks", "")),
                "min_lower":  str(g.get("min_low",   g.get("min_lower", ""))),
                "min_upper":  str(g.get("min_high",  g.get("min_upper", ""))),
                "max_lower":  str(g.get("max_low",   g.get("max_lower", ""))),
                "max_upper":  str(g.get("max_high",  g.get("max_upper", ""))),
            })

        return {
            "main_title": s.get("main_title", ""),
            "x_min": str(s.get("x_min", "")),
            "x_max": str(s.get("x_max", "")),
            "graphs": graphs,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Could not read PNG: {e}")


def _fv(v):
    if v is None:
        return None
    try:
        f = float(v)
        return None if np.isnan(f) else f
    except (TypeError, ValueError):
        return None


def _iv(v):
    f = _fv(v)
    return None if f is None else int(f)
