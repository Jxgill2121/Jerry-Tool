import { useState } from "react";
import api, { downloadBlob } from "../api/client";
import FileDropzone from "../components/FileDropzone";
import StatusBanner from "../components/StatusBanner";
import TabDescription from "../components/TabDescription";

export default function AvgTab() {
  const [files, setFiles]   = useState<File[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [selected, setSelected] = useState<Record<string,boolean>>({});
  const [timeCol, setTimeCol] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{type:"info"|"success"|"error";msg:string}|null>(null);

  const loadFiles = async (dropped: File[]) => {
    setFiles(dropped);
    if (!dropped.length) return;
    try {
      const fd = new FormData();
      for (const f of dropped) fd.append("files", f);
      const res = await api.post("/avg/headers", fd);
      const hdrs: string[] = res.data.headers;
      setHeaders(hdrs);
      const hl = hdrs.map(h=>h.toLowerCase());
      const tc = hdrs[hl.findIndex(h=>h.includes("time"))] ?? hdrs[0] ?? "";
      setTimeCol(tc);
      const sel: Record<string,boolean> = {};
      for (const h of hdrs) sel[h] = h !== tc;
      setSelected(sel);
      setStatus({type:"success",msg:`${dropped.length} file(s) · ${hdrs.length} columns`});
    } catch(e: unknown){
      setStatus({type:"error",msg:String((e as {response?:{data?:{detail?:string}}}).response?.data?.detail??e)});
    }
  };

  const process = async () => {
    const cols = Object.entries(selected).filter(([,v])=>v).map(([k])=>k);
    if (!cols.length){setStatus({type:"error",msg:"Select at least one column"});return;}
    setLoading(true);setStatus({type:"info",msg:"Computing averages…"});
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      fd.append("selected_cols", JSON.stringify(cols));
      fd.append("time_col", timeCol);
      const res = await api.post("/avg/process", fd, {responseType:"blob"});
      downloadBlob(res.data,"cycle_averages.xlsx");
      setStatus({type:"success",msg:"Downloaded cycle_averages.xlsx"});
    } catch(e: unknown){
      setStatus({type:"error",msg:String((e as {response?:{data?:{detail?:string}}}).response?.data?.detail??e)});
    } finally {setLoading(false);}
  };

  const toggleAll = (v:boolean)=>setSelected(Object.fromEntries(headers.map(h=>[h,v])));

  return (
    <div className="max-w-2xl space-y-6">
      <TabDescription
        title="Generate Averages"
        summary="Generates averages for each column in a cycle"
        details={[
          "Upload one or more TXT cycle files. Each file is treated as one test cycle.",
          "Identify the Time column so it can be excluded from averaging. All other selected columns will be averaged.",
          "Use the checkboxes to choose which parameters to include. Select All / Deselect All buttons are available for quick selection.",
          "The exported Excel file contains the mean, minimum, maximum, and standard deviation for each selected parameter across all cycles.",
          "Averages are computed per-column across all rows of all files combined, giving you a single row of summary statistics per parameter.",
        ]}
      />

      <section className="bg-surface rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Step 1 · Upload Cycle Files</h3>
        <FileDropzone onFiles={loadFiles} accept={["txt","log","dat","csv"]} current={files.map(f=>f.name)} />
      </section>

      {headers.length > 0 && (
        <>
          <section className="bg-surface rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Step 2 · Select Columns to Average</h3>
            <div className="flex items-center gap-3 mb-1">
              <label className="text-sm text-gray-400 w-24">Time col</label>
              <select value={timeCol} onChange={e=>setTimeCol(e.target.value)}
                className="bg-surface2 border border-border rounded px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500">
                {headers.map(h=><option key={h}>{h}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>toggleAll(true)} className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded">Select All</button>
              <button onClick={()=>toggleAll(false)} className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded">Deselect All</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {headers.map(h=>(
                <label key={h} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={!!selected[h]} onChange={e=>setSelected(p=>({...p,[h]:e.target.checked}))} className="accent-blue-500" />
                  {h}
                </label>
              ))}
            </div>
          </section>

          <button onClick={process} disabled={loading}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-medium text-sm">
            {loading?"Computing…":"Export Averages Excel"}
          </button>
        </>
      )}
      {status && <StatusBanner type={status.type} message={status.msg} />}
    </div>
  );
}
