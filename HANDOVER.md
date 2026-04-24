# JERRY - Handover Document

**Repository:** https://github.com/Jxgill2121/Jerrry-Tool  
**Branch:** `main` (production)  
**Last Updated:** April 2026

---

## Overview

Jerry is a suite of data analysis tools for Powertech featuring web-based applications for:
- **Jerry Tool** - TDMS→Cycles merging, Max/Min analysis, cycle averages, ASR validation, cylinder validation, fuel systems testing, cycle viewing
- **Report Graph Generator** - Create publication-quality graphs from Max/Min data
- **SOC Calculator** - Calculate hydrogen tank state of charge from pressure and temperature
- **Uncertainty Tool** - GUM-compliant measurement uncertainty analysis

---

## How to Run It

### Prerequisites
- Node.js 18+ (for frontend)
- Python 3.9+ (for backend)
- PM2 (for server management)
- Git

### First Time Setup

```bash
# 1. Clone the repo
git clone https://github.com/Jxgill2121/Jerrry-Tool.git
cd Jerrry-Tool

# 2. Install backend dependencies
cd api
pip install -r requirements.txt  # If exists, or: pip install fastapi uvicorn pandas openpyxl plotly kaleido

# 3. Install frontend dependencies
cd ../frontend
npm install

# 4. Build frontend
npm run build

# 5. Return to root
cd ..
```

### Running Locally (Development)

**Terminal 1 - Backend (FastAPI):**
```bash
cd api
uvicorn main:app --reload --host 0.0.0.0 --port 80
```

**Terminal 2 - Frontend (Vite):**
```bash
cd frontend
npm run dev
```

Then open `http://localhost:5173`

### Running on Server (Production)

**One-Click Update:**
Double-click `update.bat` on the server. It will:
1. Pull latest code from `main` branch
2. Rebuild the frontend
3. Restart the PM2 server

**Manual Server Start:**
```bash
# Build frontend
cd frontend
npm install
npm run build
cd ..

# Start with PM2
pm2 start "cd /path/to/api && uvicorn main:app --host 0.0.0.0 --port 80" --name jerry
pm2 save
pm2 startup
```

**Server Access:**
- Frontend: `http://localhost` or configured domain
- API: `http://localhost:80`
- Health check: `http://localhost:80/api/health`

---

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (React)                     │
│  - TypeScript with Vite build tool                       │
│  - Tailwind CSS styling                                  │
│  - Plotly.js for graphing                               │
│  - Axios for API calls                                   │
└─────────────────────────────────────────────────────────┘
                           ↓ REST API
┌─────────────────────────────────────────────────────────┐
│                    Backend (FastAPI)                     │
│  - /api/merge - File merging                             │
│  - /api/maxmin - Max/Min analysis                        │
│  - /api/avg - Cycle averages                             │
│  - /api/validation - Cylinder validation                 │
│  - /api/asr - ASR validation                             │
│  - /api/fuel-systems - Fuel systems testing              │
│  - /api/plot - Graph generation                          │
│  - /api/cycle-viewer - Cycle visualization               │
│  - /api/soc - SOC calculator                             │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│           Data Processing Layer (Python)                 │
│  - File parsing & merging (loader.py)                    │
│  - Data transformations (processor.py)                   │
│  - Validation logic (validator.py, asr_validator.py)     │
│  - TDMS file support                                     │
└─────────────────────────────────────────────────────────┘
```

### Key Components

**Frontend (`frontend/src/`):**
- `App.tsx` - Top-level router for all apps
- `JerryApp.tsx` - Main Jerry Tool with sidebar navigation
- `GraphApp.tsx` - Report Graph Generator standalone app
- `/tabs/` - Individual features (Merge, MaxMin, Validation, etc.)
- `/soc-converter/` - SOC Calculator app
- `/uncertainty-tool/` - Uncertainty calculator app

**Backend (`api/`):**
- `main.py` - FastAPI app, CORS config, static file serving
- `routers/` - API endpoints by feature
- `utils.py` - Response helpers, file handling

**Data Processing (`powertech_tools/data/`):**
- `loader.py` - File parsing (CSV, Excel, TDMS)
- `processor.py` - Max/Min, averages, ramp analysis
- `validator.py` - Validation against limits
- `asr_validator.py` - ASR temperature band analysis
- `fuel_systems_validator.py` - Fuel systems checks

### User Workflows

1. **Max/Min Analysis:** Upload TDMS files → Merge → Output merged Max/Min file
2. **Graphing:** Upload Max/Min file → Configure layout → Generate plots → Save PNG to S drive
3. **Validation:** Upload Max/Min file → Set limits → Run validation → Excel export with PASS/FAIL
4. **ASR Testing:** Upload log files → Define temperature bands → Check hours accumulated
5. **Cycle Averages:** Upload cycle files → Select columns → Export Excel with statistics

---

## Troubleshooting

### Frontend Build Fails
```
Error: Cannot find module 'react-router-dom'
```
**Fix:** Run `npm install` in the `frontend/` directory. Ensure `package.json` has the dependency.

### Server Shows "Fetching from old branch"
```
[1/3] Downloading latest code...
From https://github.com/Jxgill2121/Jerrry-Tool
 * branch            claude/convert-to-webapp-BR383 -> FETCH_HEAD
