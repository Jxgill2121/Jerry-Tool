// Measurement Uncertainty Calculator
// Implements GUM (Guide to the Expression of Uncertainty in Measurement) methodology

import type { PressureTransducer, DAQModule, Thermocouple } from '../data/equipment';

// Individual uncertainty component with metadata
export interface UncertaintyComponent {
  name: string;
  description: string;
  value: number;
  unit: string;
  distribution: 'normal' | 'rectangular' | 'triangular';
  divisor: number;
  standardUncertainty: number;
  contribution: number; // percentage contribution to combined uncertainty
}

// Complete uncertainty budget
export interface UncertaintyBudget {
  components: UncertaintyComponent[];
  combinedUncertainty: number;
  expandedUncertainty: number;
  coverageFactor: number;
  unit: string;
  measurementValue: number;
  relativeUncertainty: number; // as percentage
}

// Distribution divisors per GUM
const DIVISORS = {
  normal: 1, // For calibration uncertainties (k=1)
  rectangular: Math.sqrt(3), // For resolution, uniform distribution
  triangular: Math.sqrt(6) // For triangular distribution
};

/**
 * Calculate standard uncertainty from a specification
 * @param value - The uncertainty value from spec
 * @param distribution - Type of probability distribution
 * @returns Standard uncertainty (u)
 */
function calculateStandardUncertainty(
  value: number,
  distribution: 'normal' | 'rectangular' | 'triangular'
): number {
  return value / DIVISORS[distribution];
}

/**
 * Calculate combined uncertainty using root-sum-of-squares (RSS)
 * This assumes all components are uncorrelated
 */
function combineUncertainties(standardUncertainties: number[]): number {
  const sumOfSquares = standardUncertainties.reduce((sum, u) => sum + u * u, 0);
  return Math.sqrt(sumOfSquares);
}

/**
 * Calculate Pressure Transducer uncertainty budget
 */
