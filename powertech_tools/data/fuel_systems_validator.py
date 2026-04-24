# Fuel Systems validation engine

import os
from typing import List, Dict, Tuple, Optional
import pandas as pd
import numpy as np


def detect_fill_boundaries(
    df: pd.DataFrame,
    time_col: str,
    ptank_col: str,
    threshold: float = 2.0,
    end_mode: str = "Ptank",
    soc_col: Optional[str] = None,
    soc_threshold: float = 100.0
) -> Tuple[int, int, float]:
    """
    Detect fill boundaries using Ptank for start and Ptank or SOC for end.

    Fill start: Walk backward from Ptank peak to find where Ptank crosses below
    the rapid spike marker (3 MPa), indicating the start of the fill.

    Fill end:
      - "Ptank" mode: Ptank crosses below threshold after peak.
      - "SOC" mode: SOC exceeds soc_threshold after peak.

    Args:
        df: DataFrame with cycle data
        time_col: Name of time column
        ptank_col: Name of Ptank column
        threshold: Ptank threshold in MPa (default 2.0)
        end_mode: "Ptank" or "SOC" for determining end of fill
        soc_col: Name of SOC column (required if end_mode is "SOC")
        soc_threshold: SOC percentage threshold for end of fill (default 100.0)

    Returns:
        Tuple of (start_idx, end_idx, peak_time)
    """
    # Convert to numeric
    ptank = pd.to_numeric(df[ptank_col], errors='coerce')

    # Convert time column - handle both numeric and datetime formats
    try:
        time = pd.to_numeric(df[time_col], errors='coerce')
        if time.isna().all():
            time = pd.to_datetime(df[time_col], errors='coerce')
            if not time.isna().all():
                time = (time - time.iloc[0]).dt.total_seconds()
    except Exception:
        time = pd.to_numeric(df[time_col], errors='coerce')

    # Find peak
    peak_idx = ptank.idxmax()
    peak_value = ptank.iloc[peak_idx]
    peak_time = time.iloc[peak_idx]

    if pd.isna(peak_value):
        raise ValueError("Could not find valid Ptank peak")

    # Walk backwards to find fill start
    start_idx = peak_idx
    fill_marker = 3.0  # MPa - use 3 MPa to identify rapid fill spike

    for i in range(peak_idx, 0, -1):
        if ptank.iloc[i] < fill_marker and ptank.iloc[i-1] < fill_marker:
            start_idx = i
            break

    # Fallback: if no crossing found, use threshold
    if start_idx == peak_idx:
        for i in range(peak_idx, 0, -1):
            if ptank.iloc[i] <= threshold:
                start_idx = i + 1 if i + 1 < len(df) else i
                break

    # Determine fill end based on mode
    end_idx = peak_idx

    if end_mode == "SOC" and soc_col and soc_col in df.columns:
        # SOC mode: find where SOC exceeds threshold after peak
        soc = pd.to_numeric(df[soc_col], errors='coerce')
        for i in range(peak_idx, len(df)):
            if not pd.isna(soc.iloc[i]) and soc.iloc[i] >= soc_threshold:
                end_idx = i
                break
        # Fallback to Ptank if SOC never reaches threshold
        if end_idx == peak_idx:
            for i in range(peak_idx, len(df) - 1):
                if ptank.iloc[i] > threshold and ptank.iloc[i+1] <= threshold:
                    end_idx = i
                    break
                elif ptank.iloc[i] <= threshold:
                    end_idx = i
                    break
    else:
        # Ptank mode: find where Ptank crosses below threshold
        for i in range(peak_idx, len(df) - 1):
            if ptank.iloc[i] > threshold and ptank.iloc[i+1] <= threshold:
                end_idx = i
                break
            elif ptank.iloc[i] <= threshold:
                end_idx = i
                break

    return start_idx, end_idx, peak_time


