// Equipment Database - Extracted from UM_Calculator Excel
// Contains all instrumentation data for uncertainty calculations

export interface PressureTransducer {
  id: string;
  maker: string;
  model: string;
  maxInputMPa: number;
  fso: number;
  fsoUnit: string;
  accuracy: number; // as fraction of FSO
  thermalError: number; // as fraction of FSO
  resolution?: number;
  ptFactor: number; // FSO/MaxInput (mA/MPa or V/MPa)
  ptFactorUnit: string;
}

export interface DAQModule {
  id: string;
  maker: string;
  model: string;
  type: string;
  systemNoise: number;
  noiseUnit: string;
  offsetError: number; // as percentage
  gainError: number; // as percentage
  range: number;
  rangeUnit: string;
}

export interface Thermocouple {
  id: string;
  maker: string;
  model?: string;
  type: string;
  maxTempC: number;
  maxOutputMV: number;
  accuracy: number; // in °C
  tcFactor: number; // mV/°C
}

// Pressure Transducers from Look up sheet
export const pressureTransducers: PressureTransducer[] = [
  {
    id: 'noshok-pt41',
    maker: 'NoShok',
    model: 'PT41',
    maxInputMPa: 58000 * 0.00689476, // ~399.7 MPa
    fso: 16,
    fsoUnit: 'mA',
    accuracy: 0.0052,
    thermalError: 0.002,
    ptFactor: 16 / (58000 * 0.00689476),
    ptFactorUnit: 'mA/MPa'
  },
  {
    id: 'noshok-621',
    maker: 'NoShok',
    model: '621',
    maxInputMPa: 15000 * 0.00689476, // ~103.4 MPa
    fso: 16, // 20-4
    fsoUnit: 'mA',
    accuracy: 0.0025,
    thermalError: 0.00011,
    ptFactor: 16 / (15000 * 0.00689476),
    ptFactorUnit: 'mA/MPa'
  },
  {
    id: 'noshok-622',
    maker: 'NoShok',
    model: '622',
    maxInputMPa: 15000 * 0.00689476,
    fso: 16,
    fsoUnit: 'mA',
    accuracy: 0.0025,
    thermalError: 0.00011,
    ptFactor: 16 / (15000 * 0.00689476),
    ptFactorUnit: 'mA/MPa'
  },
  {
    id: 'noshok-623',
    maker: 'NoShok',
    model: '623',
    maxInputMPa: 15000 * 0.00689476,
    fso: 16,
    fsoUnit: 'mA',
    accuracy: 0.0025,
    thermalError: 0.00011,
    ptFactor: 16 / (15000 * 0.00689476),
    ptFactorUnit: 'mA/MPa'
  },
  {
    id: 'noshok-624',
    maker: 'NoShok',
    model: '624',
    maxInputMPa: 15000 * 0.00689476,
    fso: 16,
    fsoUnit: 'mA',
    accuracy: 0.0025,
    thermalError: 0.00011,
    ptFactor: 16 / (15000 * 0.00689476),
    ptFactorUnit: 'mA/MPa'
  },
  {
    id: 'noshok-625',
    maker: 'NoShok',
    model: '625',
    maxInputMPa: 15000 * 0.00689476,
    fso: 20,
    fsoUnit: 'mA',
    accuracy: 0.0025,
    thermalError: 0.00011,
    ptFactor: 20 / (15000 * 0.00689476),
    ptFactorUnit: 'mA/MPa'
  },
  {
    id: 'noshok-626',
    maker: 'NoShok',
    model: '626',
    maxInputMPa: 15000 * 0.00689476,
    fso: 16,
    fsoUnit: 'mA',
    accuracy: 0.0025,
    thermalError: 0.00011,
    ptFactor: 16 / (15000 * 0.00689476),
    ptFactorUnit: 'mA/MPa'
  },
  {
    id: 'stellar-gt16xx',
    maker: 'Stellar',
    model: 'GT16XX',
    maxInputMPa: 15000 * 0.00689476,
    fso: 4.9,
    fsoUnit: 'V',
    accuracy: 0.0025,
    thermalError: 0.0002,
    resolution: 0.00025,
    ptFactor: 4.9 / (15000 * 0.00689476),
    ptFactorUnit: 'V/MPa'
  },
  {
    id: 'stellar-gt18xx',
    maker: 'Stellar',
    model: 'GT18XX',
    maxInputMPa: 20000 * 0.00689476, // ~137.9 MPa
    fso: 4.9,
    fsoUnit: 'V',
    accuracy: 0.0025,
    thermalError: 0.0002,
    resolution: 0.00025,
    ptFactor: 4.9 / (20000 * 0.00689476),
    ptFactorUnit: 'V/MPa'
  },
  {
    id: 'stellar-gt32xx',
    maker: 'Stellar',
    model: 'GT32XX',
    maxInputMPa: 20000 * 0.00689476,
    fso: 4.9,
    fsoUnit: 'V',
    accuracy: 0.0025,
    thermalError: 0.0002,
    resolution: 0.00025,
    ptFactor: 4.9 / (20000 * 0.00689476),
    ptFactorUnit: 'V/MPa'
  }
];

