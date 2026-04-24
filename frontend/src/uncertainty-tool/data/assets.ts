// Asset Database - Equipment inventory with asset numbers
// This file is auto-generated from the asset tracking spreadsheet

export interface Asset {
  assetNumber: string;
  serialNumber: string;
  description: string;
  custodian: string;
  noCalRequired: boolean;
  calibrationDue: string;
  location: string;
  notes: string;
  department: string;
  model: string;
  manufacturer: string;
  type: string;  // A/B/C/D classification
  category: string;
  // Legacy fields for backward compatibility
  status?: string;
  range?: string;
  rangeLow?: string;
  rangeHigh?: string;
  rangeUnits?: string;
  accuracy?: string;
  calDate?: string;
  outputHigh?: string;
  outputLow?: string;
  outputUnits?: string;
}

// Default assets from "new_template_for_instruments.xlsx"
export const assets: Asset[] = [
  {
    assetNumber: "33580",
    serialNumber: "44726",
    description: "Low Pressure Mass Flowmeter",
    custodian: "Wilfredo Pingol",
    noCalRequired: true,
    calibrationDue: "",
    location: "Component Lab",
    notes: "No cal required as per Colin ( June 2022)",
    department: "Advanced Transportation",
    model: "CMS2000BTSH200100",
    manufacturer: "Azbil",
    type: "C",
    category: "Flow"
  }
];

// Lookup function
export function findAsset(assetNumber: string): Asset | undefined {
  const searchTerm = assetNumber.trim().toLowerCase();
  return assets.find(a =>
    a.assetNumber.toLowerCase() === searchTerm ||
    a.assetNumber.toLowerCase().includes(searchTerm)
  );
}

// Search function (partial match)
export function searchAssets(query: string): Asset[] {
  const searchTerm = query.trim().toLowerCase();
  if (!searchTerm) return [];

  return assets.filter(a =>
    a.assetNumber.toLowerCase().includes(searchTerm) ||
    a.description.toLowerCase().includes(searchTerm) ||
    a.manufacturer.toLowerCase().includes(searchTerm) ||
    a.model.toLowerCase().includes(searchTerm) ||
    a.category?.toLowerCase().includes(searchTerm)
  );
}
