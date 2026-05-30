import React from 'react';

/**
 * Placeholder component for irradiance timeseries visualization.
 * The real implementation can be replaced with a chart library (e.g., recharts,
 * chart.js, apexcharts) later. For now it simply displays the received data
 * in JSON format to avoid build errors.
 */
interface IrradianceTimeseriesChartProps {
  /**
   * Expected shape of the timeseries data. It is loosely typed because the exact
   * schema may evolve; the component will just render it safely.
   */
  data: unknown;
  /** Optional title for the chart container */
  title?: string;
}

const IrradianceTimeseriesChart: React.FC<IrradianceTimeseriesChartProps> = ({
  data,
  title = 'Irradiance Timeseries',
}) => {
  return (
    <section className="irradiance-timeseries-chart">
      <h2 className="chart-title" style={{ marginBottom: '1rem' }}>{title}</h2>
      <pre
        style={{
          background: '#111',
          color: '#0f0',
          padding: '1rem',
          borderRadius: '8px',
          overflowX: 'auto',
        }}
      >
        {JSON.stringify(data, null, 2)}
      </pre>
    </section>
  );
};

export default IrradianceTimeseriesChart;