export function calculatePTUncertainty(
  pt: PressureTransducer,
  daq: DAQModule,
  pressureMPa: number
): UncertaintyBudget {
  const components: UncertaintyComponent[] = [];

  // 1. PT Accuracy uncertainty
  // Accuracy is given as fraction of FSO
  const ptAccuracyValue = pt.accuracy * pt.fso; // in mA or V
  const ptAccuracyMPa = ptAccuracyValue / pt.ptFactor; // Convert to MPa
  const ptAccuracyU = calculateStandardUncertainty(ptAccuracyMPa, 'rectangular');

  components.push({
    name: 'PT Accuracy',
    description: `${pt.maker} ${pt.model} accuracy specification (${(pt.accuracy * 100).toFixed(2)}% FSO)`,
    value: ptAccuracyMPa,
    unit: 'MPa',
    distribution: 'rectangular',
    divisor: DIVISORS.rectangular,
    standardUncertainty: ptAccuracyU,
    contribution: 0 // Will calculate after
  });

  // 2. PT Thermal Error uncertainty
  const ptThermalValue = pt.thermalError * pt.fso; // in mA or V
  const ptThermalMPa = ptThermalValue / pt.ptFactor; // Convert to MPa
  const ptThermalU = calculateStandardUncertainty(ptThermalMPa, 'rectangular');

  components.push({
    name: 'PT Thermal Error',
    description: `Temperature-induced measurement drift (${(pt.thermalError * 100).toFixed(3)}% FSO)`,
    value: ptThermalMPa,
    unit: 'MPa',
    distribution: 'rectangular',
    divisor: DIVISORS.rectangular,
    standardUncertainty: ptThermalU,
    contribution: 0
  });

  // 3. PT Resolution (if specified)
  if (pt.resolution) {
    const ptResolutionMPa = pt.resolution / pt.ptFactor;
    const ptResolutionU = calculateStandardUncertainty(ptResolutionMPa, 'rectangular');

    components.push({
      name: 'PT Resolution',
      description: 'Pressure transducer resolution limit',
      value: ptResolutionMPa,
      unit: 'MPa',
      distribution: 'rectangular',
      divisor: DIVISORS.rectangular,
      standardUncertainty: ptResolutionU,
      contribution: 0
    });
  }

  // 4. DAQ System Noise
  const daqNoiseMPa = daq.systemNoise / pt.ptFactor;
  const daqNoiseU = calculateStandardUncertainty(daqNoiseMPa, 'normal');

  components.push({
    name: 'DAQ System Noise',
    description: `${daq.maker} ${daq.model} measurement noise (${daq.systemNoise.toExponential(3)} ${daq.noiseUnit})`,
    value: daqNoiseMPa,
    unit: 'MPa',
    distribution: 'normal',
    divisor: DIVISORS.normal,
    standardUncertainty: daqNoiseU,
    contribution: 0
  });

  // 5. DAQ Offset Error
  // Offset error is percentage of range
  const daqOffsetValue = daq.offsetError * daq.range; // in mA or V
  const daqOffsetMPa = daqOffsetValue / pt.ptFactor;
  const daqOffsetU = calculateStandardUncertainty(daqOffsetMPa, 'rectangular');

  components.push({
    name: 'DAQ Offset Error',
    description: `${daq.maker} ${daq.model} zero offset (${(daq.offsetError * 100).toFixed(3)}% of range)`,
    value: daqOffsetMPa,
    unit: 'MPa',
    distribution: 'rectangular',
    divisor: DIVISORS.rectangular,
    standardUncertainty: daqOffsetU,
    contribution: 0
  });

  // 6. DAQ Gain Error
  // Gain error affects the reading proportionally
  const readingInDAQUnits = pressureMPa * pt.ptFactor; // Current reading in mA or V
  const daqGainValue = daq.gainError * readingInDAQUnits; // Error in mA or V
  const daqGainMPa = daqGainValue / pt.ptFactor;
  const daqGainU = calculateStandardUncertainty(daqGainMPa, 'rectangular');

  components.push({
    name: 'DAQ Gain Error',
    description: `${daq.maker} ${daq.model} gain/scale error (${(daq.gainError * 100).toFixed(3)}% of reading)`,
    value: daqGainMPa,
    unit: 'MPa',
    distribution: 'rectangular',
    divisor: DIVISORS.rectangular,
    standardUncertainty: daqGainU,
    contribution: 0
  });

  // Calculate combined uncertainty
  const standardUncertainties = components.map(c => c.standardUncertainty);
  const combinedU = combineUncertainties(standardUncertainties);

  // Calculate contribution percentages
  const totalVariance = standardUncertainties.reduce((sum, u) => sum + u * u, 0);
  components.forEach(c => {
    c.contribution = ((c.standardUncertainty * c.standardUncertainty) / totalVariance) * 100;
  });

  // Expanded uncertainty with k=2 (95% confidence)
  const coverageFactor = 2;
  const expandedU = combinedU * coverageFactor;

  return {
    components,
    combinedUncertainty: combinedU,
    expandedUncertainty: expandedU,
    coverageFactor,
    unit: 'MPa',
    measurementValue: pressureMPa,
    relativeUncertainty: (expandedU / pressureMPa) * 100
  };
}

/**
 * Calculate Thermocouple uncertainty budget
 */
