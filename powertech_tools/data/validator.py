# Data validation utilities

from typing import Dict, Tuple

import pandas as pd


def validate_maxmin_file(df: pd.DataFrame, limits: Dict, cycle_col: str) -> Tuple[pd.DataFrame, Dict]:
    """
    Validate max/min data against specified limits.

    Checks each cycle's min and max values against configured limits and reports violations.

    Args:
        df: DataFrame with max/min data (columns should follow pattern: variable (Min), variable (Max))
        limits: Dictionary mapping variable names to limit specifications
                Format: {var_name: {"min_lower": float, "min_upper": float,
                                    "max_lower": float, "max_upper": float}}
        cycle_col: Name of the cycle column

    Returns:
        Tuple of (results_df, summary_dict) where:
        - results_df contains columns: Cycle, Status, Violations, Row_Index
        - summary_dict contains: total_cycles, passed_cycles, failed_cycles,
                                pass_rate, violation_by_variable

    Example:
        limits = {
            "Ptank": {"min_lower": 0.0, "min_upper": 10.0,
                      "max_lower": 80.0, "max_upper": 100.0}
        }
        results_df, summary = validate_maxmin_file(df, limits, "Cycle")
    """
    results = []
    total_violations = 0
    violation_details: Dict[str, int] = {}

    for idx, row in df.iterrows():
        cycle = row.get(cycle_col, idx)
        violations = []

        for var_name, lim in limits.items():
            min_col = f"{var_name} (Min)"
            max_col = f"{var_name} (Max)"

            min_val = pd.to_numeric(row.get(min_col, None), errors="coerce")
            max_val = pd.to_numeric(row.get(max_col, None), errors="coerce")

            min_lower = lim.get("min_lower")
            min_upper = lim.get("min_upper")
            max_lower = lim.get("max_lower")
            max_upper = lim.get("max_upper")

            if pd.notna(min_val):
                if min_lower is not None and min_val < min_lower:
                    violations.append(f"{var_name} Min={min_val:.3f} < {min_lower:.3f}")
                    violation_details[var_name] = violation_details.get(var_name, 0) + 1
                elif min_upper is not None and min_val > min_upper:
                    violations.append(f"{var_name} Min={min_val:.3f} > {min_upper:.3f}")
                    violation_details[var_name] = violation_details.get(var_name, 0) + 1

            if pd.notna(max_val):
                if max_lower is not None and max_val < max_lower:
                    violations.append(f"{var_name} Max={max_val:.3f} < {max_lower:.3f}")
                    violation_details[var_name] = violation_details.get(var_name, 0) + 1
                elif max_upper is not None and max_val > max_upper:
                    violations.append(f"{var_name} Max={max_val:.3f} > {max_upper:.3f}")
                    violation_details[var_name] = violation_details.get(var_name, 0) + 1

        if violations:
            total_violations += 1

        status = "PASS" if not violations else "FAIL"
        results.append({
            "Cycle": cycle,
            "Status": status,
            "Violations": " | ".join(violations) if violations else "",
            "Row_Index": idx
        })

    results_df = pd.DataFrame(results)

    summary = {
        "total_cycles": len(df),
        "passed_cycles": len(results_df[results_df["Status"] == "PASS"]),
        "failed_cycles": total_violations,
        "pass_rate": (len(results_df[results_df["Status"] == "PASS"]) / len(df) * 100) if len(df) > 0 else 0,
        "violation_by_variable": violation_details
    }

    return results_df, summary
