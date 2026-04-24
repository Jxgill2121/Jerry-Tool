"""
SOC Calculator router - processes H2 tank pressure/temperature data
"""

import csv
import io
import logging
from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Constants ────────────────────────────────────────────────────────────────
P_ATM = 0.10132501
K = 4.1244875687045

TANK_REF = {
    35: 0.0240509828691337,
    45: 0.0292752939546606,
    70: 0.0402115626340416,
    93.1: 0.0483441945692200,
    95: 0.0489483464480364,
}

HEADER_KEYWORDS = {
    "time",
    "temp",
    "tamb",
    "tfuel",
    "ttank",
    "ptank",
    "pressure",
    "press",
    "soc",
    "flow",
    "fout",
}


# ── Core calculation ─────────────────────────────────────────────────────────
def calc_soc(p, t, ref_density):
    P = p + P_ATM
    T = t + 273.15
    if P <= 0 or T <= 0:
        return None

    tau = 100.0 / T
    Z = (
        1
        + 0.0588846 * tau**1.325 * P
        - 0.06136111 * tau**1.87 * P
        - 0.002650473 * tau**2.5 * P**2
        + 0.002731125 * tau**2.8 * P**2
        + 0.001802374 * tau**2.938 * P**2.42
        - 0.001150707 * tau**3.14 * P**2.63
        + 0.00009588528 * tau**3.37 * P**3
        - 0.000000110904 * tau**3.75 * P**4
        + 0.0000000001264403 * tau**4 * P**5
    )
    rho = P / (K * Z * T)
    return rho / ref_density * 100


def find_col(header, keywords):
    for kw in keywords:
        for i, h in enumerate(header):
            if kw in h.lower():
                return i
    return None


def detect_delimiter(lines):
    def score(d):
        counts = [len(l.split(d)) for l in lines if l.strip()]
        return max(counts) if counts else 0

    return max(("\t", ",", ";", "|"), key=score)


# ── API Endpoint ─────────────────────────────────────────────────────────────
@router.post("/process")
async def process_soc_file(file: UploadFile = File(...), tank: str = Form(...)):
    try:
        tank_float = float(tank)
        if tank_float not in TANK_REF:
            return {"error": f"Unknown tank rating: {tank}"}
    except ValueError:
        return {"error": f"Invalid tank rating: {tank}"}

    ref_density = TANK_REF[tank_float]

    try:
        # Read file with encoding fallback
        content = await file.read()
        for enc in ("utf-8-sig", "cp1252", "latin-1"):
            try:
                text = content.decode(enc)
                break
            except UnicodeDecodeError:
                continue
        else:
            raise ValueError("Could not decode file")

        raw_lines = [l.rstrip("\n\r") for l in text.split("\n")]

        # Detect delimiter
        delim = detect_delimiter(raw_lines)

        # Parse rows
        rows = [[c.strip() for c in l.split(delim)] for l in raw_lines]

        # Find header row
        skip = 0
        for i, row in enumerate(rows):
            fields = [f.strip().lower() for f in row if f.strip()]
            if any(f in HEADER_KEYWORDS for f in fields):
                skip = i
                break

        metadata = raw_lines[:skip]
        rows = [r for r in rows[skip:] if any(f for f in r)]

        if not rows:
            raise ValueError("No data rows found")

        header, data = rows[0], rows[1:]

        p_col = find_col(
            header,
            ["ptank", "p_tank", "pressure", "press", "pres", "p_mpa", "mpa"],
        )
        t_col = find_col(
            header, ["ttank", "t_tank", "temperature", "temp", "t_c", "celsius"]
        )

        if p_col is None or t_col is None:
            raise ValueError(f"Could not detect pressure/temperature columns")

        # Process data
        n_cols = len(header)
        results = []
        errors = 0

        for row in data:
            row = [c.strip() for c in row]
            row = row[:n_cols] + [""] * max(0, n_cols - len(row))

            try:
                p = float(row[p_col])
                t = float(row[t_col])
                soc = calc_soc(p, t, ref_density)
                results.append(row + [f"{soc:.4f}" if soc is not None else ""])
            except (ValueError, IndexError):
                results.append(row + [""])
                errors += 1

        # Generate output file
        output = io.StringIO()

        # Write metadata
        for line in metadata:
            output.write(line + "\n")

        # Write CSV
        writer = csv.writer(output, delimiter=delim)
        writer.writerow(header + [f"SOC_{tank_float}MPa"])
        writer.writerows(results)

        output_str = output.getvalue()
        output_bytes = output_str.encode("utf-8")

        return StreamingResponse(
            io.BytesIO(output_bytes),
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="{file.filename}"'
            },
        )

    except Exception as e:
        logger.error(f"SOC processing error: {e}")
        raise ValueError(f"Processing failed: {str(e)}")
