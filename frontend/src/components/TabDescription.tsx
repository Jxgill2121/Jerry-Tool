interface Props {
  title: string;
  summary: string;
  details: string[];
}

export default function TabDescription({ title, summary, details }: Props) {
  return (
    <div className="mb-6 rounded-xl border border-accent/20 bg-accent/5 p-5">
      <h2 className="text-xl font-semibold text-gray-100 mb-1">{title}</h2>
      <p className="text-sm text-gray-300 mb-3">{summary}</p>
      <ul className="space-y-1">
        {details.map((d, i) => (
          <li key={i} className="flex gap-2 text-sm text-gray-400">
            <span className="text-accent mt-0.5 shrink-0">›</span>
            <span>{d}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
