interface ParamRow {
  param: string;
  selected: boolean;
  min: string;
  max: string;
}

interface Props {
  rows: ParamRow[];
  onChange: (rows: ParamRow[]) => void;
  extraColumns?: string[];   // extra column headers beyond Min/Max
}

export default function ParamBoundsEditor({ rows, onChange }: Props) {
  const set = (i: number, field: keyof ParamRow, value: unknown) => {
    const next = rows.map((r, idx) => idx === i ? { ...r, [field]: value } : r);
    onChange(next);
  };

  const selectAll = (v: boolean) => onChange(rows.map((r) => ({ ...r, selected: v })));

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <button onClick={() => selectAll(true)}
          className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded">
          Select All
        </button>
        <button onClick={() => selectAll(false)}
          className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded">
          Deselect All
        </button>
      </div>

      <div className="overflow-auto max-h-72 border border-gray-700 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-800 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left text-gray-400 font-medium">Validate?</th>
              <th className="px-3 py-2 text-left text-gray-400 font-medium">Parameter</th>
              <th className="px-3 py-2 text-left text-gray-400 font-medium">Min Bound</th>
              <th className="px-3 py-2 text-left text-gray-400 font-medium">Max Bound</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.param} className={i % 2 === 0 ? "bg-gray-900" : "bg-gray-850"}>
                <td className="px-3 py-1.5">
                  <input type="checkbox" checked={r.selected}
                    onChange={(e) => set(i, "selected", e.target.checked)}
                    className="accent-blue-500" />
                </td>
                <td className="px-3 py-1.5 text-gray-200">{r.param}</td>
                <td className="px-3 py-1.5">
                  <input type="number" value={r.min} placeholder="—"
                    onChange={(e) => set(i, "min", e.target.value)}
                    className="w-24 bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500" />
                </td>
                <td className="px-3 py-1.5">
                  <input type="number" value={r.max} placeholder="—"
                    onChange={(e) => set(i, "max", e.target.value)}
                    className="w-24 bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export type { ParamRow };
