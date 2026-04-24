import { useState } from "react";
import api, { downloadBlob } from "../api/client";
import FileDropzone from "../components/FileDropzone";
import StatusBanner from "../components/StatusBanner";
import TabDescription from "../components/TabDescription";

interface Band { label:string; temp_min:string; temp_max:string; target_hours:string; }
interface BandResult {
  label:string; target_hours:number; hours_in_band:number;
  pct_complete:number|null; pass:boolean|null; excursions:number;
  temp_min_obs:number|null; temp_max_obs:number|null; temp_mean:number|null;
  temp_in_band_avg:number|null;
}

const defaultBands: Band[] = [
  {label:"Cold Band",   temp_min:"-40", temp_max:"-20", target_hours:""},
  {label:"Ambient",     temp_min:"15",  temp_max:"35",  target_hours:""},
  {label:"Hot Band",    temp_min:"50",  temp_max:"85",  target_hours:""},
];

export default function ASRTab() {
  const [files, setFiles]     = useState<File[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [timeCol, setTimeCol] = useState("");
  const [tempCol, setTempCol] = useState("");
  const [timeUnit, setTimeUnit] = useState("seconds");
  const [bands, setBands]     = useState<Band[]>(defaultBands);
  const [results, setResults] = useState<BandResult[]|null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus]   = useState<{type:"info"|"success"|"error";msg:string}|null>(null);

  const loadFile = async (dropped: File[]) => {
    setFiles(dropped);setResults(null);
    if(!dropped.length) return;
    try {
      const fd = new FormData();
      for(const f of dropped) fd.append("files",f);
      const res = await api.post("/asr/headers",fd);
      const hdrs:string[] = res.data.headers;
      setHeaders(hdrs);
      const hl=hdrs.map(h=>h.toLowerCase());
      // Prefer numeric elapsed/time columns over datetime "Time" columns
      const elapsedIdx = hl.findIndex(h=>h.includes("elapsed")||h==="time_s"||h==="time_sec");
      const timeIdx    = hl.findIndex(h=>h.includes("time"));
      setTimeCol(hdrs[elapsedIdx>=0?elapsedIdx:timeIdx]??hdrs[0]??"");
      // Match common temperature column names
      const tempIdx = hl.findIndex(h=>
        h.includes("temp")||h.includes("tamb")||h.includes("tair")||
        h.includes("t_air")||h.startsWith("t_")||h.match(/^t[a-z]/i)!=null
      );
      setTempCol(hdrs[tempIdx>=0?tempIdx:0]??"");
      setStatus({type:"success",msg:`Loaded · ${hdrs.length} columns`});
    } catch(e:unknown){setStatus({type:"error",msg:String((e as {response?:{data?:{detail?:string}}}).response?.data?.detail??e)});}
  };

  const setBand = (i:number,field:keyof Band,v:string)=>
    setBands(prev=>prev.map((b,idx)=>idx===i?{...b,[field]:v}:b));
  const addBand = ()=>setBands(p=>[...p,{label:"",temp_min:"",temp_max:"",target_hours:""}]);
  const delBand = (i:number)=>setBands(p=>p.filter((_,idx)=>idx!==i));

  const validate = async () => {
    setLoading(true);setStatus({type:"info",msg:"Validating…"});
    try {
      const fd = new FormData();
      for(const f of files) fd.append("files",f);
      fd.append("time_col",timeCol);
      fd.append("temp_col",tempCol);
      fd.append("time_unit",timeUnit);
      fd.append("params_json",JSON.stringify(bands.map(b=>({
        label:b.label,temp_min:parseFloat(b.temp_min),temp_max:parseFloat(b.temp_max),
        target_hours:b.target_hours?parseFloat(b.target_hours):0
      }))));
      const res = await api.post("/asr/validate",fd);
      setResults(res.data.results);
      setStatus({type:"success",msg:"Validation complete"});
    } catch(e:unknown){setStatus({type:"error",msg:String((e as {response?:{data?:{detail?:string}}}).response?.data?.detail??e)});}
    finally{setLoading(false);}
  };

  const exportExcel = async () => {
    try {
      const fd = new FormData();
      for(const f of files) fd.append("files",f);
      fd.append("time_col",timeCol);fd.append("temp_col",tempCol);fd.append("time_unit",timeUnit);
      fd.append("params_json",JSON.stringify(bands.map(b=>({
        label:b.label,temp_min:parseFloat(b.temp_min),temp_max:parseFloat(b.temp_max),
        target_hours:b.target_hours?parseFloat(b.target_hours):0
      }))));
      const res = await api.post("/asr/validate/excel",fd,{responseType:"blob"});
      downloadBlob(res.data,"asr_validation.xlsx");
    } catch(e:unknown){setStatus({type:"error",msg:"Export failed"});}
  };

  return (
    <div className="max-w-3xl space-y-6">
      <TabDescription
        title="ASR Validation"
        summary="Validates ASR data"
        details={[
          "Define your temperature bands by setting a label, lower and upper temperature bounds, and the required target hours for each band.",
          "Upload one or more log files containing a time channel and a temperature channel. Select the correct columns and specify the time unit (seconds, minutes, hours).",
          "The tool scans the temperature data sample by sample and tallies time spent within each band. It also counts excursions — samples that fall outside any defined band.",
          "Results show hours accumulated, percent completion toward the target, pass/fail status, and observed min/mean/max temperature within each band.",
        ]}
      />

      <section className="bg-surface rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Step 1 · Upload File</h3>
        <FileDropzone onFiles={loadFile} accept={["txt","log","dat","csv"]} multiple={false} current={files.map(f=>f.name)} />
      </section>

      {headers.length>0 && (
        <>
          <section className="bg-surface rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Step 2 · Columns</h3>
            <div className="grid grid-cols-2 gap-3">
              {[["Time column",timeCol,setTimeCol],["Temp column",tempCol,setTempCol]].map(([lbl,val,set])=>(
                <div key={String(lbl)} className="flex flex-col gap-1">
                  <label className="text-xs text-gray-400">{String(lbl)}</label>
                  <select value={String(val)} onChange={e=>(set as (v:string)=>void)(e.target.value)}
                    className="bg-surface2 border border-border rounded px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500">
                    <option value="">— select —</option>
                    {headers.map(h=><option key={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400">Time unit</label>
              {["seconds","minutes","hours"].map(u=>(
                <label key={u} className="flex items-center gap-1 text-sm text-gray-300 cursor-pointer">
                  <input type="radio" name="unit" value={u} checked={timeUnit===u} onChange={()=>setTimeUnit(u)} className="accent-blue-500" />{u}
                </label>
              ))}
            </div>
          </section>

          <section className="bg-surface rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Step 3 · Temperature Bands</h3>
            <table className="w-full text-sm">
              <thead><tr className="text-gray-400 text-xs">
                <th className="text-left pb-1">Label</th><th className="text-left pb-1">Min °C</th>
                <th className="text-left pb-1">Max °C</th><th className="text-left pb-1">Target (h)</th>
                <th></th>
              </tr></thead>
              <tbody>
                {bands.map((b,i)=>(
                  <tr key={i} className="gap-2">
                    {(["label","temp_min","temp_max","target_hours"] as (keyof Band)[]).map(f=>(
                      <td key={f} className="pr-2 py-1">
                        <input value={b[f]} onChange={e=>setBand(i,f,e.target.value)} type={f==="label"?"text":"number"}
                          className="w-full bg-surface2 border border-border rounded px-2 py-1 text-gray-100 focus:outline-none focus:border-blue-500 text-xs" />
                      </td>
                    ))}
                    <td><button onClick={()=>delBand(i)} className="text-red-400 hover:text-red-300 text-xs px-1">✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={addBand} className="text-xs text-blue-400 hover:text-blue-300">+ Add band</button>
          </section>

          <div className="flex gap-3">
            <button onClick={validate} disabled={loading}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-medium text-sm">
              {loading?"Validating…":"Validate"}
            </button>
            {results && <button onClick={exportExcel} className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm">Export Excel</button>}
          </div>
        </>
      )}

      {results && (
        <section className="space-y-3">
          {results.map((r,i)=>{
            const pct = r.pct_complete;
            const passColor = r.pass===true?"text-green-400":r.pass===false?"text-red-400":"text-gray-400";
            return (
              <div key={i} className="bg-surface rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-100">{r.label}</span>
                  <span className={`text-sm font-semibold ${passColor}`}>
                    {r.pass===true?"PASS":r.pass===false?"FAIL":"—"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <Metric label="Target" value={`${r.target_hours}h`} />
                  <Metric label="Actual" value={r.hours_in_band!=null?`${r.hours_in_band.toFixed(3)}h`:"—"} />
                  <Metric label="Complete" value={pct!=null?`${pct.toFixed(1)}%`:"—"} />
                  <Metric label="Excursions" value={r.excursions!=null?String(r.excursions):"—"} />
                  <Metric label="Temp min" value={r.temp_min_obs!=null?`${r.temp_min_obs.toFixed(2)}°C`:"—"} />
                  <Metric label="Temp max" value={r.temp_max_obs!=null?`${r.temp_max_obs.toFixed(2)}°C`:"—"} />
                  <Metric label="Avg temp (in-band)" value={r.temp_in_band_avg!=null?`${r.temp_in_band_avg.toFixed(2)}°C`:"—"} />
                </div>
                {r.target_hours>0 && pct!=null && (
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div className={`h-2 rounded-full ${r.pass?"bg-green-500":"bg-blue-500"}`}
                      style={{width:`${Math.min(pct,100)}%`}} />
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {status && <StatusBanner type={status.type} message={status.msg} />}
    </div>
  );
}

function Metric({label,value}:{label:string;value:string}) {
  return (
    <div className="bg-gray-800 rounded-lg px-3 py-2">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-gray-100 font-medium">{value}</p>
    </div>
  );
}
