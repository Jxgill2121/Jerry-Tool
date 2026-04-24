import { useState } from "react";
import api, { downloadBlob } from "../api/client";
import FileDropzone from "../components/FileDropzone";
import StatusBanner from "../components/StatusBanner";
import TabDescription from "../components/TabDescription";

type Mode = "multiple" | "single_cycle" | "single_template";

export default function MaxMinTab() {
  const [files, setFiles]     = useState<File[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mode, setMode]       = useState<Mode>("multiple");
  const [timeCol, setTimeCol] = useState("");
  const [cycleCol, setCycleCol] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus]   = useState<{type:"info"|"success"|"error";msg:string}|null>(null);

  const loadFiles = async (dropped: File[]) => {
    setFiles(dropped);
    if (!dropped.length) return;
    try {
      const fd = new FormData();
      for (const f of dropped) fd.append("files", f);
      const res = await api.post("/maxmin/headers", fd);
      const hdrs: string[] = res.data.headers;
      setHeaders(hdrs);
      const hl = hdrs.map(h=>h.toLowerCase());
      setTimeCol(hdrs[hl.findIndex(h=>h.includes("time"))] ?? hdrs[0] ?? "");
      setCycleCol(hdrs[hl.findIndex(h=>h.includes("cycle"))] ?? "");
      setStatus({type:"success",msg:`${dropped.length} file(s) · ${hdrs.length} columns`});
    } catch (e: unknown) {
      setStatus({type:"error", msg: String((e as {response?:{data?:{detail?:string}}}).response?.data?.detail ?? e)});
    }
  };

  const process = async () => {
    setLoading(true);
    setStatus({type:"info",msg:"Processing…"});
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      fd.append("mode", mode);
      fd.append("time_col", timeCol);
      fd.append("cycle_col", cycleCol);
      const res = await api.post("/maxmin/process", fd, {responseType:"blob"});
      downloadBlob(res.data, "maxmin_output.txt");
      setStatus({type:"success",msg:"Downloaded maxmin_output.txt"});
    } catch (e: unknown) {
      setStatus({type:"error",msg:String((e as {response?:{data?:{detail?:string}}}).response?.data?.detail ?? e)});
    } finally { setLoading(false); }
  };

  const modeLabel: Record<Mode,string> = {
    multiple:          "Multiple files (one cycle per file)",
    single_cycle:      "Single file with Cycle column",
    single_template:   "Single file — template mode",
  };

  return (
    <div className="max-w-2xl space-y-6">
      <TabDescription
        title="Max / Min"
        summary="Processes cycle data files and extracts the minimum and maximum value of every selected parameter across each cycle, producing a summary spreadsheet used by the Report Graph Generator and Cylinder Validation tools."
        details={[
          "Upload one or more TXT cycle files. Each file is treated as one cycle, or you can use a single combined file with a cycle-number column.",
          "Three processing modes: Multiple Files (one file per cycle), Single File with Cycle Column (cycle number embedded in the data), or Single File with Template (cycle boundaries detected automatically from a reference parameter like Ptank).",
          "Select your Time column and Cycle column so the tool can correctly segment and label each cycle in the output.",
          "The output is an Excel file where each row is one cycle and each parameter appears as two columns — Min and Max — in the exact paired format expected by the Report Graph Generator.",
          "This is typically the first processing step after converting TDMS files to cycles.",
        ]}
      />

      <section className="bg-surface rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Step 1 · Upload Cycle Files</h3>
        <FileDropzone onFiles={loadFiles} accept={["txt","log","dat","csv"]} current={files.map(f=>f.name)} />
      </section>

      {headers.length > 0 && (
        <>
          <section className="bg-surface rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Step 2 · Mode</h3>
            {(Object.keys(modeLabel) as Mode[]).map(m=>(
              <label key={m} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input type="radio" name="mode" value={m} checked={mode===m} onChange={()=>setMode(m)} className="accent-blue-500" />
                {modeLabel[m]}
              </label>
            ))}
          </section>

          <section className="bg-surface rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Step 3 · Columns</h3>
            <div className="flex items-center gap-3">
              <label className="w-28 text-sm text-gray-400">Time column</label>
              <ColSelect headers={headers} value={timeCol} onChange={setTimeCol} />
            </div>
            {mode !== "multiple" && (
              <div className="flex items-center gap-3">
                <label className="w-28 text-sm text-gray-400">Cycle column</label>
                <ColSelect headers={headers} value={cycleCol} onChange={setCycleCol} allowEmpty />
              </div>
            )}
          </section>

          <button onClick={process} disabled={loading}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-medium text-sm">
            {loading ? "Processing…" : "Generate Max/Min"}
          </button>
        </>
      )}

      {status && <StatusBanner type={status.type} message={status.msg} />}
    </div>
  );
}

function ColSelect({headers,value,onChange,allowEmpty}:{headers:string[];value:string;onChange:(v:string)=>void;allowEmpty?:boolean}) {
  return (
    <select value={value} onChange={e=>onChange(e.target.value)}
      className="bg-surface2 border border-border rounded px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500 min-w-40">
      {allowEmpty && <option value="">— none —</option>}
      {headers.map(h=><option key={h}>{h}</option>)}
    </select>
  );
}