export function calculateTCUncertainty(
  tc: Thermocouple,
  daq: DAQModule,
  temperatureC: number
): UncertaintyBudget {
  const components: UncertaintyComponent[] = [];

  // 1. TC Accuracy
  const tcAccuracyU = calculateStandardUncertainty(tc.accuracy, 'rectangular');

  components.push({
    name: 'TC Accuracy',
    description: `${tc.maker} ${tc.model || 'Type ' + tc.type} accuracy specification (±${tc.accuracy}°C)`,
    value: tc.accuracy,
    unit: '°C',
    distribution: 'rectangular',
    divisor: DIVISORS.rectangular,
    standardUncertainty: tcAccuracyU,
    contribution: 0
  });

  // 2. DAQ System Noise (convert from mV to °C)
  const daqNoiseC = daq.systemNoise / tc.tcFactor;
  const daqNoiseU = calculateStandardUncertainty(daqNoiseC, 'normal');

  components.push({
    name: 'DAQ System Noise',
    description: `${daq.maker} ${daq.model} measurement noise (${daq.systemNoise} ${daq.noiseUnit})`,
    value: daqNoiseC,
    unit: '°C',
    distribution: 'normal',
    divisor: DIVISORS.normal,
    standardUncertainty: daqNoiseU,
    contribution: 0
  });

  // 3. DAQ Offset Error (direct mV for TC DAQ)
  // For NI-9213, offset is given directly in mV
  let daqOffsetMV: number;
  if (typeof daq.offsetError === 'number' && daq.offsetError > 0.01) {
    // Direct mV value (like 0.017 mV for NI-9213)
    daqOffsetMV = daq.offsetError;
  } else {
    // Percentage of range
    daqOffsetMV = daq.offsetError * daq.range;
  }
  const daqOffsetC = daqOffsetMV / tc.tcFactor;
  const daqOffsetU = calculateStandardUncertainty(daqOffsetC, 'rectangular');

  components.push({
    name: 'DAQ Offset Error',
    description: `${daq.maker} ${daq.model} zero offset`,
    value: daqOffsetC,
    unit: '°C',
    distribution: 'rectangular',
    divisor: DIVISORS.rectangular,
    standardUncertainty: daqOffsetU,
    contribution: 0
  });

  // 4. DAQ Gain Error
  const readingMV = temperatureC * tc.tcFactor;
  const daqGainMV = daq.gainError * readingMV;
  const daqGainC = daqGainMV / tc.tcFactor;
  const daqGainU = calculateStandardUncertainty(daqGainC, 'rectangular');

  components.push({
    name: 'DAQ Gain Error',
    description: `${daq.maker} ${daq.model} gain/scale error (${(daq.gainError * 100).toFixed(3)}% of reading)`,
    value: daqGainC,
    unit: '°C',
    distribution: 'rectangular',
    divisor: DIVISORS.rectangular,
    standardUncertainty: daqGainU,
    contribution: 0
  });

  // 5. Cold Junction Compensation error (typical for TC DAQ)
  const cjcError = 0.2; // Typical CJC uncertainty for NI modules
  const cjcU = calculateStandardUncertainty(cjcError, 'rectangular');

  components.push({
    name: 'Cold Junction Compensation',
    description: 'DAQ cold junction compensation uncertainty (typical ±0.2°C)',
    value: cjcError,
    unit: '°C',
    distribution: 'rectangular',
    divisor: DIVISORS.rectangular,
    standardUncertainty: cjcU,
    contribution: 0
  });

  // Calculate combined uncertainty
  const standardUncertainties = components.map(c => c.standardUncertainty);
  const combinedU = combineUncertainties(standardUncertainties);

  // Calculate contribution percentages
  const totalVariance = standardUncertainties.reduce((sum, u) => sum + u * u, 0);
  components.forEach(c => {
    c.contribution = ((c.standardUncertainty * c.standardUncertainty) / totalVariance) * 100;
  });

  // Expanded uncertainty with k=2 (95% confidence)
  const coverageFactor = 2;
  const expandedU = combinedU * coverageFactor;

  return {
    components,
    combinedUncertainty: combinedU,
    expandedUncertainty: expandedU,
    coverageFactor,
    unit: '°C',
    measurementValue: temperatureC,
    relativeUncertainty: (expandedU / temperatureC) * 100
  };
}

/**
 * Format uncertainty value for display
 */
export function formatUncertainty(value: number, significantFigures: number = 2): string {
  if (value === 0) return '0';

  const magnitude = Math.floor(Math.log10(Math.abs(value)));
  const precision = significantFigures - 1 - magnitude;

  if (precision < 0) {
    return value.toFixed(0);
  } else if (precision > 10) {
    return value.toExponential(significantFigures - 1);
  }

  return value.toFixed(Math.max(0, precision));
}

/**
 * Generate a formatted uncertainty statement
 */
export function generateUncertaintyStatement(
  budget: UncertaintyBudget,
  measurementType: string
): string {
  const expanded = formatUncertainty(budget.expandedUncertainty);
  const relative = budget.relativeUncertainty.toFixed(2);

  return `The ${measurementType} measurement uncertainty is ±${expanded} ${budget.unit} ` +
    `(k=${budget.coverageFactor}, 95% confidence level), ` +
    `equivalent to ±${relative}% of the measured value.`;
}