```
**Fix:** The server's git repo isn't on the `main` branch. Run these manually on the server:
```bash
git fetch origin main
git checkout main
git reset --hard origin/main
```

### "Cannot find module" errors after git pull
**Fix:** Reinstall dependencies:
```bash
# Frontend
cd frontend && npm install && npm run build && cd ..

# Backend (if needed)
pip install --upgrade -r requirements.txt
```

### File Upload Size Limit
If uploads fail with large files (100+ MB):
- FastAPI default is unbounded but python-multipart buffers in memory
- For very large files, consider splitting uploads or using streaming

### Port Already in Use
```
OSError: [Errno 98] Address already in use
```
**Fix:** 
```bash
# Find process on port 8000
lsof -i :80
# Kill it
kill -9 <PID>

# Or use different port
uvicorn api.main:app --port 8080
```

### PM2 Server Not Restarting
```
pm2 restart jerry failed
```
**Fix:** Check if PM2 process exists:
```bash
pm2 list
pm2 start "cd /path/to/api && uvicorn main:app --host 0.0.0.0 --port 80" --name jerry
pm2 save
```

### CORS Errors in Browser Console
**Likely already configured.** If not:
- Backend has `CORSMiddleware` in `api/main.py`
- Frontend axios calls go to `/api/*` (relative URLs)
- Ensure backend is running when frontend makes API calls

### Graph Generator Shows "Load PNG" but Button Doesn't Work
- PNG must be previously saved by Jerry (contains embedded config)
- Check browser console for file reading errors
- Reference graphs (R134 standard @ 70MPa) should be saved to `S:\07 LIBRARY\...`

### Excel Exports Have Encoding Issues
**Fix:** Ensure files are UTF-8. Most recent versions handle this, but:
- Windows Excel: File → Save As → CSV UTF-8 before importing

---

## Important Paths

**Server Update Script:**
```
C:\Apps\Jerrry-Tool\update.bat
```
Pulls from `main` branch, rebuilds, restarts server.

**Graph Reference Library (S Drive):**
```
S:\07 LIBRARY\05 Calculators, Lookups and Guides\Uncertainty Measurement Asset Lists
```
Users upload pre-built reference graphs (e.g., R134 @ 70MPa) here for quick setup.

---

## Maintenance

### Deploying Changes
1. Commit to `main` branch: `git commit && git push origin main`
2. On server, run `update.bat` (double-click)
3. Verify at `http://localhost` (or configured URL)

### Rolling Back
```bash
git log --oneline main          # Find commit
git reset --hard <commit-hash>
npm run build                   # Rebuild frontend if needed
pm2 restart jerry
```

### Adding New Features
1. **Backend:** Create router in `api/routers/`, call processor functions
2. **Frontend:** Add new tab component in `frontend/src/tabs/`
3. **Processor:** Add logic in `powertech_tools/data/processor.py` if needed
4. See `CLAUDE.md` in repo for detailed architecture

### Database / Persistence
- No database — all data is file-based
- Temp directories created in `/tmp` or Windows `%TEMP%`
- User configs saved as PNG metadata (for graphs)

---

## Contact & Support

**Repository Owner:** jxgill2121  
**License:** Internal (Powertech)  
**Last Maintained:** April 2026

For questions about specific features, check:
- `/CLAUDE.md` - Detailed architecture and design decisions
- Each `*.tsx` file has comments explaining complex sections
- Backend routers have docstrings

---

## Checklist for Handover

- [ ] Read this entire document
- [ ] Clone repo and run locally (both dev setups)
- [ ] Test a few workflows (merge files, validate, graph)
- [ ] Understand the architecture (read `CLAUDE.md`)
- [ ] Try running `update.bat` on the server
- [ ] Know how to restart PM2 if server crashes
- [ ] Bookmark S drive reference graph path
- [ ] Have Python and Node.js installed and configured

**Questions? Check the troubleshooting section first, then review `CLAUDE.md` for deeper context.**
