interface Props {
  type: "info" | "success" | "error" | "warning";
  message: string;
}

const config = {
  info:    { bar: "bg-blue-500",   bg: "bg-blue-500/10",  border: "border-blue-500/30",  text: "text-blue-300",  icon: "M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" },
  success: { bar: "bg-green-500",  bg: "bg-green-500/10", border: "border-green-500/30", text: "text-green-300", icon: "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" },
  error:   { bar: "bg-red-500",    bg: "bg-red-500/10",   border: "border-red-500/30",   text: "text-red-300",   icon: "M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" },
  warning: { bar: "bg-yellow-500", bg: "bg-yellow-500/10",border: "border-yellow-500/30",text: "text-yellow-300",icon: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" },
};

export default function StatusBanner({ type, message }: Props) {
  const c = config[type];
  return (
    <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${c.bg} ${c.border}`}>
      <div className={`w-1 self-stretch rounded-full shrink-0 ${c.bar}`} />
      <svg className={`w-4 h-4 mt-0.5 shrink-0 ${c.text}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d={c.icon} />
      </svg>
      <p className={`${c.text} flex-1 leading-snug`}>{message}</p>
    </div>
  );
}
