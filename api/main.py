"""
Jerry – Powertech Analysis Tools
FastAPI backend entry point
"""

import sys
import os
import logging
import logging.handlers
from datetime import datetime, timezone

_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _root not in sys.path:
    sys.path.insert(0, _root)

_start_time = datetime.now(timezone.utc)

# File logging (written to logs/ next to repo root)
_log_dir = os.path.join(_root, "logs")
os.makedirs(_log_dir, exist_ok=True)
_log_file = os.path.join(_log_dir, "jerry.log")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.handlers.RotatingFileHandler(
            _log_file, maxBytes=10 * 1024 * 1024, backupCount=3, encoding="utf-8"
        ),
    ],
)
logger = logging.getLogger("jerry")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from api.routers import merge, maxmin, avg, asr, validation, plot, cycle_viewer, fuel_systems, soc_converter

app = FastAPI(
    title="Jerry – Powertech Analysis Tools API",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total", "X-Passed", "X-Failed"],
)

app.include_router(merge.router,        prefix="/api/merge",        tags=["merge"])
app.include_router(maxmin.router,       prefix="/api/maxmin",       tags=["maxmin"])
app.include_router(avg.router,          prefix="/api/avg",          tags=["avg"])
app.include_router(asr.router,          prefix="/api/asr",          tags=["asr"])
app.include_router(validation.router,   prefix="/api/validation",   tags=["validation"])
app.include_router(plot.router,         prefix="/api/plot",         tags=["plot"])
app.include_router(cycle_viewer.router, prefix="/api/cycle-viewer", tags=["cycle_viewer"])
app.include_router(fuel_systems.router, prefix="/api/fuel-systems", tags=["fuel_systems"])
app.include_router(soc_converter.router, prefix="/api/soc",         tags=["soc"])


@app.on_event("startup")
async def on_startup():
    logger.info("Jerry started — listening on http://0.0.0.0:80")


@app.get("/api/health")
def health():
    uptime = datetime.now(timezone.utc) - _start_time
    hours, remainder = divmod(int(uptime.total_seconds()), 3600)
    minutes, seconds = divmod(remainder, 60)
    return {
        "status": "ok",
        "version": "2.0.0",
        "uptime": f"{hours}h {minutes}m {seconds}s",
        "started": _start_time.isoformat(),
    }


# Serve built React frontend (used in production / server deployment)
_dist = os.path.join(_root, "frontend", "dist")
if os.path.isdir(_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(_dist, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        return FileResponse(os.path.join(_dist, "index.html"))
