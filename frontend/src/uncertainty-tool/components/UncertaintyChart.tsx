import { Pie, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
} from 'chart.js';
import type { UncertaintyBudget } from '../calculations/uncertainty';

// Register Chart.js components
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
);

interface Props {
  budget: UncertaintyBudget;
}

// Color palette for charts
const COLORS = [
  'rgba(59, 130, 246, 0.8)',   // Blue
  'rgba(16, 185, 129, 0.8)',   // Green
  'rgba(245, 158, 11, 0.8)',   // Orange
  'rgba(239, 68, 68, 0.8)',    // Red
  'rgba(139, 92, 246, 0.8)',   // Purple
  'rgba(236, 72, 153, 0.8)',   // Pink
  'rgba(20, 184, 166, 0.8)',   // Teal
];

const BORDER_COLORS = [
  'rgba(59, 130, 246, 1)',
  'rgba(16, 185, 129, 1)',
  'rgba(245, 158, 11, 1)',
  'rgba(239, 68, 68, 1)',
  'rgba(139, 92, 246, 1)',
  'rgba(236, 72, 153, 1)',
  'rgba(20, 184, 166, 1)',
];

export function UncertaintyChart({ budget }: Props) {
  const labels = budget.components.map(c => c.name);
  const contributions = budget.components.map(c => c.contribution);
  const standardUncertainties = budget.components.map(c => c.standardUncertainty);

  const pieData = {
    labels,
    datasets: [
      {
        data: contributions,
        backgroundColor: COLORS.slice(0, contributions.length),
        borderColor: BORDER_COLORS.slice(0, contributions.length),
        borderWidth: 2,
      },
    ],
  };

  const barData = {
    labels,
    datasets: [
      {
        label: `Standard Uncertainty (${budget.unit})`,
        data: standardUncertainties,
        backgroundColor: COLORS.slice(0, standardUncertainties.length),
        borderColor: BORDER_COLORS.slice(0, standardUncertainties.length),
        borderWidth: 1,
      },
    ],
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          color: '#e5e7eb',
          font: {
            size: 11,
          },
          padding: 15,
        },
      },
      tooltip: {
        callbacks: {
          label: (context: { label: string; raw: unknown }) => {
            return `${context.label}: ${(context.raw as number).toFixed(1)}%`;
          },
        },
      },
    },
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: { raw: unknown }) => {
            const value = context.raw as number;
            return `u = ${value.toExponential(3)} ${budget.unit}`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: '#9ca3af',
          callback: function(value: string | number) {
            return Number(value).toExponential(1);
          },
        },
        grid: {
          color: 'rgba(156, 163, 175, 0.2)',
        },
        title: {
          display: true,
          text: `Standard Uncertainty (${budget.unit})`,
          color: '#9ca3af',
        },
      },
      y: {
        ticks: {
          color: '#e5e7eb',
          font: {
            size: 11,
          },
        },
        grid: {
          display: false,
        },
      },
    },
  };

  return (
    <div className="charts-grid">
      <div className="chart-wrapper">
        <h4>Contribution to Variance (%)</h4>
        <div className="pie-chart">
          <Pie data={pieData} options={pieOptions} />
        </div>
      </div>
      <div className="chart-wrapper">
        <h4>Standard Uncertainty by Source</h4>
        <div className="bar-chart">
          <Bar data={barData} options={barOptions} />
        </div>
      </div>
    </div>
  );
}
