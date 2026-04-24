import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { assets as defaultAssets, type Asset } from '../data/assets';

interface Props {
  onAssetSelect?: (asset: Asset) => void;
}

export function AssetLookup({ onAssetSelect }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assets, setAssets] = useState<Asset[]>(defaultAssets);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search within current assets
  const searchAssets = (searchQuery: string): Asset[] => {
    const searchTerm = searchQuery.trim().toLowerCase();
    if (!searchTerm) return [];

    return assets.filter(a =>
      a.assetNumber.toLowerCase().includes(searchTerm) ||
      a.description.toLowerCase().includes(searchTerm) ||
      a.manufacturer.toLowerCase().includes(searchTerm) ||
      a.model.toLowerCase().includes(searchTerm) ||
      a.category?.toLowerCase().includes(searchTerm) ||
      a.serialNumber?.toLowerCase().includes(searchTerm)
    );
  };

  const handleSearch = (value: string) => {
    setQuery(value);
    if (value.trim().length > 0) {
      setResults(searchAssets(value));
    } else {
      setResults([]);
    }
    setSelectedAsset(null);
  };

  const handleSelect = (asset: Asset) => {
    setSelectedAsset(asset);
    setQuery(asset.assetNumber);
    setResults([]);
    onAssetSelect?.(asset);
  };

  const isOverdue = (dateStr: string) => {
    if (!dateStr) return false;
    const dueDate = new Date(dateStr);
    return dueDate < new Date();
  };

  // Handle Excel file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

        if (!jsonData || jsonData.length < 2) {
          setUploadStatus('File appears empty or has no data rows');
          return;
        }

        // Find header row - look for row containing "asset" or similar
        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(5, jsonData.length); i++) {
          const row = jsonData[i];
          if (row && row.some(cell =>
            cell && cell.toString().toLowerCase().includes('asset')
          )) {
            headerRowIdx = i;
            break;
          }
        }

        const headerRow = jsonData[headerRowIdx] || [];
        const headers = headerRow.map(h => h?.toString().toLowerCase().trim() || '');

        // Map column names to indices with flexible matching
        const findCol = (keywords: string[]) =>
          headers.findIndex(h => h && keywords.some(k => h.includes(k)));

        // New template columns
        const assetIdx = findCol(['asset']);
        const serialIdx = findCol(['serial']);
        const descIdx = findCol(['description', 'desc']);
        const custodianIdx = findCol(['custodian', 'owner']);
        const noCalIdx = findCol(['no cal', 'calibration required']);
        const calDueIdx = findCol(['calibration due', 'cal due', 'due']);
        const locationIdx = findCol(['location']);
        const notesIdx = findCol(['notes', 'note', 'comment']);
        const deptIdx = findCol(['department', 'dept']);
        const modelIdx = findCol(['model']);
        const mfgIdx = findCol(['manufacturer', 'mfg', 'maker']);
        const typeIdx = findCol(['type']);
        const categoryIdx = findCol(['category', 'cat']);

        // Legacy columns (for backward compatibility)
        const statusIdx = findCol(['status']);
        const rangeIdx = findCol(['range']);
        const rangeLowIdx = headers.findIndex(h => h?.includes('range') && h?.includes('low'));
        const rangeHighIdx = headers.findIndex(h => h?.includes('range') && h?.includes('high'));
        const rangeUnitsIdx = headers.findIndex(h => h?.includes('range') && h?.includes('unit'));
        const accuracyIdx = findCol(['accuracy', 'acc', 'tolerance']);
        const outputHighIdx = headers.findIndex(h => h?.includes('output') && h?.includes('high'));
        const outputLowIdx = headers.findIndex(h => h?.includes('output') && h?.includes('low'));
        const outputUnitsIdx = headers.findIndex(h => h?.includes('output') && h?.includes('unit'));

        // Debug: log what we found
        console.log('Headers found:', headers);
        console.log('Asset column index:', assetIdx);
        console.log('Total rows:', jsonData.length);

        if (assetIdx === -1) {
          setUploadStatus(`Could not find asset column. Headers found: ${headers.slice(0, 5).join(', ')}...`);
          return;
        }

        // Parse rows into assets (start after header row)
        const newAssets: Asset[] = [];
        for (let i = headerRowIdx + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row) continue;

          // Get asset value - handle numbers and strings
          const assetValue = row[assetIdx];
          if (assetValue === undefined || assetValue === null || assetValue === '') continue;

          const getCell = (idx: number) => idx >= 0 && row[idx] !== undefined ? row[idx]?.toString() || '' : '';

          // Handle date formatting for calibration due
          let calibrationDue = '';
          const calDueRaw = calDueIdx >= 0 ? row[calDueIdx] : undefined;
          if (calDueRaw) {
            if (typeof calDueRaw === 'number') {
              try {
                const date = XLSX.SSF.parse_date_code(calDueRaw);
                calibrationDue = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
              } catch {
                calibrationDue = calDueRaw.toString();
              }
            } else {
              calibrationDue = calDueRaw.toString().slice(0, 10);
            }
          }

          // Handle "No Calibration Required" - can be boolean or string
          const noCalRaw = noCalIdx >= 0 ? row[noCalIdx] : undefined;
          const noCalRequired = noCalRaw === true ||
            (typeof noCalRaw === 'string' && noCalRaw.toLowerCase() === 'true') ||
            (typeof noCalRaw === 'string' && noCalRaw.toLowerCase() === 'yes');

          newAssets.push({
            assetNumber: assetValue.toString(),
            serialNumber: getCell(serialIdx),
            description: getCell(descIdx),
            custodian: getCell(custodianIdx),
            noCalRequired,
            calibrationDue,
            location: getCell(locationIdx),
            notes: getCell(notesIdx),
            department: getCell(deptIdx),
            model: getCell(modelIdx),
            manufacturer: getCell(mfgIdx),
            type: getCell(typeIdx),
            category: getCell(categoryIdx),
            // Legacy fields
            status: getCell(statusIdx),
            range: getCell(rangeIdx),
            rangeLow: getCell(rangeLowIdx),
            rangeHigh: getCell(rangeHighIdx),
            rangeUnits: getCell(rangeUnitsIdx),
            accuracy: getCell(accuracyIdx),
            calDate: calibrationDue,
            outputHigh: getCell(outputHighIdx),
            outputLow: getCell(outputLowIdx),
            outputUnits: getCell(outputUnitsIdx)
          });
        }

        if (newAssets.length > 0) {
          setAssets(newAssets);
          setUploadStatus(`Loaded ${newAssets.length} assets from ${file.name}`);
          setQuery('');
          setResults([]);
          setSelectedAsset(null);
        } else {
          setUploadStatus(`No valid assets found. Found ${jsonData.length} rows but no asset data.`);
        }
      } catch (err) {
        setUploadStatus('Error reading file. Make sure it\'s a valid Excel file.');
        console.error('Excel parse error:', err);
      }
    };
    reader.readAsArrayBuffer(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('active')) return 'status-active';
    if (s.includes('missing')) return 'status-missing';
    if (s.includes('disposed')) return 'status-disposed';
    return '';
  };

  return (
    <div className="asset-lookup">
      <div className="lookup-header">
        <h3>Asset Lookup</h3>
        <p className="lookup-hint">Type asset number, model, or manufacturer to find equipment</p>
      </div>

      <div className="lookup-input-wrapper">
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Enter asset number (e.g., 33204)"
          className="lookup-input"
        />
        {results.length > 0 && (
          <div className="lookup-dropdown">
            {results.map((asset, idx) => (
              <div
                key={`${asset.assetNumber}-${idx}`}
                className="lookup-option"
                onClick={() => handleSelect(asset)}
              >
                <span className="option-asset">{asset.assetNumber}</span>
                <span className="option-desc">{asset.manufacturer} {asset.model} - {asset.description}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedAsset && (
        <div className="asset-info-card">
          <div className="asset-info-header">
            <span className="asset-title">{selectedAsset.assetNumber}</span>
            {selectedAsset.noCalRequired ? (
              <span className="status-badge status-no-cal">No Cal Required</span>
            ) : selectedAsset.status ? (
              <span className={`status-badge ${getStatusColor(selectedAsset.status)}`}>
                {selectedAsset.status}
              </span>
            ) : null}
          </div>

          <div className="asset-info-row">
            <span className="info-label">Manufacturer:</span>
            <span className="info-value">{selectedAsset.manufacturer}</span>
          </div>
          <div className="asset-info-row">
            <span className="info-label">Model:</span>
            <span className="info-value">{selectedAsset.model}</span>
          </div>
          <div className="asset-info-row">
            <span className="info-label">Description:</span>
            <span className="info-value">{selectedAsset.description}</span>
          </div>

          {selectedAsset.serialNumber && (
            <div className="asset-info-row">
              <span className="info-label">Serial No:</span>
              <span className="info-value">{selectedAsset.serialNumber}</span>
            </div>
          )}

          {selectedAsset.category && (
            <div className="asset-info-row">
              <span className="info-label">Category:</span>
              <span className="info-value">{selectedAsset.category}</span>
            </div>
          )}

          {selectedAsset.type && (
            <div className="asset-info-row">
              <span className="info-label">Type:</span>
              <span className="info-value">{selectedAsset.type}</span>
            </div>
          )}

          {selectedAsset.accuracy && (
            <div className="asset-info-row highlight">
              <span className="info-label">Accuracy:</span>
              <span className="info-value accuracy">{selectedAsset.accuracy}</span>
            </div>
          )}

          {(selectedAsset.rangeHigh || selectedAsset.range) && (
            <div className="asset-info-row">
              <span className="info-label">Range:</span>
              <span className="info-value">
                {selectedAsset.rangeLow && `${selectedAsset.rangeLow} to `}
                {selectedAsset.rangeHigh} {selectedAsset.rangeUnits}
                {!selectedAsset.rangeHigh && selectedAsset.range}
              </span>
            </div>
          )}

          {selectedAsset.outputHigh && (
            <div className="asset-info-row">
              <span className="info-label">Output:</span>
              <span className="info-value">
                {selectedAsset.outputLow}-{selectedAsset.outputHigh} {selectedAsset.outputUnits}
              </span>
            </div>
          )}

          {selectedAsset.calibrationDue && !selectedAsset.noCalRequired && (
            <div className="asset-info-row">
              <span className="info-label">Cal Due:</span>
              <span className={`info-value ${isOverdue(selectedAsset.calibrationDue) ? 'overdue' : ''}`}>
                {selectedAsset.calibrationDue}
                {isOverdue(selectedAsset.calibrationDue) && ' (OVERDUE)'}
              </span>
            </div>
          )}

          {selectedAsset.custodian && (
            <div className="asset-info-row">
              <span className="info-label">Custodian:</span>
              <span className="info-value">{selectedAsset.custodian}</span>
            </div>
          )}

          {selectedAsset.location && (
            <div className="asset-info-row">
              <span className="info-label">Location:</span>
              <span className="info-value">{selectedAsset.location}</span>
            </div>
          )}

          {selectedAsset.department && (
            <div className="asset-info-row">
              <span className="info-label">Department:</span>
              <span className="info-value">{selectedAsset.department}</span>
            </div>
          )}

          {selectedAsset.notes && (
            <div className="asset-info-row">
              <span className="info-label">Notes:</span>
              <span className="info-value notes">{selectedAsset.notes}</span>
            </div>
          )}
        </div>
      )}

      <div className="upload-section">
        <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '0.5rem', borderLeft: '4px solid #4CAF50' }}>
          <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', fontSize: '0.95rem' }}>📁 Find the Asset List</p>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#333' }}>
            The instrumentation list is located at:<br />
            <code style={{ display: 'block', marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#fff', borderRadius: '0.3rem', fontFamily: 'monospace', fontSize: '0.85rem' }}>
              S:\07 LIBRARY\05 Calculators, Lookups and Guides\Uncertainty Measurement Asset Lists
            </code>
          </p>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: '#666' }}>
            Download the Excel file and upload it here to search for your equipment.
          </p>
        </div>
        <label className="upload-btn">
          Upload Asset List (.xlsx)
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </label>
        {uploadStatus && <p className="upload-status">{uploadStatus}</p>}
        <p className="asset-count">{assets.length} assets loaded</p>
      </div>
    </div>
  );
}
