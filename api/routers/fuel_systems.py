"""
Fuel Systems Validation router
"""

import io
import os
import tempfile
from datetime import datetime
from typing import List

import pandas as pd
import plotly.graph_objects as go
from fastapi import APIRouter, File, Form, UploadFile, HTTPException

from api.utils import save_uploads, text_response, excel_response, sanitize
from powertech_tools.utils.file_parser import read_headers_only, load_table_allow_duplicate_headers
from powertech_tools.data.fuel_systems_validator import validate_fuel_system_file

router = APIRouter()

_BG   = "#1a1a2e"
_PLOT = "#16213e"
_GRID = "#334155"
_TEXT = "#e2e8f0"
_DIM  = "#94a3b8"
_LINE_COLORS = ["#00d4ff","#ff6bcb","#00ff88","#ffd93d","#ff8a50","#a78bfa","#34d399","#f472b6"]


@router.post("/headers")
async def get_headers(files: List[UploadFile] = File(...)):
    tmpdir = tempfile.mkdtemp(prefix="jerry_fs_")
    try:
        paths = await save_uploads(files, tmpdir)
        headers, _, _, _ = read_headers_only(paths[0])
        return {"headers": headers, "file_count": len(paths)}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/validate")
async def validate(
    files: List[UploadFile] = File(...),
    time_col: str  = Form(...),
    ptank_col: str = Form(...),
    tfuel_col: str = Form(...),
    ptank_threshold: float = Form(2.0),
    end_mode: str  = Form("Ptank"),
    soc_col: str   = Form(""),
    soc_threshold: float  = Form(100.0),
    enable_tfuel: bool    = Form(True),
    tfuel_target: float   = Form(-30.0),
    tfuel_window: float   = Form(30.0),
    enable_ramp: bool     = Form(False),
    ramp_limit_str: str   = Form(""),
    param_limits_json: str = Form("{}"),
):
    import json

    tmpdir = tempfile.mkdtemp(prefix="jerry_fs_")
    try:
        paths = await save_uploads(files, tmpdir)
        param_limits = json.loads(param_limits_json)
        ramp_limit = float(ramp_limit_str) if ramp_limit_str.strip() else None

        results = []
        for fp in paths:
            res = validate_fuel_system_file(
                fp, time_col, ptank_col, tfuel_col, param_limits,
                ptank_threshold=ptank_threshold,
                tfuel_target=tfuel_target if enable_tfuel else 0.0,
                tfuel_window=tfuel_window if enable_tfuel else 30.0,
                enable_tfuel_check=enable_tfuel,
                end_mode=end_mode,
                soc_col=soc_col if soc_col else None,
                soc_threshold=soc_threshold,
                enable_ramp_check=enable_ramp,
                ramp_limit=ramp_limit,
            )
            results.append(res)

        # Attach stored paths for visualization
        for i, res in enumerate(results):
            res["_path"] = paths[i]

        return sanitize({"results": results})

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/figure")
async def get_figure(
    files: List[UploadFile] = File(...),
    config_json: str = Form(...),
    file_index: int = Form(0),
    # config has: time_col, ptank_col, tfuel_col, tfuel_target, tfuel_window
    # plus result: cycle_start_idx, cycle_end_idx, status
):
    import json

    tmpdir = tempfile.mkdtemp(prefix="jerry_fs_")
    try:
        paths = await save_uploads(files, tmpdir)
        cfg = json.loads(config_json)

        idx = max(0, min(file_index, len(paths) - 1))
        fp  = paths[idx]

        time_col      = cfg.get("time_col", "")
        tfuel_target  = float(cfg.get("tfuel_target", -30))
        tfuel_window  = float(cfg.get("tfuel_window", 30))
        start_idx     = cfg.get("cycle_start_idx")
        end_idx       = cfg.get("cycle_end_idx")
        status        = cfg.get("status", "")

        df = load_table_allow_duplicate_headers(fp)

        # Build time axis
        t = pd.to_numeric(df[time_col], errors="coerce") if time_col in df.columns else pd.Series(range(len(df)), dtype=float)
        if t.isna().all():
            t = pd.to_datetime(df[time_col], errors="coerce")
            if not t.isna().all():
                t = (t - t.iloc[0]).dt.total_seconds()
            else:
                t = pd.Series(range(len(df)), dtype=float)
        else:
            t0 = t.iloc[0] if not pd.isna(t.iloc[0]) else 0.0
            t = t - t0

        fig = go.Figure()
        plot_cols = [c for c in df.columns if c != time_col]
        for i, col in enumerate(plot_cols):
            y = pd.to_numeric(df[col], errors="coerce")
            if y.isna().all():
                continue
            fig.add_trace(go.Scatter(
                x=t, y=y, mode="lines", name=col,
                line=dict(color=_LINE_COLORS[i % len(_LINE_COLORS)], width=1.2),
                opacity=0.85,
            ))

        # Cycle boundary lines
        if start_idx is not None:
            t_start = float(t.iloc[start_idx])
            t_end   = float(t.iloc[end_idx]) if end_idx is not None else float(t.iloc[-1])
            t_win   = t_start + tfuel_window

            for xv, name, color in [
                (t_start, "Fill start",             "#00ff88"),
                (t_end,   "Fill end",               "#c084fc"),
                (t_win,   f"tfuel window ({tfuel_window}s)", "#ffd93d"),
            ]:
                fig.add_trace(go.Scatter(
                    x=[xv, xv], y=[-200, 200], mode="lines", name=name,
                    line=dict(color=color, width=1.5, dash="solid" if name != f"tfuel window ({tfuel_window}s)" else "dash"),
                ))

        # tfuel target
        fig.add_trace(go.Scatter(
            x=[float(t.iloc[0]), float(t.iloc[-1])],
            y=[tfuel_target, tfuel_target],
            mode="lines", name=f"tfuel target ({tfuel_target}°C)",
            line=dict(color="#ff4d4d", width=1.5, dash="dot"),
        ))

        status_color = "#00ff88" if status == "PASS" else "#ff4d4d"
        fname = os.path.basename(fp)
        fig.update_layout(
            title=dict(text=f"{fname} — {status}", font=dict(color=status_color, size=12)),
            height=500,
            paper_bgcolor=_BG, plot_bgcolor=_PLOT, font=dict(color=_TEXT),
            xaxis=dict(title="Time from file start (s)", gridcolor=_GRID, color=_DIM),
            yaxis=dict(title="Value", gridcolor=_GRID, color=_DIM, range=[-95, 110]),
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1,
                        bgcolor="rgba(26,26,46,0.8)", bordercolor=_GRID),
            hovermode="x unified",
            margin=dict(t=60, b=50, l=60, r=20),
        )

        return {"figure": fig.to_dict()}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/report")
