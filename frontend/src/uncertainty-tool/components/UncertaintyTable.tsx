import type { UncertaintyBudget } from '../calculations/uncertainty';
import { formatUncertainty } from '../calculations/uncertainty';

interface Props {
  budget: UncertaintyBudget;
}

export function UncertaintyTable({ budget }: Props) {
  return (
    <div className="uncertainty-table-wrapper">
      <table className="uncertainty-table">
        <thead>
          <tr>
            <th>Source</th>
            <th>Description</th>
            <th>Value</th>
            <th>Distribution</th>
            <th>Divisor</th>
            <th>Std. Uncertainty (u)</th>
            <th>Contribution</th>
          </tr>
        </thead>
        <tbody>
          {budget.components.map((component, index) => (
            <tr key={index}>
              <td className="source-cell">{component.name}</td>
              <td className="description-cell">{component.description}</td>
              <td className="value-cell">
                ±{formatUncertainty(component.value)} {component.unit}
              </td>
              <td className="distribution-cell">
                <span className={`dist-badge ${component.distribution}`}>
                  {component.distribution}
                </span>
              </td>
              <td className="divisor-cell">{component.divisor.toFixed(2)}</td>
              <td className="uncertainty-cell">
                {component.standardUncertainty.toExponential(3)} {component.unit}
              </td>
              <td className="contribution-cell">
                <div className="contribution-bar-container">
                  <div
                    className="contribution-bar"
                    style={{ width: `${Math.min(component.contribution, 100)}%` }}
                  />
                  <span className="contribution-value">
                    {component.contribution.toFixed(1)}%
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="combined-row">
            <td colSpan={5}>Combined Standard Uncertainty (u<sub>c</sub>)</td>
            <td colSpan={2}>
              {budget.combinedUncertainty.toExponential(3)} {budget.unit}
            </td>
          </tr>
          <tr className="expanded-row">
            <td colSpan={5}>
              Expanded Uncertainty (U = k × u<sub>c</sub>, k={budget.coverageFactor})
            </td>
            <td colSpan={2}>
              <strong>±{formatUncertainty(budget.expandedUncertainty)} {budget.unit}</strong>
            </td>
          </tr>
        </tfoot>
      </table>

      <div className="table-notes">
        <p><strong>Notes:</strong></p>
        <ul>
          <li><strong>Normal distribution</strong> (divisor = 1): Used for calibration uncertainties and noise measurements</li>
          <li><strong>Rectangular distribution</strong> (divisor = √3 ≈ 1.73): Used for manufacturer specifications with ± limits</li>
          <li><strong>Triangular distribution</strong> (divisor = √6 ≈ 2.45): Used when values are more likely near the center</li>
        </ul>
        <p>The combined uncertainty is calculated using the root-sum-of-squares (RSS) method, assuming all components are uncorrelated.</p>
      </div>
    </div>
  );
}
