import Plot from "react-plotly.js";

interface Props {
  // Plotly figure dict returned directly from FastAPI
  figure: { data: Plotly.Data[]; layout: Partial<Plotly.Layout>; frames?: Plotly.Frame[] };
  style?: React.CSSProperties;
}

export default function PlotlyChart({ figure, style }: Props) {
  return (
    <Plot
      data={figure.data}
      layout={{ ...figure.layout, autosize: true }}
      frames={figure.frames}
      config={{ responsive: true, displayModeBar: true, scrollZoom: true }}
      style={{ width: "100%", ...style }}
      useResizeHandler
    />
  );
}