def validate_tfuel_timing(
    df: pd.DataFrame,
    time_col: str,
    tfuel_col: str,
    start_idx: int,
    end_idx: int,
    target_temp: float = -30.0,
    time_window: float = 30.0
) -> Tuple[bool, Optional[float], str]:
    """
    Validate that tfuel reaches target temperature within time window from fill start.

    Logic:
      1. Walk forward from fill start looking for tfuel <= target.
      2. If found within the time window, pass.

    Args:
        df: DataFrame with cycle data
        time_col: Name of time column
        tfuel_col: Name of tfuel column
        start_idx: Fill start index
        end_idx: Fill end index
        target_temp: Target temperature (default -30)
        time_window: Time window in seconds (default 30)

    Returns:
        Tuple of (passed, time_to_target, message)
    """
    try:
        time = pd.to_numeric(df[time_col], errors='coerce')
        if time.isna().all():
            time = pd.to_datetime(df[time_col], errors='coerce')
            if not time.isna().all():
                time = (time - time.iloc[0]).dt.total_seconds()
    except Exception:
        time = pd.to_numeric(df[time_col], errors='coerce')

    tfuel = pd.to_numeric(df[tfuel_col], errors='coerce')

    start_time = time.iloc[start_idx]

    # Find first valid start_time if NaN
    if pd.isna(start_time):
        for i in range(start_idx, len(df)):
            if not pd.isna(time.iloc[i]):
                start_time = time.iloc[i]
                break

    if pd.isna(start_time):
        return False, None, "Could not determine fill start time"

    # Step 1: Find when tfuel first reaches target within the time window
    reached_idx = None
    reached_elapsed = None

    for i in range(start_idx, min(end_idx + 1, len(df))):
        current_time = time.iloc[i]
        current_tfuel = tfuel.iloc[i]

        if pd.isna(current_tfuel) or pd.isna(current_time):
            continue

        elapsed = current_time - start_time
        if pd.isna(elapsed):
            continue

        if elapsed > time_window and reached_idx is None:
            min_val = tfuel.iloc[start_idx:i].min()
            return False, None, f"tfuel did not reach {target_temp}°C within {time_window}s window (min: {min_val:.2f}°C)"

        if current_tfuel <= target_temp and reached_idx is None:
            reached_idx = i
            reached_elapsed = elapsed

    if reached_idx is None:
        return False, None, f"tfuel never reached {target_temp}°C during fill"

    if reached_elapsed > time_window:
        return False, reached_elapsed, f"tfuel reached {target_temp}°C at {reached_elapsed:.2f}s (exceeded {time_window}s window)"

    return True, reached_elapsed, f"tfuel reached {target_temp}°C at {reached_elapsed:.2f}s (within {time_window}s window)"


def calculate_avg_ramp_rate(
    df: pd.DataFrame,
    time_col: str,
    ptank_col: str,
    start_idx: int,
    end_idx: int
) -> Tuple[Optional[float], str]:
    """
    Calculate the average pressure ramp rate (MPa/min) during the fill.

    Computed as (Ptank_peak - Ptank_start) / fill_duration_minutes.

    Args:
        df: DataFrame with cycle data
        time_col: Name of time column
        ptank_col: Name of Ptank column
        start_idx: Fill start index
        end_idx: Fill end index

    Returns:
        Tuple of (avg_ramp_mpa_min, message)
    """
    try:
        time = pd.to_numeric(df[time_col], errors='coerce')
        if time.isna().all():
            time = pd.to_datetime(df[time_col], errors='coerce')
            if not time.isna().all():
                time = (time - time.iloc[0]).dt.total_seconds()
    except Exception:
        time = pd.to_numeric(df[time_col], errors='coerce')

    ptank = pd.to_numeric(df[ptank_col], errors='coerce')

    # Find peak within the fill range
    fill_ptank = ptank.iloc[start_idx:end_idx+1]
    peak_local_idx = fill_ptank.idxmax()

    start_time = time.iloc[start_idx]
    peak_time = time.iloc[peak_local_idx]
    start_pressure = ptank.iloc[start_idx]
    peak_pressure = ptank.iloc[peak_local_idx]

    if any(pd.isna(v) for v in [start_time, peak_time, start_pressure, peak_pressure]):
        return None, "Could not compute ramp rate (missing data)"

    duration_s = peak_time - start_time
    if duration_s <= 0:
        return None, "Could not compute ramp rate (zero duration)"

    duration_min = duration_s / 60.0
    delta_p = peak_pressure - start_pressure
    avg_ramp = delta_p / duration_min

    return avg_ramp, f"Avg ramp: {avg_ramp:.2f} MPa/min ({delta_p:.2f} MPa over {duration_min:.2f} min)"


