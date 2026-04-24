import { useState } from "react";
import api, { downloadBlob } from "../api/client";
import FileDropzone from "../components/FileDropzone";
import StatusBanner from "../components/StatusBanner";
import TabDescription from "../components/TabDescription";

interface LimitRow { variable:string; min_lower:string; min_upper:string; max_lower:string; max_upper:string; }

export default function ValidationTab() {
  const [files, setFiles]     = useState<File[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [cycleCol, setCycleCol] = useState("");
  const [limits, setLimits]   = useState<LimitRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus]   = useState<{type:"info"|"success"|"error";msg:string}|null>(null);
  const [counts, setCounts]   = useState<{total:number;passed:number;failed:number}|null>(null);

  const loadFile = async (dropped: File[]) => {
    setFiles(dropped);setLimits([]);
    if(!dropped.length) return;
    try {
      const fd = new FormData();
      for(const f of dropped) fd.append("files",f);
      const res = await api.post("/validation/headers",fd);
      const hdrs:string[] = res.data.headers;
      setHeaders(hdrs);
      const hl=hdrs.map(h=>h.toLowerCase());
      setCycleCol(hdrs[hl.findIndex(h=>h.includes("cycle"))]??hdrs[0]??"");
      // Build limit rows from min/max pairs
      const pairs: string[] = [];
      let i=0;
      while(i+1<hdrs.length){
        if(hdrs[i]===hdrs[i+1]){pairs.push(hdrs[i]);i+=2;}else i++;
      }
      setLimits(pairs.map(v=>({variable:v,min_lower:"",min_upper:"",max_lower:"",max_upper:""})));
      setStatus({type:"success",msg:`${hdrs.length} columns · ${pairs.length} parameter pairs`});
    } catch(e:unknown){setStatus({type:"error",msg:String((e as {response?:{data?:{detail?:string}}}).response?.data?.detail??e)});}
  };

  const setLim = (i:number,f:keyof LimitRow,v:string)=>
    setLimits(p=>p.map((r,idx)=>idx===i?{...r,[f]:v}:r));

  const validate = async () => {
    setLoading(true);setStatus({type:"info",msg:"Validating…"});
    try {
      const limitsObj: Record<string,Record<string,number>> = {};
      for(const r of limits){
        const lim:Record<string,number> = {};
        if(r.min_lower) lim.min_lower=parseFloat(r.min_lower);
        if(r.min_upper) lim.min_upper=parseFloat(r.min_upper);
        if(r.max_lower) lim.max_lower=parseFloat(r.max_lower);
        if(r.max_upper) lim.max_upper=parseFloat(r.max_upper);
        if(Object.keys(lim).length) limitsObj[r.variable]=lim;
      }
      const fd = new FormData();
      for(const f of files) fd.append("files",f);
      fd.append("cycle_col",cycleCol);
      fd.append("limits_json",JSON.stringify(limitsObj));
      const res = await api.post("/validation/validate",fd,{responseType:"blob"});
      downloadBlob(res.data,"validation_results.xlsx");
      const total  = parseInt(res.headers["x-total"]  ?? "0");
      const passed = parseInt(res.headers["x-passed"] ?? "0");
      const failed = parseInt(res.headers["x-failed"] ?? "0");
      setCounts({total, passed, failed});
      setStatus({type:"success",msg:"Downloaded validation_results.xlsx"});
    } catch(e:unknown){setStatus({type:"error",msg:String((e as {response?:{data?:{detail?:string}}}).response?.data?.detail??e)});}
    finally{setLoading(false);}
  };

  return (
    <div className="max-w-4xl space-y-6">
      <TabDescription
        title="Cylinder Validation"
        summary="Validates any Max/Min file but is widely used for the cylinder lab due to their long tests. Works for any Max/Min file."
        details={[
          "Upload a Max/Min summary file — the output from the Max/Min tab. The tool automatically detects paired Min/Max column pairs for each parameter.",
          "Select the Cycle column so each row in the report is correctly labeled by cycle number.",
          "For each parameter, define up to four acceptance limits: Min Lower (the minimum value the Min must be above), Min Upper (the maximum value the Min must be below), Max Lower, and Max Upper. Leave any field blank to skip that check.",
          "The tool evaluates every cycle against all limits and exports an Excel file with a row per cycle showing the raw values and a PASS/FAIL flag for each limit.",
          "Useful for confirming that measured pressures, temperatures, or other parameters stay within the engineering specification across all test cycles.",
        ]}
      />

      <section className="bg-surface rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Step 1 · Upload Max/Min File</h3>
        <FileDropzone onFiles={loadFile} accept={["txt","log","dat","csv"]} multiple={false} current={files.map(f=>f.name)} />
      </section>

      {headers.length>0 && (
        <>
          <section className="bg-surface rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-400 w-28">Cycle column</label>
              <select value={cycleCol} onChange={e=>setCycleCol(e.target.value)}
                className="bg-surface2 border border-border rounded px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500">
                {headers.map(h=><option key={h}>{h}</option>)}
              </select>
            </div>
          </section>

          <section className="bg-surface rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Step 2 · Limits</h3>
            <p className="text-xs text-gray-500">Leave blank to skip checking that bound.</p>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-800">
                  <tr>{["Parameter","Min Lower","Min Upper","Max Lower","Max Upper"].map(h=>(
                    <th key={h} className="px-3 py-2 text-left text-gray-400 font-medium text-xs">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {limits.map((r,i)=>(
                    <tr key={r.variable} className={i%2===0?"bg-gray-900":"bg-gray-850"}>
                      <td className="px-3 py-1.5 text-gray-200 text-sm">{r.variable}</td>
                      {(["min_lower","min_upper","max_lower","max_upper"] as (keyof LimitRow)[]).map(f=>(
                        <td key={f} className="px-2 py-1">
                          <input type="number" value={(r[f] as string)} placeholder="—"
                            onChange={e=>setLim(i,f,e.target.value)}
                            className="w-24 bg-surface2 border border-border rounded px-2 py-0.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <button onClick={validate} disabled={loading}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-medium text-sm">
            {loading?"Validating…":"Validate & Export Excel"}
          </button>
        </>
      )}
      {counts && (
        <div className="flex gap-4 text-sm font-medium">
          <span className="text-gray-400">{counts.total} cycles</span>
          <span className="text-green-400">{counts.passed} passed</span>
          <span className="text-red-400">{counts.failed} failed</span>
        </div>
      )}
      {status && <StatusBanner type={status.type} message={status.msg} />}
    </div>
  );
}
