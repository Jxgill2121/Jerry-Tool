import { useDropzone } from "react-dropzone";

interface Props {
  onFiles: (files: File[]) => void;
  accept?: string[];
  multiple?: boolean;
  label?: string;
  current?: string[];
}

export default function FileDropzone({ onFiles, accept, multiple = true, label, current }: Props) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onFiles,
    accept: accept ? Object.fromEntries(accept.map(ext => [getMime(ext), [`.${ext}`]])) : undefined,
    multiple,
  });

  const hasFiles = current && current.length > 0;

  return (
    <div
      {...getRootProps()}
      className={`relative rounded-xl border-2 border-dashed cursor-pointer transition-all ${
        isDragActive
          ? "border-accent bg-accent/5 scale-[1.01]"
          : hasFiles
          ? "border-accent/40 bg-surface2/60 hover:border-accent/60"
          : "border-border hover:border-gray-500 bg-surface2/30"
      }`}
    >
      <input {...getInputProps()} />

      {hasFiles ? (
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <UploadIcon className="w-4 h-4 text-accent shrink-0" />
            <span className="text-xs text-accent font-medium">{current.length} file{current.length > 1 ? "s" : ""} loaded</span>
            <span className="text-xs text-gray-600 ml-auto">click to replace</span>
          </div>
          <ul className="space-y-0.5 max-h-28 overflow-y-auto">
            {current.map(n => (
              <li key={n} className="flex items-center gap-1.5 text-xs text-gray-400">
                <FileIcon className="w-3 h-3 text-gray-600 shrink-0" />
                <span className="truncate">{n}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-8 px-4">
          <UploadIcon className={`w-8 h-8 ${isDragActive ? "text-accent" : "text-gray-600"}`} />
          <p className="text-sm text-gray-400 text-center">
            {isDragActive ? "Drop files here…" : (label ?? "Drag & drop files here, or click to select")}
          </p>
          {accept && (
            <p className="text-xs text-gray-600">.{accept.join(", .")}</p>
          )}
        </div>
      )}
    </div>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  );
}

function getMime(ext: string): string {
  const map: Record<string, string> = {
    txt: "text/plain", log: "text/plain", dat: "text/plain",
    csv: "text/csv", tsv: "text/tab-separated-values",
    tdms: "application/octet-stream", json: "application/json",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    png: "image/png",
  };
  return map[ext.toLowerCase()] ?? "application/octet-stream";
}