def validate_parameter_bounds(
    df: pd.DataFrame,
    time_col: str,
    start_idx: int,
    end_idx: int,
    param_limits: Dict[str, Dict[str, float]],
    tfuel_col: Optional[str] = None,
    tfuel_window: float = 30.0,
    start_time: Optional[float] = None
) -> List[str]:
    """
    Validate that parameters stay within min/max bounds during fill.

    Special handling for tfuel: bounds only apply AFTER the tfuel_window period.

    Args:
        df: DataFrame with cycle data
        time_col: Name of time column
        start_idx: Fill start index
        end_idx: Fill end index
        param_limits: Dict mapping param name to {'min': value, 'max': value}
        tfuel_col: Name of tfuel column (for special handling)
        tfuel_window: Time window for tfuel timing check (seconds)
        start_time: Fill start time (for tfuel window calculation)

    Returns:
        List of violation messages
    """
    violations = []
    cycle_df = df.iloc[start_idx:end_idx+1]

    for param, limits in param_limits.items():
        if param not in df.columns:
            violations.append(f"{param}: Column not found")
            continue

        values = pd.to_numeric(cycle_df[param], errors='coerce')

        if values.isna().all():
            violations.append(f"{param}: No valid data")
            continue

        # Special handling for tfuel - bounds only apply AFTER the time window
        if param == tfuel_col and start_time is not None:
            try:
                time = pd.to_numeric(df[time_col], errors='coerce')
                if time.isna().all():
                    time = pd.to_datetime(df[time_col], errors='coerce')
                    if not time.isna().all():
                        time = (time - time.iloc[0]).dt.total_seconds()
            except Exception:
                time = pd.to_numeric(df[time_col], errors='coerce')

            cycle_time = time.iloc[start_idx:end_idx+1]
            mask = (cycle_time - start_time) > tfuel_window
            values_after_window = values[mask]

            if values_after_window.empty:
                continue

            param_min = values_after_window.min()
            param_max = values_after_window.max()
        else:
            param_min = values.min()
            param_max = values.max()

        min_limit = limits.get('min')
        max_limit = limits.get('max')

        if min_limit is not None and param_min < min_limit:
            if param == tfuel_col:
                violations.append(f"{param}: Min {param_min:.2f} < {min_limit:.2f} (after {tfuel_window}s window)")
            else:
                violations.append(f"{param}: Min {param_min:.2f} < {min_limit:.2f}")

        if max_limit is not None and param_max > max_limit:
            if param == tfuel_col:
                violations.append(f"{param}: Max {param_max:.2f} > {max_limit:.2f} (after {tfuel_window}s window)")
            else:
                violations.append(f"{param}: Max {param_max:.2f} > {max_limit:.2f}")

    return violations


