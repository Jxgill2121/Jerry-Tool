import { useState } from "react";
import api from "../api/client";
import FileDropzone from "../components/FileDropzone";
import StatusBanner from "../components/StatusBanner";
import PlotlyChart from "../components/PlotlyChart";
import TabDescription from "../components/TabDescription";

interface ColInfo { id:string; display:string; kind:"min"|"max"|"other"; }
interface GraphRow { title:string; y_label:string; y1:string; y2:string;
  y_min:string; y_max:string; y_ticks:string;
  min_lower:string; min_upper:string; max_lower:string; max_upper:string; }

const emptyRow = (): GraphRow => ({
  title:"",y_label:"Value",y1:"",y2:"",y_min:"",y_max:"",y_ticks:"",
  min_lower:"",min_upper:"",max_lower:"",max_upper:"",
});

export default function PlotTab() {
  const [files, setFiles]   = useState<File[]>([]);
  const [cols, setCols]     = useState<ColInfo[]>([]);
  const [cycleCol, setCycleCol] = useState("");
  const [mainTitle, setMainTitle] = useState("");
  const [xMin, setXMin]     = useState("");
  const [xMax, setXMax]     = useState("");
  const [graphs, setGraphs] = useState<GraphRow[]>([emptyRow(), emptyRow()]);
  const [figure, setFigure] = useState<object|null>(null);
  const [loading, setLoading] = useState(false);
  const [pngLoading, setPngLoading] = useState(false);
  const [status, setStatus] = useState<{type:"info"|"success"|"error";msg:string}|null>(null);

  const loadPng = async (dropped: File[]) => {
    if (!dropped.length) return;
    setPngLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", dropped[0]);
      const res = await api.post("/plot/load-png", fd);
      const d = res.data;
      if (d.main_title) setMainTitle(d.main_title);
      if (d.x_min) setXMin(d.x_min);
      if (d.x_max) setXMax(d.x_max);
      if (d.graphs?.length) setGraphs(d.graphs.map((g: GraphRow) => ({ ...emptyRow(), ...g })));
      setStatus({ type: "success", msg: `Loaded settings from PNG · ${d.graphs?.length ?? 0} graph(s)` });
    } catch (e: unknown) {
      setStatus({ type: "error", msg: String((e as {response?:{data?:{detail?:string}}}).response?.data?.detail ?? e) });
    } finally { setPngLoading(false); }
  };

  const loadFile = async (dropped: File[]) => {
    setFiles(dropped);setFigure(null);
    if(!dropped.length) return;
    try {
      const fd = new FormData();
      for(const f of dropped) fd.append("files",f);
      const res = await api.post("/plot/headers",fd);
      const cs:ColInfo[] = res.data.columns;
      setCols(cs);
      const cyc = cs.find(c=>c.display.toLowerCase().includes("cycle"));
      setCycleCol(cyc?.id ?? cs[0]?.id ?? "");
      setStatus({type:"success",msg:`${res.data.row_count} cycles · ${cs.length} columns`});
    } catch(e:unknown){setStatus({type:"error",msg:String((e as {response?:{data?:{detail?:string}}}).response?.data?.detail??e)});}
  };

  const setG = (i:number,f:keyof GraphRow,v:string)=>
    setGraphs(p=>p.map((r,idx)=>idx===i?{...r,[f]:v}:r));

  const generate = async () => {
    setLoading(true);setStatus({type:"info",msg:"Generating…"});
    try {
      const fd = new FormData();
      for(const f of files) fd.append("files",f);
      fd.append("config_json", JSON.stringify({
        main_title:mainTitle,
        cycle_col_id:cycleCol,
        x_min: xMin?parseFloat(xMin):null,
        x_max: xMax?parseFloat(xMax):null,
        graphs: graphs.map(g=>({
          ...g,
          y_min:g.y_min?parseFloat(g.y_min):null,
          y_max:g.y_max?parseFloat(g.y_max):null,
          y_ticks:g.y_ticks?parseInt(g.y_ticks):null,
          min_lower:g.min_lower?parseFloat(g.min_lower):null,
          min_upper:g.min_upper?parseFloat(g.min_upper):null,
          max_lower:g.max_lower?parseFloat(g.max_lower):null,
          max_upper:g.max_upper?parseFloat(g.max_upper):null,
        }))
      }));
      const res = await api.post("/plot/figure",fd);
      setFigure(res.data.figure);
      setStatus({type:"success",msg:"Plot generated"});
    } catch(e:unknown){setStatus({type:"error",msg:String((e as {response?:{data?:{detail?:string}}}).response?.data?.detail??e)});}
    finally{setLoading(false);}
  };

  const paramOpts = ["", ...cols.filter(c=>c.kind==="min"||c.kind==="max").map(c=>c.display)];
  const cycleOpts = cols.map(c=>c.id);

  return (
    <div className="max-w-5xl space-y-6">
      <TabDescription
        title="Report Graph Generator"
        summary="Generates max/min graphs"
        details={[
          "Upload a Max/Min summary file (produced by the Max/Min tab). The tool reads all paired Min/Max parameter columns and makes them available for plotting.",
          "Configure global settings: the overall report title, which column to use as the X-axis (typically Cycle), and the X-axis range.",
          "Add as many subplots as needed using '+ Add Graph'. For each subplot, set a title, Y-axis label, choose up to two parameters (Y1 and Y2), and optionally set Y-axis min/max and tick count.",
          "Each subplot also supports optional pass/fail reference lines (Min Lower, Min Upper, Max Lower, Max Upper) drawn as dashed horizontal lines so you can visually assess whether data is within spec.",
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4 space-y-1">
          <p className="text-sm font-bold text-white">Load from a Previous Graph</p>
          <p className="text-sm text-gray-200">Instead of filling in all parameters manually, drop a previously saved Jerry PNG to instantly restore all titles, axes, limits, and layout. Reference graphs (e.g. R134 standard at 70MPa) will be pre-built — just upload the right one and you're ready to plot.</p>
        </div>
        <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-4 space-y-1">
          <p className="text-sm font-bold text-white">Save PNGs to the S Drive</p>
          <p className="text-sm text-gray-200">Always save graphs to the S drive. This builds a shared library of reference graphs that anyone can reload here later — the more that's saved, the less setup everyone has to do.</p>
        </div>
      </div>

      <section className="bg-surface rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Load from Previous Graph (optional)</h3>
        <p className="text-xs text-gray-500">Upload a PNG saved by Jerry to restore its titles, limits and graph layout automatically.</p>
        <FileDropzone onFiles={loadPng} accept={["png"]} multiple={false} current={[]} label={pngLoading?"Reading PNG…":"Drop saved graph PNG here"} />
      </section>

      <section className="bg-surface rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Step 1 · Upload Max/Min File</h3>
        <FileDropzone onFiles={loadFile} accept={["txt","log","dat","csv"]} multiple={false} current={files.map(f=>f.name)} />
      </section>

      {cols.length>0 && (
        <>
          <section className="bg-surface rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Step 2 · Global Settings</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-400 block mb-1">Main Title</label>
                <input value={mainTitle} onChange={e=>setMainTitle(e.target.value)} placeholder="e.g. Test Report Title"
                  className="w-full bg-surface2 border border-border rounded px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500" /></div>
              <div><label className="text-xs text-gray-400 block mb-1">Cycle Column</label>
                <select value={cycleCol} onChange={e=>setCycleCol(e.target.value)}
                  className="w-full bg-surface2 border border-border rounded px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500">
                  {cycleOpts.map(c=><option key={c} value={c}>{cols.find(x=>x.id===c)?.display??c}</option>)}
                </select></div>
              <div><label className="text-xs text-gray-400 block mb-1">X Min</label>
                <input type="number" value={xMin} onChange={e=>setXMin(e.target.value)} placeholder="auto"
                  className="w-full bg-surface2 border border-border rounded px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500" /></div>
              <div><label className="text-xs text-gray-400 block mb-1">X Max</label>
                <input type="number" value={xMax} onChange={e=>setXMax(e.target.value)} placeholder="auto"
                  className="w-full bg-surface2 border border-border rounded px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500" /></div>
            </div>
          </section>

          <section className="bg-surface rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Step 3 · Configure Graphs</h3>
            <div className="flex gap-2">
              <button onClick={()=>setGraphs(p=>[...p,emptyRow()])} className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded">+ Add Graph</button>
              {graphs.length>1&&<button onClick={()=>setGraphs(p=>p.slice(0,-1))} className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded">− Remove Last</button>}
            </div>
            {graphs.map((g,i)=>(
              <div key={i} className="border border-border rounded-lg p-4 space-y-3">
                <p className="text-xs font-medium text-gray-400">Graph {i+1}</p>
                <div className="grid grid-cols-2 gap-2">
                  {[["Title",g.title,"title"],["Y Label",g.y_label,"y_label"]].map(([lbl,val,f])=>(
                    <div key={String(f)}>
                      <label className="text-xs text-gray-500">{String(lbl)}</label>
                      <input value={String(val)} onChange={e=>setG(i,f as keyof GraphRow,e.target.value)}
                        className="w-full bg-surface2 border border-border rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-blue-500" />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[["Y1 Variable",g.y1,"y1"],["Y2 Variable",g.y2,"y2"]].map(([lbl,val,f])=>(
                    <div key={String(f)}>
                      <label className="text-xs text-gray-500">{String(lbl)}</label>
                      <select value={String(val)} onChange={e=>setG(i,f as keyof GraphRow,e.target.value)}
                        className="w-full bg-surface2 border border-border rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-blue-500">
                        {paramOpts.map(o=><option key={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {(["y_min","y_max","y_ticks","min_lower","min_upper","max_lower","max_upper"] as (keyof GraphRow)[]).map(f=>(
                    <div key={f}>
                      <label className="text-xs text-gray-500">{f.replace(/_/g," ")}</label>
                      <input type="number" value={g[f] as string} onChange={e=>setG(i,f,e.target.value)} placeholder="auto"
                        className="w-full bg-surface2 border border-border rounded px-2 py-0.5 text-xs text-gray-100 focus:outline-none focus:border-blue-500" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <button onClick={generate} disabled={loading}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-medium text-sm">
            {loading?"Generating…":"Generate Plots"}
          </button>
        </>
      )}

      {figure && <PlotlyChart figure={figure as {data:Plotly.Data[];layout:Partial<Plotly.Layout>}} />}
      {status && <StatusBanner type={status.type} message={status.msg} />}
    </div>
  );
}
