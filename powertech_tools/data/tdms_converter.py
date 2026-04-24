# TDMS file conversion utilities

import os
from typing import List, Tuple, Dict, Optional
import pandas as pd
import numpy as np
from nptdms import TdmsFile


def read_tdms_structure(filepath: str) -> Tuple[List[str], Dict[str, List[str]]]:
    """
    Read TDMS file structure and return groups and channels.

    Args:
        filepath: Path to TDMS file

    Returns:
        Tuple of (group_names, channel_dict) where channel_dict maps group -> list of channel names
    """
    tdms_file = TdmsFile.read(filepath)

    groups = []
    channels_dict = {}

    for group in tdms_file.groups():
        group_name = group.name
        groups.append(group_name)
        channels_dict[group_name] = [channel.name for channel in group.channels()]

    return groups, channels_dict


def convert_tdms_files_to_cycles(
    filepaths: List[str],
    output_dir: str,
    group_name: str,
    selected_channels: List[str],
    add_time_column: bool = True,
    time_step: float = 0.10,
    cycle_number_column: Optional[str] = None,
    add_datetime_column: bool = True,
    progress_callback=None
) -> List[str]:
    """
    Convert multiple TDMS files to individual cycle TXT files.
    Each TDMS file represents one cycle.

    Args:
        filepaths: List of TDMS file paths to process
        output_dir: Directory to save cycle TXT files
        group_name: Name of the group to extract data from
        selected_channels: List of channel names to include in output
        add_time_column: If True, generate a Time column based on time_step
        time_step: Time interval in seconds between samples (default 0.10)
        cycle_number_column: Optional channel name containing cycle number for labeling
        add_datetime_column: If True, add a DateTime column with actual timestamps
        progress_callback: Optional callback function(current, total, message)

    Returns:
        List of created file paths
    """
    created_files = []
    total_files = len(filepaths)

    for file_idx, filepath in enumerate(filepaths, start=1):
        if progress_callback:
            progress_callback(file_idx, total_files, f"Processing {os.path.basename(filepath)}")

        try:
            # Read TDMS file
            tdms_file = TdmsFile.read(filepath)
            group = tdms_file[group_name]

            # Read selected channels into DataFrame
            data_dict = {}
            skipped_channels = []

            for ch_name in selected_channels:
                if ch_name in [ch.name for ch in group.channels()]:
                    channel = group[ch_name]
                    data = channel[:]

                    # Check if channel has data
                    if hasattr(data, '__len__') and len(data) > 0:
                        data_dict[ch_name] = data
                    else:
                        skipped_channels.append(ch_name)
                else:
                    raise ValueError(f"Channel '{ch_name}' not found in group '{group_name}'")

            # Check if we have any valid channels
            if not data_dict:
                if progress_callback:
                    progress_callback(file_idx, total_files, f"⚠️ Skipping {os.path.basename(filepath)} - all selected channels are empty")
                continue

            # Warn about skipped channels
            if skipped_channels and progress_callback:
                progress_callback(file_idx, total_files, f"⚠️ Skipped empty channels: {', '.join(skipped_channels)}")

            # Channels can have different lengths — pad shorter ones with NaN
            lengths = {ch: len(v) for ch, v in data_dict.items()}
            min_len = min(lengths.values())
            max_len = max(lengths.values())
            if min_len != max_len:
                if progress_callback:
                    mismatched = [f"{ch}({l})" for ch, l in lengths.items() if l != max_len]
                    progress_callback(file_idx, total_files,
                        f"⚠️ Channel length mismatch in {os.path.basename(filepath)}, "
                        f"padding to {max_len} samples. Shorter channels: {', '.join(mismatched)}")
                padded = {}
                for ch, v in data_dict.items():
                    if len(v) < max_len:
                        arr = np.empty(max_len)
                        arr[:len(v)] = v
                        arr[len(v):] = np.nan
                        padded[ch] = arr
                    else:
                        padded[ch] = v
                data_dict = padded

            df = pd.DataFrame(data_dict)

            if len(df) == 0:
                continue  # Skip empty files

            # Track actual time step (for header)
            actual_time_step = time_step
            start_datetime = None
            start_datetime_str = ""

            # Add time column if requested
            if add_time_column:
                # Try to get actual time track from TDMS file
                time_values = None

                # Get time track from first valid channel
                for ch_name in data_dict.keys():
                    try:
                        channel = group[ch_name]
                        time_track = channel.time_track()
                        if time_track is not None and len(time_track) == len(df):
                            time_values = time_track
                            # Get actual time step from TDMS properties
                            if 'wf_increment' in channel.properties:
                                actual_time_step = channel.properties['wf_increment']
                            # Get start datetime
                            if 'wf_start_time' in channel.properties:
                                start_datetime = channel.properties['wf_start_time']
                                # Convert numpy datetime64 UTC → local time string
                                try:
                                    from dateutil.tz import tzlocal
                                    start_datetime_str = str(
                                        pd.Timestamp(start_datetime, tz='UTC')
                                        .tz_convert(tzlocal()).tz_localize(None)
                                    )
                                except Exception:
                                    start_datetime_str = str(
                                        pd.Timestamp(start_datetime, tz='UTC').tz_localize(None)
                                    )
                            break
                    except Exception:
                        continue

                # Fallback: generate synthetic time if no time track found
                if time_values is None:
                    time_values = np.arange(len(df)) * time_step

                df.insert(0, 'Time', time_values)

            # Add DateTime column if requested and we have start time
            if add_datetime_column and start_datetime is not None:
                try:
                    ts_utc = pd.Timestamp(start_datetime, tz='UTC')
                    try:
                        from dateutil.tz import tzlocal
                        start_ts = ts_utc.tz_convert(tzlocal()).tz_localize(None)
                    except Exception:
                        start_ts = ts_utc.tz_localize(None)  # fall back to UTC
                    time_deltas = pd.to_timedelta(df['Time'], unit='s')
                    datetime_values = start_ts + time_deltas
                    df.insert(1, 'DateTime', datetime_values.dt.strftime('%Y-%m-%d %H:%M:%S'))
                except Exception:
                    pass

            # Determine cycle number for output filename
            if cycle_number_column and cycle_number_column in df.columns:
                # Use the cycle number from the data (take first value)
                cycle_num = int(df[cycle_number_column].iloc[0])
            else:
                # Use file index as cycle number
                cycle_num = file_idx

            # Determine output filename
            base_name = os.path.splitext(os.path.basename(filepath))[0]
            out_filename = f"{base_name}_cycle{cycle_num}.txt"
            out_path = os.path.join(output_dir, out_filename)

            # Pull file-level metadata from TDMS
            file_props = tdms_file.properties
            tdms_name   = file_props.get("name", os.path.splitext(os.path.basename(filepath))[0])
            tdms_title  = file_props.get("Title", "")
            tdms_author = file_props.get("Author", "")

            # Write header (compatible with ShowGraph format)
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(f"name\t\n")
                f.write(f"{tdms_name}\t\n")
                if tdms_title:
                    f.write(f"Title\t\n{tdms_title}\t\n")
                if tdms_author:
                    f.write(f"Author\t\n{tdms_author}\t\n")
                f.write(f"Log Rate = {actual_time_step:.6f}\n")
                if start_datetime_str:
                    f.write(f"Start time ={start_datetime_str}\n")
                f.write("\n")
                f.write("\t".join(df.columns) + "\n")
                df.to_csv(f, sep="\t", index=False, header=False, lineterminator="\n")

            created_files.append(out_path)

        except Exception as e:
            raise RuntimeError(f"Error processing {os.path.basename(filepath)}: {e}")

    return created_files
