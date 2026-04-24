import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import JerryApp from "./JerryApp";
import GraphApp from "./GraphApp";
import UncertaintyApp from "./uncertainty-tool/UncertaintyApp";
import SocConverterApp from "./soc-converter/SocConverterApp";

const APPS = [
  { id: "jerry",       label: "Jerry Tool",              path: "/" },
  { id: "graph",       label: "Report Graph Generator",  path: "/graph" },
  { id: "uncertainty", label: "Uncertainty Tool",        path: "/uncertainty-tool" },
  { id: "soc",         label: "SOC Calculator",          path: "/soc-converter" },
];

export default function App() {
  return (
    <Router>
      <TopNav />
      <Routes>
        <Route path="/" element={<JerryApp />} />
        <Route path="/graph" element={<GraphApp />} />
        <Route path="/uncertainty-tool" element={
          <div className="flex-1 overflow-auto bg-base">
            <UncertaintyApp />
          </div>
        } />
        <Route path="/soc-converter" element={<SocConverterApp />} />
      </Routes>
    </Router>
  );
}

function TopNav() {
  const location = useLocation();

  return (
    <nav className="h-14 border-b border-border/60 bg-surface/80 backdrop-blur flex items-center px-6 gap-8 shrink-0">
      {APPS.map(app => (
        <a
          key={app.id}
          href={app.path}
          className={`text-sm font-medium transition-colors ${
            location.pathname === app.path
              ? "text-accent"
              : "text-gray-400 hover:text-gray-100"
          }`}
        >
          {app.label}
        </a>
      ))}
    </nav>
  );
}
