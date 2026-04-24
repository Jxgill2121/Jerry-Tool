# JERRY - Powertech Analysis Tools

**VERSION:** 2026-01-16 v4.4 - Modular Architecture

## Overview

JERRY is a professional data analysis tool for Powertech featuring:
- File merging and data consolidation
- Max/Min analysis
- Data plotting and visualization
- Cycle averages calculation
- Data validation

## Project Structure

```
Jerry-Tool/
├── main.py                           # Application entry point
├── powertech_tools/                   # Main package
│   ├── __init__.py
│   ├── app.py                        # Main application class
│   ├── config/                       # Configuration
│   │   ├── __init__.py
│   │   └── theme.py                  # Theme colors and styling
│   ├── utils/                        # Utility functions
│   │   ├── __init__.py
│   │   ├── helpers.py                # Helper functions
│   │   └── file_parser.py            # File parsing utilities
│   ├── data/                         # Data processing
│   │   ├── __init__.py
│   │   ├── loader.py                 # File loading/merging
│   │   ├── processor.py              # Data processing
│   │   └── validator.py              # Data validation
│   └── tabs/                         # UI tabs (each feature)
│       ├── __init__.py
│       ├── merge_tab.py              # Tab 1: Merge Files
│       ├── maxmin_tab.py             # Tab 2: Max/Min Analysis
│       ├── plot_tab.py               # Tab 3: Plot Data
│       ├── avg_tab.py                # Tab 4: Cycle Averages
│       └── validation_tab.py         # Tab 5: Validation
└── Python Code                       # Original monolithic file (kept for reference)
```

## Requirements

```bash
pip install pandas matplotlib pillow
```

**Note:** `tkinter` is usually included with Python. If not:
- **Ubuntu/Debian:** `sudo apt-get install python3-tk`
- **macOS:** Included with Python
- **Windows:** Included with Python

## Running the Application

### Option 1: Using main.py (Recommended - Modular Version)
```bash
python3 main.py
```

### Option 2: Using original file
```bash
python3 "Python Code"
```

## Benefits of Modular Structure

### Before (One 2,500+ line file)
- ❌ Hard to find specific code
- ❌ Difficult to add new tabs
- ❌ Everything mixed together
- ❌ Hard to maintain

### After (Organized modules)
- ✅ Each tab in its own file
- ✅ Easy to add new features
- ✅ Clear organization
- ✅ Easy to maintain and debug
- ✅ Reusable components

## Adding a New Tab

1. Create a new file in `powertech_tools/tabs/` (e.g., `export_tab.py`)
2. Define a `build_tab(parent, app)` function
3. Import it in `powertech_tools/tabs/__init__.py`
4. Add it to `app.py`:

```python
# In app.py __init__ method:
self.tab_export = ttk.Frame(self.nb)
self.nb.add(self.tab_export, text="  6) EXPORT  ")
build_export_tab(self.tab_export, self)
```

## Customization

### Change Theme Colors
Edit `powertech_tools/config/theme.py`:
```python
class PowertechTheme:
    PRIMARY = "#1e3a5f"      # Change this
    ACCENT = "#3182ce"       # And this
    # ...
```

### Add Company Logo
In `powertech_tools/config/theme.py`, paste your base64-encoded logo:
```python
POWERTECH_LOGO_BASE64 = """
YOUR_BASE64_STRING_HERE
"""
```

## Module Reference

### `powertech_tools.config.theme`
- `PowertechTheme` - Color scheme and fonts
- `apply_powertech_theme()` - Apply theme to app
- `POWERTECH_LOGO_BASE64` - Company logo

### `powertech_tools.utils.helpers`
- `natural_sort_key()` - Sort with numbers
- `safe_float()` / `safe_int()` - Safe conversions
- `make_unique_names()` - Handle duplicate names

### `powertech_tools.utils.file_parser`
- `load_table_allow_duplicate_headers()` - Load data files
- `read_headers_only()` - Extract headers
- `detect_delimiter()` - Auto-detect delimiters

### `powertech_tools.data.loader`
- `merge_selected_files()` - Merge multiple files

### `powertech_tools.data.processor`
- `compute_maxmin_template()` - Calculate min/max
- `parse_time_to_seconds()` - Time parsing
- `stream_file_means()` - Calculate averages
- `stream_file_duration_seconds()` - Get duration
- `stream_ptank_initial_ramp_stats()` - Ramp analysis

### `powertech_tools.data.validator`
- `validate_maxmin_file()` - Validate against limits

### `powertech_tools.tabs.*`
Each tab module exports a `build_tab(parent, app)` function:
- `build_merge_tab()` - File merging interface
- `build_maxmin_tab()` - Max/min analysis interface
- `build_plot_tab()` - Data plotting interface
- `build_avg_tab()` - Cycle averages interface
- `build_validation_tab()` - Validation interface

## Support

For issues or questions, contact Powertech.

## Version History

- **v4.4 (2026-01-16)** - Modular refactor with organized structure
- Previous versions - See original "Python Code" file
