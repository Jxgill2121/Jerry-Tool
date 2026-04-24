import { useState } from "react";
import api, { downloadBlob } from "../api/client";
import FileDropzone from "../components/FileDropzone";
import StatusBanner from "../components/StatusBanner";
import TabDescription from "../components/TabDescription";

interface ChPreview { unit:string; samples:number[]; min:number|null; max:number|null; mean:number|null; count:number; }
interface Structure {
  groups: string[];
  channels: Record<string, string[]>;
  filenames: string[];
  preview: Record<string, Record<string, ChPreview>>;
}

export default function MergeTab() {
  const [files, setFiles]              = useState<File[]>([]);
  const [structure, setStructure]      = useState<Structure | null>(null);
  const [selectedGroup, setGroup]      = useState("");
  const [selectedChs, setSelectedChs] = useState<Record<string, boolean>>({});
  const [status, setStatus]            = useState<{type:"info"|"success"|"error";msg:string}|null>(null);
  const [loading, setLoading]          = useState(false);

  // Concatenate TXT state
  const [catFiles, setCatFiles]       = useState<File[]>([]);
  const [catTimeCol, setCatTimeCol]   = useState("Time");
  const [catName, setCatName]         = useState("merged.txt");
  const [catLoading, setCatLoading]   = useState(false);

  const loadStructure = async (dropped: File[]) => {
    setFiles(dropped); setStructure(null); setStatus(null);
    if (!dropped.length) return;
    setLoading(true);
    try {
      const fd = new FormData();
      for (const f of dropped) fd.append("files", f);
      const res = await api.post("/merge/structure", fd);
      const s: Structure = res.data;
      setStructure(s);
      const grp = s.groups[0] ?? "";
      setGroup(grp);
      const chs: Record<string, boolean> = {};
      for (const ch of (s.channels[grp] ?? [])) chs[ch] = true;
      setSelectedChs(chs);
      setStatus({ type: "success", msg: `${dropped.length} file(s) loaded · ${s.groups.length} group(s)` });
    } catch (e: unknown) {
      setStatus({ type: "error", msg: String((e as {response?:{data?:{detail?:string}}}).response?.data?.detail ?? e) });
    } finally { setLoading(false); }
  };

  const onGroupChange = (g: string) => {
    setGroup(g);
    const chs: Record<string, boolean> = {};
    for (const ch of (structure?.channels[g] ?? [])) chs[ch] = true;
    setSelectedChs(chs);
  };

  const toggleCh = (ch: string) => setSelectedChs((p) => ({ ...p, [ch]: !p[ch] }));

  const convert = async () => {
    const chosen = Object.entries(selectedChs).filter(([,v])=>v).map(([k])=>k);
    if (!chosen.length) { setStatus({type:"error",msg:"Select at least one channel"}); return; }
    setLoading(true); setStatus({type:"info",msg:"Converting…"});
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      fd.append("group_name", selectedGroup);
      fd.append("selected_channels", JSON.stringify(chosen));
      fd.append("add_time_column", "true");
      fd.append("add_datetime_column", "true");
      const res = await api.post("/merge/convert", fd, { responseType: "blob" });
      downloadBlob(res.data, "cycle_files.zip");
      setStatus({type:"success",msg:"Download started — cycle_files.zip"});
    } catch (e: unknown) {
      setStatus({type:"error",msg:String((e as {response?:{data?:{detail?:string}}}).response?.data?.detail ?? e)});
    } finally { setLoading(false); }
  };

  const channels = structure?.channels[selectedGroup] ?? [];

  return (
    <div className="max-w-4xl space-y-6">
      <TabDescription
        title="TDMS → Cycle Files"
        summary="Converts raw TDMS data acquisition files (from LabVIEW or similar DAQ systems) into individual cycle TXT files that are compatible with ShowGraph and Jerry's other analysis tools."
        details={[
          "Each TDMS file you upload is treated as one test cycle. The tool reads groups, channels, timestamps, and metadata directly from the TDMS file structure.",
          "Select which data group and channels to export. A preview of each channel (min, max, mean, sample count, units) is shown so you can confirm you have the right data before converting.",
          "Time and DateTime columns are added automatically — time comes from the TDMS time track and dates are converted from UTC to your local timezone.",
          "Output files use the ShowGraph-compatible header format (name, Log Rate, Start time) and are bundled into a ZIP for download.",
          "The Concatenate section at the bottom joins multiple cycle TXT files into a single continuous file, offsetting time values so they run without gaps — useful when you want to analyze an entire test campaign as one dataset.",
        ]}
      />

      <section className="bg-surface rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Step 1 · Upload TDMS Files</h3>
        <FileDropzone onFiles={loadStructure} accept={["tdms"]} current={files.map(f=>f.name)} label="Drop .tdms files here" />
      </section>

      {structure && (
        <>
          <section className="bg-surface rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Step 2 · Select Channels</h3>

            {structure.groups.length > 1 && (
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-400 w-20">Group</label>
                <select value={selectedGroup} onChange={(e)=>onGroupChange(e.target.value)}
                  className="bg-surface2 border border-border rounded px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500">
                  {structure.groups.map(g=><option key={g}>{g}</option>)}
                </select>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={()=>setSelectedChs(Object.fromEntries(channels.map(c=>[c,true])))}
                className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded">Select All</button>
              <button onClick={()=>setSelectedChs(Object.fromEntries(channels.map(c=>[c,false])))}
                className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded">Deselect All</button>
            </div>

            <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
              {channels.map(ch => {
                const p = structure.preview?.[selectedGroup]?.[ch];
                const checked = !!selectedChs[ch];
                return (
                  <div key={ch}
                    onClick={()=>toggleCh(ch)}
                    className={`flex items-start gap-3 rounded-lg px-3 py-2.5 cursor-pointer border transition-colors
                      ${checked ? "bg-gray-800 border-blue-600" : "bg-surface border-border opacity-60"}`}>
                    <input type="checkbox" checked={checked} readOnly className="mt-0.5 accent-blue-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-100">{ch}</span>
                        {p?.unit && <span className="text-xs text-gray-500">{p.unit}</span>}
                        {p && <span className="text-xs text-gray-500 ml-auto">{p.count.toLocaleString()} pts</span>}
                      </div>
                      {p && (
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-400">
                          {p.min!=null && <span>min <span className="text-gray-200">{p.min}</span></span>}
                          {p.mean!=null && <span>avg <span className="text-gray-200">{p.mean}</span></span>}
                          {p.max!=null && <span>max <span className="text-gray-200">{p.max}</span></span>}
                          <span className="text-gray-600">samples: [{p.samples.slice(0,3).join(", ")}…]</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <button onClick={convert} disabled={loading}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-medium text-sm transition-colors">
            {loading ? "Converting…" : "Convert & Download ZIP"}
          </button>
        </>
      )}

      {/* ── Concatenate TXT section ─────────────────────────────────── */}
      <div className="border-t border-gray-700 pt-6 space-y-4">
        <h2 className="text-xl font-semibold text-gray-100">Concatenate TXT Files</h2>
        <p className="text-xs text-gray-500">Join multiple converted TXT files into one continuous file. Time is offset automatically so it runs without gaps.</p>

        <section className="bg-surface rounded-xl p-5 space-y-4">
          <FileDropzone onFiles={setCatFiles} accept={["txt","log","dat","csv"]} current={catFiles.map(f=>f.name)}
            label="Drop TXT files here (2 or more, in order)" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Time column name</label>
              <input value={catTimeCol} onChange={e=>setCatTimeCol(e.target.value)}
                className="w-full bg-surface2 border border-border rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Output filename</label>
              <input value={catName} onChange={e=>setCatName(e.target.value)}
                className="w-full bg-surface2 border border-border rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500" />
            </div>
          </div>

          <button
            disabled={catFiles.length < 2 || catLoading}
            onClick={async () => {
              setCatLoading(true);
              try {
                const fd = new FormData();
                for (const f of catFiles) fd.append("files", f);
                fd.append("time_col", catTimeCol);
                fd.append("output_name", catName);
                const res = await api.post("/merge/concatenate-txt", fd, { responseType: "blob" });
                downloadBlob(res.data, catName.endsWith(".txt") ? catName : catName + ".txt");
                setStatus({ type: "success", msg: `Merged ${catFiles.length} files → ${catName}` });
              } catch (e: unknown) {
                setStatus({ type: "error", msg: String((e as {response?:{data?:{detail?:string}}}).response?.data?.detail ?? e) });
              } finally { setCatLoading(false); }
            }}
            className="px-6 py-2.5 bg-green-700 hover:bg-green-600 disabled:opacity-50 rounded-lg font-medium text-sm transition-colors">
            {catLoading ? "Merging…" : `Merge & Download (${catFiles.length} files)`}
          </button>
        </section>
      </div>

      {status && <StatusBanner type={status.type} message={status.msg} />}
    </div>
  );
}