async def report(results_json: str = Form(...)):
    """Generate text report from validation results."""
    import json
    results = json.loads(results_json)

    lines = [
        "=" * 80,
        "            Jerry - HITT TEAM ANALYSIS TOOL",
        "             FUEL SYSTEMS VALIDATION REPORT",
        "=" * 80,
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "",
        "VALIDATION SUMMARY",
        "-" * 80,
        f"Total Files : {len(results)}",
        f"PASSED      : {sum(1 for r in results if r['status']=='PASS')}",
        f"FAILED      : {sum(1 for r in results if r['status']=='FAIL')}",
        f"ERRORS      : {sum(1 for r in results if r['status']=='ERROR')}",
        "=" * 80,
        "",
    ]
    for r in results:
        sym = "V" if r["status"] == "PASS" else "X"
        lines += [
            f"[{sym}] {r['file']} - {r['status']}",
            f"  Fill Points  : {r['cycle_points']} (of {r['total_points']} total)",
            f"  tfuel Check  : {'PASS' if r['tfuel_check'] else 'FAIL'}",
            f"    {r['tfuel_message']}",
        ]
        if r.get("soc_message"):
            lines.append(f"  SOC          : {r['soc_message']}")
        if r.get("ramp_message"):
            lines += [f"  Ramp Rate    : {'PASS' if r.get('ramp_pass', True) else 'FAIL'}",
                      f"    {r['ramp_message']}"]
        if r["param_violations"]:
            lines.append("  Param Bounds : VIOLATIONS")
            lines += [f"    - {v}" for v in r["param_violations"]]
        else:
            lines.append("  Param Bounds : All within limits")
        lines.append("")

    lines += ["=" * 80, "END OF REPORT", "=" * 80]
    return text_response(io.BytesIO("\n".join(lines).encode()), "fuel_systems_report.txt")