def validate_fuel_system_file(
    filepath: str,
    time_col: str,
    ptank_col: str,
    tfuel_col: str,
    param_limits: Dict[str, Dict[str, float]],
    ptank_threshold: float = 2.0,
    tfuel_target: float = -30.0,
    tfuel_window: float = 30.0,
    enable_tfuel_check: bool = True,
    end_mode: str = "Ptank",
    soc_col: Optional[str] = None,
    soc_threshold: float = 100.0,
    enable_ramp_check: bool = False,
    ramp_limit: Optional[float] = None
) -> Dict:
    """
    Validate a single fuel system file.

    Args:
        filepath: Path to cycle TXT file
        time_col: Name of time column
        ptank_col: Name of Ptank column
        tfuel_col: Name of tfuel column
        param_limits: Parameter bounds to validate
        ptank_threshold: Ptank threshold for fill detection (MPa)
        tfuel_target: Target tfuel temperature
        tfuel_window: Time window for tfuel check (seconds)
        enable_tfuel_check: Whether to run the tfuel timing check
        end_mode: "Ptank" or "SOC" for fill end detection
        soc_col: SOC column name (for SOC end mode)
        soc_threshold: SOC percentage threshold
        enable_ramp_check: Whether to check average ramp rate
        ramp_limit: Min required avg ramp rate in MPa/min (None = no limit, just report)

    Returns:
        Dict with validation results
    """
    from powertech_tools.utils.file_parser import load_table_allow_duplicate_headers

    try:
        df = load_table_allow_duplicate_headers(filepath)

        # Check required columns exist
        required_cols = [time_col, ptank_col, tfuel_col]
        if end_mode == "SOC" and soc_col:
            required_cols.append(soc_col)

        for col in required_cols:
            if col not in df.columns:
                return {
                    'file': os.path.basename(filepath),
                    'status': 'ERROR',
                    'tfuel_check': False,
                    'tfuel_message': f"Column '{col}' not found",
                    'param_violations': [],
                    'cycle_start_idx': None,
                    'cycle_end_idx': None,
                    'total_points': len(df),
                    'cycle_points': 0,
                    'avg_ramp_rate': None,
                    'ramp_message': '',
                    'ramp_pass': True,
                    'soc_max': None,
                    'soc_reached_100': False,
                    'soc_message': ''
                }

        # Detect fill boundaries
        start_idx, end_idx, peak_time = detect_fill_boundaries(
            df, time_col, ptank_col, ptank_threshold,
            end_mode=end_mode, soc_col=soc_col, soc_threshold=soc_threshold
        )

        # Get fill start time
        time = pd.to_numeric(df[time_col], errors='coerce')
        start_time = time.iloc[start_idx]

        # Tfuel timing check (optional)
        if enable_tfuel_check:
            tfuel_pass, tfuel_time, tfuel_msg = validate_tfuel_timing(
                df, time_col, tfuel_col, start_idx, end_idx, tfuel_target, tfuel_window
            )
        else:
            tfuel_pass = True
            tfuel_time = None
            tfuel_msg = "tfuel timing check disabled"

        # Validate parameter bounds
        param_violations = validate_parameter_bounds(
            df, time_col, start_idx, end_idx, param_limits, tfuel_col, tfuel_window, start_time
        )

        # SOC check — report max SOC during fill
        soc_max = None
        soc_reached_100 = False
        soc_message = ''

        # Check for SOC column in the data (use soc_col if provided, otherwise auto-detect)
        check_soc_col = soc_col
        if not check_soc_col:
            for c in df.columns:
                if c.lower() == 'soc':
                    check_soc_col = c
                    break

        if check_soc_col and check_soc_col in df.columns:
            soc_data = pd.to_numeric(df[check_soc_col].iloc[start_idx:end_idx+1], errors='coerce')
            if not soc_data.isna().all():
                soc_max = float(soc_data.max())
                soc_reached_100 = soc_max >= 100.0
                if soc_reached_100:
                    soc_message = f"SOC reached {soc_max:.1f}% (hit 100%)"
                else:
                    soc_message = f"SOC peaked at {soc_max:.1f}% (did NOT reach 100%)"
            else:
                soc_message = "SOC column has no valid data"
        else:
            soc_message = "No SOC column available"

        # Average ramp rate check
        avg_ramp_rate = None
        ramp_message = ''
        ramp_pass = True

        if enable_ramp_check:
            avg_ramp_rate, ramp_message = calculate_avg_ramp_rate(
                df, time_col, ptank_col, start_idx, end_idx
            )
            if ramp_limit is not None and avg_ramp_rate is not None:
                if avg_ramp_rate < ramp_limit:
                    ramp_pass = False
                    ramp_message += f" — BELOW minimum of {ramp_limit:.2f} MPa/min"
                else:
                    ramp_message += f" — meets minimum of {ramp_limit:.2f} MPa/min"

        # Overall status
        if tfuel_pass and len(param_violations) == 0 and ramp_pass:
            status = 'PASS'
        else:
            status = 'FAIL'

        return {
            'file': os.path.basename(filepath),
            'status': status,
            'tfuel_check': tfuel_pass,
            'tfuel_message': tfuel_msg,
            'param_violations': param_violations,
            'cycle_start_idx': start_idx,
            'cycle_end_idx': end_idx,
            'total_points': len(df),
            'cycle_points': end_idx - start_idx + 1,
            'avg_ramp_rate': avg_ramp_rate,
            'ramp_message': ramp_message,
            'ramp_pass': ramp_pass,
            'soc_max': soc_max,
            'soc_reached_100': soc_reached_100,
            'soc_message': soc_message
        }

    except Exception as e:
        return {
            'file': os.path.basename(filepath),
            'status': 'ERROR',
            'tfuel_check': False,
            'tfuel_message': str(e),
            'param_violations': [],
            'cycle_start_idx': None,
            'cycle_end_idx': None,
            'total_points': 0,
            'cycle_points': 0,
            'avg_ramp_rate': None,
            'ramp_message': '',
            'ramp_pass': True,
            'soc_max': None,
            'soc_reached_100': False,
            'soc_message': ''
        }
