import { useState, useRef } from "react";

interface ProcessResult {
  success: boolean;
  filename: string;
  message: string;
  downloadUrl?: string;
}

export default function SocConverterApp() {
  const [files, setFiles] = useState<File[]>([]);
  const [tank, setTank] = useState<string>("35");
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ProcessResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const TANKS = [35, 45, 70, 93.1, 95];

  const handleAddFiles = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles([...files, ...Array.from(e.target.files)]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleClearFiles = () => {
    setFiles([]);
    setResults([]);
  };

  const handleProcessFiles = async () => {
    if (files.length === 0) {
      setResults([{ success: false, filename: "", message: "No files selected" }]);
      return;
    }

    setIsProcessing(true);
    setResults([]);

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("tank", tank);

        const response = await fetch("/api/soc/process", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          setResults((prev) => [
            ...prev,
            { success: false, filename: file.name, message: `Error: ${errorText}` },
          ]);
          continue;
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const downloadFilename = `${file.name.split(".")[0]}_SOC_${tank}MPa.${file.name.split(".").pop()}`;

        setResults((prev) => [
          ...prev,
          {
            success: true,
            filename: file.name,
            message: `Processed successfully`,
            downloadUrl: url,
          },
        ]);
      } catch (error) {
        setResults((prev) => [
          ...prev,
          {
            success: false,
            filename: file.name,
            message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ]);
      }
    }

    setIsProcessing(false);
  };

  return (
    <div className="flex-1 overflow-auto bg-base p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-text mb-2">SOC Calculator</h1>
          <p className="text-subtext">Calculates SOC from Ptank and Ttank using hardcoded lookup values. If you have a tank at a given pressure and temperature and want to know its SOC relative to a different MPa rated tank, this is the tool for that.</p>
        </div>

        <div className="bg-surface border border-border rounded-lg p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Tank Rating (MPa)
            </label>
            <select
              value={tank}
              onChange={(e) => setTank(e.target.value)}
              disabled={isProcessing}
              className="w-full px-4 py-2 rounded bg-panel text-text border border-border focus:outline-none focus:border-accent disabled:opacity-50"
            >
              {TANKS.map((t) => (
                <option key={t} value={t.toString()}>
                  {t} MPa
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Input Files
            </label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              disabled={isProcessing}
              className="hidden"
              accept=".txt,.csv,.tsv"
            />

            <div className="border-2 border-accent rounded-lg p-4">
              {files.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-subtext mb-4">No files selected</p>
                  <button
                    onClick={handleAddFiles}
                    disabled={isProcessing}
                    className="px-4 py-2 bg-accent text-surface rounded font-medium hover:bg-accent/90 disabled:opacity-50"
                  >
                    Add Files
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                    {files.map((file, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 bg-panel rounded"
                      >
                        <span className="text-text text-sm">{file.name}</span>
                        <button
                          onClick={() => handleRemoveFile(i)}
                          disabled={isProcessing}
                          className="text-red-400 hover:text-red-300 text-xs font-medium disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleAddFiles}
                      disabled={isProcessing}
                      className="px-4 py-2 bg-accent text-surface rounded font-medium hover:bg-accent/90 disabled:opacity-50 text-sm"
                    >
                      Add Files
                    </button>
                    <button
                      onClick={handleClearFiles}
                      disabled={isProcessing}
                      className="px-4 py-2 bg-panel text-text rounded font-medium hover:bg-panel/80 disabled:opacity-50 text-sm"
                    >
                      Clear All
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <button
            onClick={handleProcessFiles}
            disabled={isProcessing || files.length === 0}
            className="w-full px-6 py-3 bg-accent text-surface rounded font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            {isProcessing ? "Processing..." : "Process Files"}
          </button>

          {results.length > 0 && (
            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-medium text-text mb-3">Results</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {results.map((result, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded text-sm ${
                      result.success
                        ? "bg-green-500/10 text-green-300 border border-green-500/30"
                        : "bg-red-500/10 text-red-300 border border-red-500/30"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{result.filename}</p>
                        <p className="text-xs opacity-80">{result.message}</p>
                      </div>
                      {result.downloadUrl && (
                        <a
                          href={result.downloadUrl}
                          download={`${result.filename.split(".")[0]}_SOC_${tank}MPa.${result.filename.split(".").pop()}`}
                          className="px-2 py-1 bg-accent text-surface rounded text-xs font-medium hover:bg-accent/90 whitespace-nowrap ml-2"
                        >
                          Download
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