// DAQ Modules from Look up sheet
export const daqModules: DAQModule[] = [
  {
    id: 'ni-9203',
    maker: 'NI',
    model: '9203',
    type: 'PT Current',
    systemNoise: 0.0019683837890625,
    noiseUnit: 'mA',
    offsetError: 0.0006, // 0.06%
    gainError: 0.0018, // 0.18%
    range: 20,
    rangeUnit: 'mA'
  },
  {
    id: 'ni-9208',
    maker: 'NI',
    model: '9208',
    type: 'PT Current',
    systemNoise: 200 / (1000000 * 0.7071), // ~0.000283 mA
    noiseUnit: 'mA',
    offsetError: 0.0004, // 0.04%
    gainError: 0.0076, // 0.76%
    range: 20,
    rangeUnit: 'mA'
  },
  {
    id: 'ni-9253',
    maker: 'NI',
    model: '9253',
    type: 'PT Current',
    systemNoise: 0.00013,
    noiseUnit: 'mA',
    offsetError: 0.0008, // 0.08%
    gainError: 0.0041, // 0.41%
    range: 20,
    rangeUnit: 'mA'
  },
  {
    id: 'ni-9213',
    maker: 'NI',
    model: '9213',
    type: 'TC',
    systemNoise: 0.007,
    noiseUnit: 'mV RMS',
    offsetError: 0.017, // Direct mV offset
    gainError: 0.0016, // 0.16%
    range: 78.125,
    rangeUnit: 'mV'
  },
  {
    id: 'ni-9205',
    maker: 'NI',
    model: '9205',
    type: 'Voltage',
    systemNoise: 240 / 1000000, // 0.00024 V
    noiseUnit: 'V RMS',
    offsetError: 0.00014, // 0.014%
    gainError: 0.000476, // 0.0476%
    range: 10,
    rangeUnit: 'V'
  },
  {
    id: 'ni-9220',
    maker: 'NI',
    model: '9220',
    type: 'Voltage',
    systemNoise: 0.85 * (21.2 / Math.pow(2, 16)), // ~0.000275 V
    noiseUnit: 'V RMS',
    offsetError: 0.0007, // 0.07%
    gainError: 0.001472, // 0.1472%
    range: 10.5,
    rangeUnit: 'V'
  },
  {
    id: 'ni-9215',
    maker: 'NI',
    model: '9215',
    type: 'Voltage',
    systemNoise: 1.2 * (21.2 / Math.pow(2, 16)), // ~0.000388 V
    noiseUnit: 'V RMS',
    offsetError: 0.00082, // 0.082%
    gainError: 0.002, // 0.2%
    range: 10.4,
    rangeUnit: 'V'
  },
  {
    id: 'ni-9239',
    maker: 'NI',
    model: '9239',
    type: 'Voltage',
    systemNoise: 0.00007,
    noiseUnit: 'V RMS',
    offsetError: 0.0006, // 0.06%
    gainError: 0.0013, // 0.13%
    range: 10.52,
    rangeUnit: 'V'
  },
  {
    id: 'ni-9216',
    maker: 'NI',
    model: '9216',
    type: 'RTD',
    systemNoise: 6 / 1000, // 0.006 ohm
    noiseUnit: 'ohm RMS',
    offsetError: 0.083, // Direct ohm offset
    gainError: 0.00048, // 0.048%
    range: 0,
    rangeUnit: 'ohm'
  },
  {
    id: 'ni-9217',
    maker: 'NI',
    model: '9217',
    type: 'RTD',
    systemNoise: 0.02,
    noiseUnit: '°C',
    offsetError: 0,
    gainError: 0,
    range: 50,
    rangeUnit: 'mV'
  },
  {
    id: 'ni-9219',
    maker: 'NI',
    model: '9219',
    type: 'Universal',
    systemNoise: 0.00108 * 25, // 0.027 mA
    noiseUnit: 'mA',
    offsetError: 0.0001, // 0.01%
    gainError: 0.001, // 0.1%
    range: 25,
    rangeUnit: 'mA'
  }
];

// Thermocouples from Look up sheet
export const thermocouples: Thermocouple[] = [
  {
    id: 'omega-t',
    maker: 'Omega',
    model: 'T-316SS12-U-MPJ-6',
    type: 'T',
    maxTempC: 400,
    maxOutputMV: 20.872,
    accuracy: 0.5,
    tcFactor: 20.872 / 400 // ~0.05218 mV/°C
  },
  {
    id: 'conax-t',
    maker: 'Conax',
    model: undefined,
    type: 'T',
    maxTempC: 400,
    maxOutputMV: 20.872,
    accuracy: 0.5,
    tcFactor: 20.872 / 400
  },
  {
    id: 'omega-k',
    maker: 'Omega',
    model: 'SP-BW-K-6',
    type: 'K',
    maxTempC: 1372,
    maxOutputMV: 54.886,
    accuracy: 1.1,
    tcFactor: 54.886 / 1372 // ~0.04 mV/°C
  }
];

// Helper functions to get equipment by type
export function getPTsByMaker(maker: string): PressureTransducer[] {
  return pressureTransducers.filter(pt => pt.maker.toLowerCase() === maker.toLowerCase());
}

export function getDAQsByType(type: string): DAQModule[] {
  return daqModules.filter(daq => daq.type.toLowerCase().includes(type.toLowerCase()));
}

export function getTCsByType(type: string): Thermocouple[] {
  return thermocouples.filter(tc => tc.type.toLowerCase() === type.toLowerCase());
}

// Get compatible DAQ modules for a pressure transducer
export function getCompatibleDAQsForPT(pt: PressureTransducer): DAQModule[] {
  if (pt.fsoUnit === 'mA') {
    return daqModules.filter(daq => daq.type === 'PT Current');
  } else if (pt.fsoUnit === 'V') {
    return daqModules.filter(daq => daq.type === 'Voltage');
  }
  return [];
}

// Get compatible DAQ modules for thermocouples
export function getDAQsForTC(): DAQModule[] {
  return daqModules.filter(daq => daq.type === 'TC');
}
