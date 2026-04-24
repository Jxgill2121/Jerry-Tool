# Jerry — Data Flow

## Overview

```mermaid
flowchart TD
    User(["👤 User (Browser)"])

    User -->|"Upload files\n(CSV / TXT / TDMS / Excel)"| FE["⚛️ React Frontend"]

    FE -->|"POST multipart/form-data"| API["🐍 FastAPI Backend\n(port 80)"]

    API --> TMP["📂 Temp Directory\n(files saved to disk)"]

    TMP --> DP["🔧 Data Processing Layer\npowertech_tools/data/"]

    DP --> L["loader.py\nParse & merge files"]
    DP --> P["processor.py\nMax/Min, averages, ramp"]
    DP --> V["validator.py\nPass/fail against limits"]
    DP --> A["asr_validator.py\nTemperature band hours"]
    DP --> F["fuel_systems_validator.py\nFuel cycle checks"]

    L --> R1["📄 Merged TXT\n(Cycles output)"]
    P --> R2["📄 Max/Min TXT\n(Summary output)"]
    P --> R3["📊 Excel\n(Averages)"]
    P --> R4["📈 Plotly JSON\n(Graph data)"]
    V --> R5["📊 Excel\n(PASS/FAIL report)"]
    A --> R6["📋 JSON Table\n(ASR results)"]
    F --> R7["📊 Excel\n(Fuel systems report)"]

    R1 -->|"File download"| User
    R2 -->|"File download"| User
    R3 -->|"File download"| User
    R4 -->|"Render Plotly chart\nin browser"| User
    R5 -->|"File download\n+ pass/fail counts"| User
    R6 -->|"Display in table"| User
    R7 -->|"File download"| User
```

---

## Per-Tool Flow

### Jerry Tool — TDMS → Cycles (Merge)
```
TDMS files  →  loader.py (merge_selected_files)  →  Merged TXT download
```

### Jerry Tool — Max/Min
```
Cycle TXT files (x100+)  →  processor.py (compute_maxmin_from_multiple_files)  →  Max/Min Summary TXT download
```

### Jerry Tool — Generate Averages
```
Cycle TXT files  →  processor.py (stream_file_means)  →  Excel with mean/min/max/stdev per column
```

### Jerry Tool — Cylinder Validation
```
Max/Min TXT  →  validator.py (validate_maxmin_file)  →  Excel with PASS/FAIL per cycle
                                                      →  Pass/fail counts shown in browser
```

### Jerry Tool — ASR Validation
```
Log files  →  asr_validator.py  →  Hours accumulated per temperature band
                                →  Pass/fail vs target hours
```

### Jerry Tool — Fuel Systems
```
Cycle TXT files  →  fuel_systems_validator.py  →  Excel with per-cycle check results
(Ptank, Tfuel, SOC)    (ramp rate, bounds,          (PASS/FAIL per check)
                         pre-conditioning)
```

### Jerry Tool — Cycle Viewer
```
Cycle TXT files  →  file_parser.py (load data)  →  Plotly JSON  →  Interactive chart in browser
```

### Report Graph Generator
```
Max/Min TXT  →  plot router  →  processor.py  →  Plotly JSON  →  Interactive graph in browser
                                                               →  Save as PNG to S Drive
Previously saved PNG  →  plot/load-png  →  Restore settings  →  Re-apply to new data
```

### SOC Calculator
```
Data file (CSV/TXT)  →  soc_converter.py  →  Add SOC column (from Ptank + Ttank lookup)
with Ptank & Ttank                         →  Download updated file
```

### Uncertainty Tool
```
Asset list Excel  →  AssetLookup (browser-side)  →  Search results displayed
(from S Drive)       no server call               
Manual inputs     →  uncertainty.ts calculations  →  Results table + chart (browser-side)
```

---

## File Formats

| Input | Used By |
|-------|---------|
| `.tdms` | Merge (TDMS → Cycles) |
| `.txt` / `.dat` / `.csv` | Max/Min, Averages, Validation, Fuel, Cycle Viewer |
| `.xlsx` / `.xls` | Uncertainty Asset List, SOC input |
| `.png` (saved by Jerry) | Graph Generator (restore settings) |

| Output | Produced By |
|--------|------------|
| `.txt` (tab-separated) | Merge, Max/Min |
| `.xlsx` | Averages, Validation, Fuel Systems |
| `.png` | Report Graph Generator |
| In-browser table | ASR Validation, Cycle Viewer |
| In-browser chart (Plotly) | Cycle Viewer, Graph Generator |
