import { useState } from "react";
import api, { downloadBlob } from "../api/client";
import FileDropzone from "../components/FileDropzone";
import StatusBanner from "../components/StatusBanner";
import TabDescription from "../components/TabDescription";

export default function OpmCobraLinkerTab() {
  const [cobraFiles, setCobraFiles] = useState<File[]>([]);
  const [unicycleFiles, setUnicycleFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "info" | "success" | "error"; msg: string } | null>(null);

  const process = async () => {
    if (!cobraFiles.length || !unicycleFiles.length) {
      setStatus({ type: "error", msg: "Upload both Cobra and Unicycle files first." });
      return;
    }
    if (cobraFiles.length !== unicycleFiles.length) {
      setStatus({
        type: "error",
        msg: `File count mismatch: ${cobraFiles.length} Cobra vs ${unicycleFiles.length} Unicycle — counts must match.`,
      });
      return;
    }
    setLoading(true);
    setStatus({ type: "info", msg: "Processing…" });
    try {
      const fd = new FormData();
      for (const f of cobraFiles) fd.append("cobra_files", f);
      for (const f of unicycleFiles) fd.append("unicycle_files", f);
      const res = await api.post("/opm-cobra/process", fd, { responseType: "blob" });
      const cd: string = res.headers["content-disposition"] ?? "";
      const match = cd.match(/filename="?([^"]+)"?/);
      const filename =
        match
          ? match[1]
          : cobraFiles.length === 1
            ? `${cobraFiles[0].name.replace(/\.[^.]+$/, "")}_with_temp.csv`
            : "processed_cycles.zip";
      downloadBlob(res.data, filename);
      setStatus({ type: "success", msg: `Done — downloaded ${filename}` });
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      setStatus({ type: "error", msg: detail ?? String(e) });
    } finally {
      setLoading(false);
    }
  };

  const countMismatch =
    cobraFiles.length > 0 &&
    unicycleFiles.length > 0 &&
    cobraFiles.length !== unicycleFiles.length;

  return (
    <div className="max-w-3xl space-y-6">
      <TabDescription
        title="OPM Cobra ↔ Unicycle Linker"
        summary="Aligns Cobra and Unicycle data files by their cycle sync signal, interpolates tank temperature (Ttank) from the Unicycle's V3 resistance channel, and outputs a merged CSV."
        details={[
          "Upload one Cobra .txt file per Unicycle .txt file — files are paired in the order listed.",
          "The tool locates the first cycle-sync signal rise (≥ 0.9) in each file and uses it as the time-alignment anchor.",
          "V3 resistance readings from the Unicycle file are interpolated onto the Cobra file's timeline.",
          "Resistance values are converted to temperature (°C) via the built-in PL-06159.02 lookup table.",
          "Only rows where cycle sync ≥ 0.9 are kept in the output (test-active rows only).",
          "Single pair → downloads a CSV. Multiple pairs → downloads a ZIP containing one CSV per pair.",
        ]}
      />

      <section className="bg-surface rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Step 1 · Upload Cobra Files</h3>
        <FileDropzone
          onFiles={setCobraFiles}
          accept={["txt"]}
          current={cobraFiles.map(f => f.name)}
        />
      </section>

      <section className="bg-surface rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Step 2 · Upload Unicycle Files</h3>
        <p className="text-xs text-gray-500">
          Upload in the same order as the Cobra files above — pairing is positional.
        </p>
        <FileDropzone
          onFiles={setUnicycleFiles}
          accept={["txt"]}
          current={unicycleFiles.map(f => f.name)}
        />
      </section>

      {countMismatch && (
        <p className="text-xs text-yellow-400">
          ⚠ {cobraFiles.length} Cobra file(s) and {unicycleFiles.length} Unicycle file(s) — counts must match.
        </p>
      )}

      <button
        onClick={process}
        disabled={loading || !cobraFiles.length || !unicycleFiles.length || countMismatch}
        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-medium text-sm"
      >
        {loading ? "Processing…" : "PROCESS & DOWNLOAD"}
      </button>

      {status && <StatusBanner type={status.type} message={status.msg} />}
    </div>
  );
}
