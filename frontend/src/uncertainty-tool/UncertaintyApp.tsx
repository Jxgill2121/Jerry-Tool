import { useState } from 'react';
import {
  pressureTransducers,
  daqModules,
  thermocouples,
  getCompatibleDAQsForPT,
  getDAQsForTC,
  type PressureTransducer,
  type DAQModule,
  type Thermocouple
} from './data/equipment';
import {
  calculatePTUncertainty,
  calculateTCUncertainty,
  formatUncertainty,
  type UncertaintyBudget
} from './calculations/uncertainty';
import { UncertaintyChart } from './components/UncertaintyChart';
import { AssetLookup } from './components/AssetLookup';
import './UncertaintyApp.css';

type MeasurementType = 'pressure' | 'temperature';

function UncertaintyApp() {
  // Measurement type selection
  const [measurementType, setMeasurementType] = useState<MeasurementType>('pressure');

  // Pressure measurement state
  const [selectedPT, setSelectedPT] = useState<PressureTransducer | null>(null);
  const [selectedPTDAQ, setSelectedPTDAQ] = useState<DAQModule | null>(null);
  const [pressureValue, setPressureValue] = useState<string>('87');

  // Temperature measurement state
  const [selectedTC, setSelectedTC] = useState<Thermocouple | null>(null);
  const [selectedTCDAQ, setSelectedTCDAQ] = useState<DAQModule | null>(null);
  const [temperatureValue, setTemperatureValue] = useState<string>('35');

  // Results
  const [ptBudget, setPTBudget] = useState<UncertaintyBudget | null>(null);
  const [tcBudget, setTCBudget] = useState<UncertaintyBudget | null>(null);

  // Get compatible DAQs
  const compatiblePTDAQs = selectedPT ? getCompatibleDAQsForPT(selectedPT) : [];
  const tcDAQs = getDAQsForTC();

  // Handle PT selection
  const handlePTChange = (ptId: string) => {
    const pt = pressureTransducers.find(p => p.id === ptId) || null;
    setSelectedPT(pt);
    setSelectedPTDAQ(null); // Reset DAQ when PT changes
    setPTBudget(null);
  };

  // Handle TC selection
  const handleTCChange = (tcId: string) => {
    const tc = thermocouples.find(t => t.id === tcId) || null;
    setSelectedTC(tc);
    setTCBudget(null);
  };

  // Calculate pressure uncertainty
  const calculatePressure = () => {
    if (!selectedPT || !selectedPTDAQ) return;
    const pressure = parseFloat(pressureValue);
    if (isNaN(pressure) || pressure <= 0) return;

    const budget = calculatePTUncertainty(selectedPT, selectedPTDAQ, pressure);
    setPTBudget(budget);
  };

  // Calculate temperature uncertainty
  const calculateTemperature = () => {
    if (!selectedTC || !selectedTCDAQ) return;
    const temp = parseFloat(temperatureValue);
    if (isNaN(temp) || temp <= 0) return;

    const budget = calculateTCUncertainty(selectedTC, selectedTCDAQ, temp);
    setTCBudget(budget);
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Measurement Uncertainty Calculator</h1>
        <p className="subtitle">GUM-compliant uncertainty analysis for instrumentation</p>
      </header>

      <main className="main">
        {/* Asset Lookup */}
        <AssetLookup />

        {/* Measurement Type Tabs */}
        <div className="tabs">
          <button
            className={`tab ${measurementType === 'pressure' ? 'active' : ''}`}
            onClick={() => setMeasurementType('pressure')}
          >
            Pressure Measurement
          </button>
          <button
            className={`tab ${measurementType === 'temperature' ? 'active' : ''}`}
            onClick={() => setMeasurementType('temperature')}
          >
            Temperature Measurement
          </button>
        </div>

        {/* Pressure Calculator */}
        {measurementType === 'pressure' && (
          <div className="calculator-section">
            <div className="input-panel">
              <h2>Equipment Selection</h2>

              <div className="form-group">
                <label htmlFor="pt-select">Pressure Transducer</label>
                <select
                  id="pt-select"
                  value={selectedPT?.id || ''}
                  onChange={(e) => handlePTChange(e.target.value)}
                >
                  <option value="">Select a pressure transducer...</option>
                  <optgroup label="NoShok">
                    {pressureTransducers
                      .filter(pt => pt.maker === 'NoShok')
                      .map(pt => (
                        <option key={pt.id} value={pt.id}>
                          {pt.model} ({pt.maxInputMPa.toFixed(1)} MPa max, {pt.fso} {pt.fsoUnit} FSO)
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Stellar">
                    {pressureTransducers
                      .filter(pt => pt.maker === 'Stellar')
                      .map(pt => (
                        <option key={pt.id} value={pt.id}>
                          {pt.model} ({pt.maxInputMPa.toFixed(1)} MPa max, {pt.fso} {pt.fsoUnit} FSO)
                        </option>
                      ))}
                  </optgroup>
                </select>
                {selectedPT && (
                  <div className="equipment-info">
                    <span>Accuracy: {(selectedPT.accuracy * 100).toFixed(2)}% FSO</span>
                    <span>Thermal: ±{(selectedPT.thermalError * 100).toFixed(3)}% FSO</span>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="pt-daq-select">DAQ Module</label>
                <select
                  id="pt-daq-select"
                  value={selectedPTDAQ?.id || ''}
                  onChange={(e) => setSelectedPTDAQ(
                    daqModules.find(d => d.id === e.target.value) || null
                  )}
                  disabled={!selectedPT}
                >
                  <option value="">
                    {selectedPT ? 'Select a compatible DAQ...' : 'Select PT first'}
                  </option>
                  {compatiblePTDAQs.map(daq => (
                    <option key={daq.id} value={daq.id}>
                      {daq.maker} {daq.model} ({daq.type}, {daq.range} {daq.rangeUnit} range)
                    </option>
                  ))}
                </select>
                {selectedPTDAQ && (
                  <div className="equipment-info">
                    <span>Offset: {(selectedPTDAQ.offsetError * 100).toFixed(3)}%</span>
                    <span>Gain: {(selectedPTDAQ.gainError * 100).toFixed(3)}%</span>
                    <span>Noise: {selectedPTDAQ.systemNoise.toExponential(2)} {selectedPTDAQ.noiseUnit}</span>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="pressure-input">Measurement Value (MPa)</label>
                <div className="input-with-unit">
                  <input
                    id="pressure-input"
                    type="number"
                    value={pressureValue}
                    onChange={(e) => setPressureValue(e.target.value)}
                    placeholder="Enter pressure in MPa"
                    step="0.1"
                    min="0"
                  />
                  <span className="unit">MPa</span>
                </div>
                {selectedPT && (
                  <div className="input-hint">
                    Max range: {selectedPT.maxInputMPa.toFixed(1)} MPa
                  </div>
                )}
              </div>

              <button
                className="calculate-btn"
                onClick={calculatePressure}
                disabled={!selectedPT || !selectedPTDAQ || !pressureValue}
              >
                Calculate Uncertainty
              </button>
            </div>

            {/* Results Panel */}
            {ptBudget && (
              <div className="results-panel">
                <h2>Uncertainty Analysis Results</h2>

                <div className="result-summary">
                  <div className="result-card primary">
                    <div className="result-label">Expanded Uncertainty (k=2)</div>
                    <div className="result-value">
                      ±{formatUncertainty(ptBudget.expandedUncertainty)} {ptBudget.unit}
                    </div>
                    <div className="result-sublabel">95% confidence level</div>
                  </div>
                </div>

                <div className="statement-box">
                  <h3>Official Report Statement</h3>
                  <p className="report-statement">
                    "Measured pressure: <strong>{ptBudget.measurementValue.toFixed(1)} ± {formatUncertainty(ptBudget.expandedUncertainty)} {ptBudget.unit}</strong> (k=2, 95% confidence)"
                  </p>
                  <p className="range-explanation">
                    This means you are 95% confident the true pressure is between <strong>{(ptBudget.measurementValue - ptBudget.expandedUncertainty).toFixed(1)} {ptBudget.unit}</strong> and <strong>{(ptBudget.measurementValue + ptBudget.expandedUncertainty).toFixed(1)} {ptBudget.unit}</strong>.
                  </p>
                </div>

                <div className="charts-section">
                  <h3>Uncertainty Contributors</h3>
                  <div className="chart-container">
                    <UncertaintyChart budget={ptBudget} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Temperature Calculator */}
        {measurementType === 'temperature' && (
          <div className="calculator-section">
            <div className="input-panel">
              <h2>Equipment Selection</h2>

              <div className="form-group">
                <label htmlFor="tc-select">Thermocouple</label>
                <select
                  id="tc-select"
                  value={selectedTC?.id || ''}
                  onChange={(e) => handleTCChange(e.target.value)}
                >
                  <option value="">Select a thermocouple...</option>
                  {thermocouples.map(tc => (
                    <option key={tc.id} value={tc.id}>
                      {tc.maker} {tc.model || `Type ${tc.type}`} (±{tc.accuracy}°C, max {tc.maxTempC}°C)
                    </option>
                  ))}
                </select>
                {selectedTC && (
                  <div className="equipment-info">
                    <span>Type: {selectedTC.type}</span>
                    <span>Accuracy: ±{selectedTC.accuracy}°C</span>
                    <span>Sensitivity: {(selectedTC.tcFactor * 1000).toFixed(2)} µV/°C</span>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="tc-daq-select">DAQ Module</label>
                <select
                  id="tc-daq-select"
                  value={selectedTCDAQ?.id || ''}
                  onChange={(e) => setSelectedTCDAQ(
                    daqModules.find(d => d.id === e.target.value) || null
                  )}
                >
                  <option value="">Select a TC DAQ module...</option>
                  {tcDAQs.map(daq => (
                    <option key={daq.id} value={daq.id}>
                      {daq.maker} {daq.model} ({daq.range} {daq.rangeUnit} range)
                    </option>
                  ))}
                </select>
                {selectedTCDAQ && (
                  <div className="equipment-info">
                    <span>Noise: {selectedTCDAQ.systemNoise} {selectedTCDAQ.noiseUnit}</span>
                    <span>Gain: {(selectedTCDAQ.gainError * 100).toFixed(3)}%</span>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="temp-input">Measurement Value (°C)</label>
                <div className="input-with-unit">
                  <input
                    id="temp-input"
                    type="number"
                    value={temperatureValue}
                    onChange={(e) => setTemperatureValue(e.target.value)}
                    placeholder="Enter temperature in °C"
                    step="1"
                    min="0"
                  />
                  <span className="unit">°C</span>
                </div>
                {selectedTC && (
                  <div className="input-hint">
                    Max range: {selectedTC.maxTempC}°C
                  </div>
                )}
              </div>

              <button
                className="calculate-btn"
                onClick={calculateTemperature}
                disabled={!selectedTC || !selectedTCDAQ || !temperatureValue}
              >
                Calculate Uncertainty
              </button>
            </div>

            {/* Results Panel */}
            {tcBudget && (
              <div className="results-panel">
                <h2>Uncertainty Analysis Results</h2>

                <div className="result-summary">
                  <div className="result-card primary">
                    <div className="result-label">Expanded Uncertainty (k=2)</div>
                    <div className="result-value">
                      ±{formatUncertainty(tcBudget.expandedUncertainty)} {tcBudget.unit}
                    </div>
                    <div className="result-sublabel">95% confidence level</div>
                  </div>
                </div>

                <div className="statement-box">
                  <h3>Official Report Statement</h3>
                  <p className="report-statement">
                    "Measured temperature: <strong>{tcBudget.measurementValue.toFixed(1)} ± {formatUncertainty(tcBudget.expandedUncertainty)} {tcBudget.unit}</strong> (k=2, 95% confidence)"
                  </p>
                  <p className="range-explanation">
                    This means you are 95% confident the true temperature is between <strong>{(tcBudget.measurementValue - tcBudget.expandedUncertainty).toFixed(1)} {tcBudget.unit}</strong> and <strong>{(tcBudget.measurementValue + tcBudget.expandedUncertainty).toFixed(1)} {tcBudget.unit}</strong>.
                  </p>
                </div>

                <div className="charts-section">
                  <h3>Uncertainty Contributors</h3>
                  <div className="chart-container">
                    <UncertaintyChart budget={tcBudget} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="footer">
        <p>Based on GUM (Guide to the Expression of Uncertainty in Measurement) methodology</p>
        <p>Coverage factor k=2 provides approximately 95% confidence level</p>
      </footer>
    </div>
  );
}

export default UncertaintyApp;
