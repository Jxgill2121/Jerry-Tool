import { useState } from "react";
import api, { downloadBlob } from "../api/client";
import FileDropzone from "../components/FileDropzone";
import StatusBanner from "../components/StatusBanner";
import ParamBoundsEditor, { ParamRow } from "../components/ParamBoundsEditor";
import PlotlyChart from "../components/PlotlyChart";
import TabDescription from "../components/TabDescription";

interface FSResult {
  file:string; status:"PASS"|"FAIL"|"ERROR";
  tfuel_check:boolean; tfuel_message:string;
  param_violations:string[];
  cycle_points:number; total_points:number;
  avg_ramp_rate:number|null; ramp_message:string; ramp_pass:boolean;
  soc_max:number|null; soc_reached_100:boolean; soc_message:string;
  cycle_start_idx:number|null; cycle_end_idx:number|null;
}

export default function FuelSystemsTab() {
  const [files, setFiles]       = useState<File[]>([]);
  const [headers, setHeaders]   = useState<string[]>([]);
  const [timeCol, setTimeCol]   = useState("");
  const [ptankCol, setPtankCol] = useState("");
  const [tfuelCol, setTfuelCol] = useState("");
  const [ptankThr, setPtankThr] = useState("2.0");
  const [endMode, setEndMode]   = useState("Ptank");
  const [socCol, setSocCol]     = useState("");
  const [socThr, setSocThr]     = useState("100");
  const [enTfuel, setEnTfuel]   = useState(true);
  const [tfuelTarget, setTfuelTarget] = useState("-30");
  const [tfuelWindow, setTfuelWindow] = useState("30");
  const [enRamp, setEnRamp]     = useState(false);
  const [rampLimit, setRampLimit] = useState("");
  const [paramRows, setParamRows] = useState<ParamRow[]>([]);
  const [results, setResults]   = useState<FSResult[]|null>(null);
  const [figure, setFigure]     = useState<object|null>(null);
  const [vizIdx, setVizIdx]     = useState(0);
  const [loading, setLoading]   = useState(false);
  const [status, setStatus]     = useState<{type:"info"|"success"|"error";msg:string}|null>(null);

  const loadFiles = async (dropped: File[]) => {
    setFiles(dropped);setResults(null);setFigure(null);
    if(!dropped.length) return;
    try {
      const fd = new FormData();
      for(const f of dropped) fd.append("files",f);
      const res = await api.post("/fuel-systems/headers",fd);
      const hdrs:string[] = res.data.headers;
      setHeaders(hdrs);
      const hl=hdrs.map(h=>h.toLowerCase());
      setTimeCol(hdrs[hl.findIndex(h=>h.includes("time"))]??hdrs[0]??"");
      setPtankCol(hdrs[hl.findIndex(h=>h.includes("ptank"))]??"");
      setTfuelCol(hdrs[hl.findIndex(h=>h.includes("tfuel"))]??"");
      setSocCol(hdrs.find(h=>h.toLowerCase()==="soc")??"");
      // Param rows: exclude time/ptank
      const tc=hdrs[hl.findIndex(h=>h.includes("time"))]??hdrs[0]??"";
      const pc=hdrs[hl.findIndex(h=>h.includes("ptank"))]??"";
      setParamRows(hdrs.filter(h=>h!==tc&&h!==pc).map(h=>({param:h,selected:true,min:"",max:""})));
      setStatus({type:"success",msg:`${dropped.length} file(s) · ${hdrs.length} columns`});
    } catch(e:unknown){setStatus({type:"error",msg:String((e as {response?:{data?:{detail?:string}}}).response?.data?.detail??e)});}
  };

  const validate = async () => {
    setLoading(true);setStatus({type:"info",msg:"Validating…"});
    try {
      const paramLimits:Record<string,Record<string,number>>={};
      for(const r of paramRows){
        if(!r.selected) continue;
        const lim:Record<string,number>={};
        if(r.min) lim.min=parseFloat(r.min);
        if(r.max) lim.max=parseFloat(r.max);
        if(Object.keys(lim).length) paramLimits[r.param]=lim;
      }
      const fd = new FormData();
      for(const f of files) fd.append("files",f);
      fd.append("time_col",timeCol); fd.append("ptank_col",ptankCol); fd.append("tfuel_col",tfuelCol);
      fd.append("ptank_threshold",ptankThr); fd.append("end_mode",endMode);
      fd.append("soc_col",socCol); fd.append("soc_threshold",socThr);
      fd.append("enable_tfuel",String(enTfuel)); fd.append("tfuel_target",tfuelTarget); fd.append("tfuel_window",tfuelWindow);
      fd.append("enable_ramp",String(enRamp)); fd.append("ramp_limit_str",rampLimit);
      fd.append("param_limits_json",JSON.stringify(paramLimits));
      const res = await api.post("/fuel-systems/validate",fd);
      setResults(res.data.results);
      setVizIdx(0);
      setStatus({type:"success",msg:`Done · ${res.data.results.filter((r:FSResult)=>r.status==="PASS").length} PASS / ${res.data.results.length} total`});
    } catch(e:unknown){setStatus({type:"error",msg:String((e as {response?:{data?:{detail?:string}}}).response?.data?.detail??e)});}
    finally{setLoading(false);}
  };

  const loadFigure = async (idx:number) => {
    if(!results) return;
    const r=results[idx];
    try {
      const fd = new FormData();
      for(const f of files) fd.append("files",f);
      fd.append("config_json",JSON.stringify({
        time_col:timeCol,tfuel_target:parseFloat(tfuelTarget),tfuel_window:parseFloat(tfuelWindow),
        cycle_start_idx:r.cycle_start_idx, cycle_end_idx:r.cycle_end_idx, status:r.status,
      }));
      fd.append("file_index",String(idx));
      const res = await api.post("/fuel-systems/figure",fd);
      setFigure(res.data.figure);
    } catch(e:unknown){setStatus({type:"error",msg:"Visualization error"});}
  };

  const exportReport = async () => {
    if(!results) return;
    try {
      const fd = new FormData();
      fd.append("results_json",JSON.stringify(results));
      const res = await api.post("/fuel-systems/report",fd,{responseType:"blob"});
      downloadBlob(res.data,"fuel_systems_report.txt");
    } catch(e:unknown){setStatus({type:"error",msg:"Export failed"});}
  };

  const Sel = ({label,value,onChange,allowEmpty}:{label:string;value:string;onChange:(v:string)=>void;allowEmpty?:boolean}) => (
    <div><label className="text-xs text-gray-400 block mb-1">{label}</label>
      <select value={value} onChange={e=>onChange(e.target.value)}
        className="w-full bg-surface2 border border-border rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500">
        {allowEmpty&&<option value="">— none —</option>}
        {headers.map(h=><option key={h}>{h}</option>)}
      </select></div>
  );

  return (
    <div className="max-w-4xl space-y-6">
      <TabDescription
        title="Fuel Systems"
        summary="Customized for fuel systems testing, to automate going through multiple cycles (Validate with ShowGraph after)"
        details={[
          "Upload one or more TXT cycle files. Select the Time, tank pressure (Ptank), and fuel temperature (Tfuel) columns along with any additional parameters to bounds-check.",
          "Fuel temperature pre-conditioning check: verifies that Tfuel reached the required soak temperature before the fill cycle began. Configure the target temperature and soak window.",
          "Parameter bounds check: define upper and lower limits for any channel. Any cycle where a parameter goes out of bounds is flagged as a violation.",
          "Ramp rate check: measures how fast tank pressure rose during the fill and flags cycles where the average ramp rate falls outside acceptable limits.",
          "State-of-charge (SOC) check: confirms whether the SOC channel reached the target threshold (e.g., 100%) during the cycle.",
          "Results are shown as a table with a PASS/FAIL status per cycle, plus specific messages for each check. An Excel export is also available.",
        ]}
      />

      <section className="bg-surface rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Step 1 · Upload Cycle Files</h3>
        <FileDropzone onFiles={loadFiles} accept={["txt","log","dat","csv"]} current={files.map(f=>f.name)} />
      </section>

      {headers.length>0 && (
        <>
          <section className="bg-surface rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Step 2 · Column Assignments</h3>
            <div className="grid grid-cols-3 gap-3">
              <Sel label="Time" value={timeCol} onChange={setTimeCol} />
              <Sel label="Ptank" value={ptankCol} onChange={setPtankCol} />
              <Sel label="tfuel" value={tfuelCol} onChange={setTfuelCol} />
            </div>
          </section>

          <section className="bg-surface rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Step 3 · Fill Detection</h3>
            <div className="flex items-center gap-4">
              <div><label className="text-xs text-gray-400 block mb-1">Ptank Threshold (MPa)</label>
                <input type="number" value={ptankThr} onChange={e=>setPtankThr(e.target.value)} step="0.1"
                  className="w-28 bg-surface2 border border-border rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500" /></div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">End of Fill</label>
                <div className="flex gap-3">
                  {["Ptank","SOC"].map(m=>(
                    <label key={m} className="flex items-center gap-1 text-sm text-gray-300 cursor-pointer">
                      <input type="radio" name="end_mode" value={m} checked={endMode===m} onChange={()=>setEndMode(m)} className="accent-blue-500" />{m}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            {endMode==="SOC"&&(
              <div className="flex gap-3 items-end">
                <Sel label="SOC Column" value={socCol} onChange={setSocCol} allowEmpty />
                <div><label className="text-xs text-gray-400 block mb-1">SOC Threshold %</label>
                  <input type="number" value={socThr} onChange={e=>setSocThr(e.target.value)}
                    className="w-24 bg-surface2 border border-border rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500" /></div>
              </div>
            )}
          </section>

          <section className="bg-surface rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Step 4 · Checks</h3>
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input type="checkbox" checked={enTfuel} onChange={e=>setEnTfuel(e.target.checked)} className="accent-blue-500" />Enable tfuel timing check
            </label>
            {enTfuel&&(
              <div className="flex gap-3 ml-5">
                <div><label className="text-xs text-gray-400 block mb-1">Target Temp (°C)</label>
                  <input type="number" value={tfuelTarget} onChange={e=>setTfuelTarget(e.target.value)}
                    className="w-24 bg-surface2 border border-border rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-blue-500" /></div>
                <div><label className="text-xs text-gray-400 block mb-1">Time Window (s)</label>
                  <input type="number" value={tfuelWindow} onChange={e=>setTfuelWindow(e.target.value)}
                    className="w-24 bg-surface2 border border-border rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-blue-500" /></div>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input type="checkbox" checked={enRamp} onChange={e=>setEnRamp(e.target.checked)} className="accent-blue-500" />Enable ramp rate check
            </label>
            {enRamp&&(
              <div className="ml-5"><label className="text-xs text-gray-400 block mb-1">Min Ramp (MPa/min) — blank to report only</label>
                <input type="number" value={rampLimit} onChange={e=>setRampLimit(e.target.value)} placeholder="optional"
                  className="w-36 bg-surface2 border border-border rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-blue-500" /></div>
            )}
          </section>

          <section className="bg-surface rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Step 5 · Parameter Bounds</h3>
            <ParamBoundsEditor rows={paramRows} onChange={setParamRows} />
          </section>

          <button onClick={validate} disabled={loading}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-medium text-sm">
            {loading?"Validating…":"VALIDATE FILES"}
          </button>
        </>
      )}

      {results && (
        <section className="space-y-3">
          <div className="flex gap-3 items-center">
            <h3 className="text-lg font-medium text-gray-100">Results</h3>
            <button onClick={exportReport} className="px-4 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg">Download Report</button>
          </div>
          {results.map((r,i)=>{
            const icon=r.status==="PASS"?"✅":r.status==="FAIL"?"❌":"⚠️";
            const passColor=r.status==="PASS"?"text-green-400":r.status==="FAIL"?"text-red-400":"text-yellow-400";
            return (
              <div key={i} className="bg-surface rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-100">{icon} {r.file}</span>
                  <span className={`font-semibold ${passColor}`}>{r.status}</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-sm">
                  <div className="bg-gray-800 rounded p-2"><p className="text-xs text-gray-400">Fill Points</p><p className="text-gray-100">{r.cycle_points}</p></div>
                  <div className="bg-gray-800 rounded p-2"><p className="text-xs text-gray-400">tfuel Check</p><p className={r.tfuel_check?"text-green-400":"text-red-400"}>{r.tfuel_check?"PASS":"FAIL"}</p></div>
                  {r.avg_ramp_rate!=null&&<div className="bg-gray-800 rounded p-2"><p className="text-xs text-gray-400">Avg Ramp</p><p className="text-gray-100">{r.avg_ramp_rate.toFixed(2)} MPa/min</p></div>}
                  {r.soc_max!=null&&<div className="bg-gray-800 rounded p-2"><p className="text-xs text-gray-400">SOC Max</p><p className="text-gray-100">{r.soc_max.toFixed(1)}%</p></div>}
                </div>
                <p className="text-xs text-gray-400">{r.tfuel_message}</p>
                {r.param_violations.length>0&&(
                  <div className="text-xs text-red-400 space-y-0.5">
                    {r.param_violations.map((v,j)=><p key={j}>• {v}</p>)}
                  </div>
                )}
                <button onClick={()=>{setVizIdx(i);loadFigure(i);}}
                  className="text-xs text-blue-400 hover:text-blue-300">View cycle chart →</button>
              </div>
            );
          })}
        </section>
      )}

      {figure && <PlotlyChart figure={figure as {data:Plotly.Data[];layout:Partial<Plotly.Layout>}} />}
      {status && <StatusBanner type={status.type} message={status.msg} />}
    </div>
  );
}
