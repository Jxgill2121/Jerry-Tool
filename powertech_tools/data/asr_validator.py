# ASR (Accelerated Stress Rupture) validation utilities
# Calculates cumulative time within temperature bands for tank testing

from typing import Dict, List, Tuple, Optional
import pandas as pd
import numpy as np


def validate_asr_temperature(
    df: pd.DataFrame,
    time_col: str,
    temp_col: str,
    temp_min: float,
    temp_max: float,
    time_unit: str = "seconds"
) -> Tuple[Dict, pd.DataFrame]:
    """
    Validate ASR test data by calculating cumulative time within temperature band.
    Optimized for large datasets using vectorized numpy operations.
    """
    # Get numpy arrays for speed
    time_values = pd.to_numeric(df[time_col], errors='coerce').values
    temp_values = pd.to_numeric(df[temp_col], errors='coerce').values

    # Calculate in_band mask (vectorized)
    in_band = (temp_values >= temp_min) & (temp_values <= temp_max)

    # Calculate time deltas (vectorized)
    time_deltas = np.diff(time_values, prepend=time_values[0] if len(time_values) > 0 else 0)
    time_deltas = np.maximum(time_deltas, 0)  # No negative deltas
    time_deltas[0] = 0  # First point has no delta

    # Calculate totals (vectorized)
    time_in_band = np.sum(time_deltas[in_band])
    time_out_band = np.sum(time_deltas[~in_band])
    total_duration = np.sum(time_deltas)

    # If total duration is 0, estimate from time span
    if total_duration == 0 and len(time_values) > 1:
        total_duration = time_values[-1] - time_values[0]
        n_in_band = np.sum(in_band)
        n_total = len(in_band)
        if n_total > 0:
            time_in_band = total_duration * (n_in_band / n_total)
            time_out_band = total_duration - time_in_band

    # Find excursions using vectorized operations
    # Excursion starts when in_band transitions from True to False
    in_band_shifted = np.roll(in_band, 1)
    in_band_shifted[0] = True  # Assume starts in band
    excursion_starts = (~in_band) & in_band_shifted
    excursion_ends = in_band & (~in_band_shifted)

    excursion_count = int(np.sum(excursion_starts))

    # Build excursion list (limit to first 100 for performance)
    excursions = []
    start_indices = np.where(excursion_starts)[0]
    end_indices = np.where(excursion_ends)[0]

    for i, start_idx in enumerate(start_indices[:100]):
        # Find matching end
        matching_ends = end_indices[end_indices > start_idx]
        if len(matching_ends) > 0:
            end_idx = matching_ends[0]
        else:
            end_idx = len(time_values) - 1

        exc_temps = temp_values[start_idx:end_idx]
        excursions.append({
            'start_time': float(time_values[start_idx]),
            'end_time': float(time_values[end_idx]),
            'duration': float(time_values[end_idx] - time_values[start_idx]),
            'min_temp': float(np.min(exc_temps)) if len(exc_temps) > 0 else None,
            'max_temp': float(np.max(exc_temps)) if len(exc_temps) > 0 else None,
        })

    # Calculate statistics (vectorized)
    valid_temps = temp_values[~np.isnan(temp_values)]
    in_band_temps = temp_values[in_band & ~np.isnan(temp_values)]
    temp_stats = {
        'min': float(np.min(valid_temps)) if len(valid_temps) > 0 else 0,
        'max': float(np.max(valid_temps)) if len(valid_temps) > 0 else 0,
        'mean': float(np.mean(valid_temps)) if len(valid_temps) > 0 else 0,
        'std': float(np.std(valid_temps)) if len(valid_temps) > 0 else 0,
        'in_band_mean': float(np.mean(in_band_temps)) if len(in_band_temps) > 0 else None,
    }

    # Create minimal detail_df (only if needed for export)
    detail_df = pd.DataFrame({
        'Time': time_values,
        'Temperature': temp_values,
        'In_Band': in_band,
        'Status': np.where(in_band, 'IN BAND', 'OUT OF BAND'),
    })

    # Percentage in band
    percent_in_band = (time_in_band / total_duration * 100) if total_duration > 0 else 0

    # Convert time units if needed
    time_divisor = 1.0
    if time_unit == "minutes":
        time_divisor = 60.0
    elif time_unit == "hours":
        time_divisor = 3600.0

    summary = {
        'total_duration': total_duration / time_divisor,
        'time_in_band': time_in_band / time_divisor,
        'time_out_band': time_out_band / time_divisor,
        'percent_in_band': percent_in_band,
        'percent_out_band': 100 - percent_in_band,
        'excursion_count': int(excursion_count),
        'excursions': excursions,
        'temp_band': (temp_min, temp_max),
        'temp_stats': temp_stats,
        'time_unit': time_unit,
        'data_points': len(df),
    }

    return summary, detail_df


def format_duration(seconds: float, time_unit: str = "auto") -> str:
    """
    Format duration in human-readable form.

    Args:
        seconds: Duration in seconds
        time_unit: "auto", "seconds", "minutes", or "hours"

    Returns:
        Formatted string like "22h 15m 30s" or "1345.5 seconds"
    """
    if time_unit == "auto":
        if seconds >= 3600:
            time_unit = "hours"
        elif seconds >= 60:
            time_unit = "minutes"
        else:
            time_unit = "seconds"

    if time_unit == "hours":
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = seconds % 60
        return f"{hours}h {minutes}m {secs:.1f}s"
    elif time_unit == "minutes":
        minutes = int(seconds // 60)
        secs = seconds % 60
        return f"{minutes}m {secs:.1f}s"
    else:
        return f"{seconds:.2f}s"


def load_asr_data_from_file(filepath: str) -> Tuple[pd.DataFrame, List[str]]:
    """
    Load ASR test data from TXT or CSV file.

    Args:
        filepath: Path to data file

    Returns:
        Tuple of (dataframe, column_names)
    """
    # Try to detect delimiter and skip header rows
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()

    # Find the header row (row with column names)
    header_row = 0
    for i, line in enumerate(lines):
        # Skip empty lines and common header text
        stripped = line.strip().lower()
        if not stripped:
            continue
        if 'powertech' in stripped or 'time step' in stripped or 'cycle test' in stripped:
            continue
        # Check if line looks like data headers
        if '\t' in line or ',' in line:
            header_row = i
            break

    # Determine delimiter
    delimiter = '\t' if '\t' in lines[header_row] else ','

    # Load data
    df = pd.read_csv(
        filepath,
        sep=delimiter,
        skiprows=header_row,
        encoding='utf-8',
        on_bad_lines='skip'
    )

    return df, list(df.columns)
