import { useEffect, useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, ErrorBar, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts';
import { AlertTriangle, CheckCircle2, Download, Play, RefreshCw, WandSparkles } from 'lucide-react';
import { useDataset } from '../context/DatasetContext';
import { getHealth } from '../services/healthService';
import { getVisualizationPreview, getVisualizationRecommendations, type ChartRecommendation, type VisualizationPreview } from '../services/visualizationService';
import type { HealthReport } from '../services/healthService';

type ChartType = 'bar' | 'line' | 'pie' | 'scatter' | 'box_plot' | 'histogram';
type ChartDatum = Record<string, unknown>;
type ScatterPoint = { x: number; y: number };
type ReportChart = { recommendation: ChartRecommendation; preview?: VisualizationPreview; error?: string };

const normalizeChartType = (chartType: string | null | undefined): ChartType => chartType === 'box' ? 'box_plot' : (chartType as ChartType);
const chartLabels: Record<ChartType, string> = {
  bar: 'Bar chart', line: 'Line chart', pie: 'Proportion chart', scatter: 'Scatter plot', box_plot: 'Box plot', histogram: 'Histogram',
};

function ChartVisual({ chart, onDownload }: { chart: ReportChart; onDownload: (chart: ReportChart) => void }) {
  if (chart.error || !chart.preview) return <div className="report-chart-error" role="alert">{chart.error || 'Chart data was not returned by the backend.'}</div>;
  const type = normalizeChartType(chart.recommendation.chart_type);
  const preview = chart.preview;
  const series = (preview.labels ?? []).map((label, index) => ({ label: String(label), value: preview.values?.[index] ?? 0 }));
  const scatter = (preview.x ?? []).map((x, index) => ({ x, y: preview.y?.[index] })).filter((point): point is ScatterPoint => Number.isFinite(point.x) && Number.isFinite(point.y));
  const histogram = (preview.bins ?? []).slice(0, -1).map((bin, index) => ({ label: `${bin.toPrecision(4)}–${preview.bins?.[index + 1]?.toPrecision(4)}`, value: preview.counts?.[index] ?? 0 }));
  const box = preview.groups ?? [];
  const total = series.reduce((sum, item) => sum + item.value, 0);
  const title = preview.title || `${chartLabels[type]}: ${chart.recommendation.x_column}`;
  const downloadRows: ChartDatum[] = type === 'scatter' ? scatter : type === 'histogram' ? histogram : type === 'box_plot' ? box : series;

  return <article className="report-chart-card">
    <header><div><span className="report-chart-type">{chartLabels[type]}</span><h3>{title}</h3><p>{chart.recommendation.reason}</p></div><button className="chart-action-button" onClick={() => onDownload({ ...chart, preview: { ...preview, labels: downloadRows.map((row) => String(row.label ?? row.x ?? '') ), values: downloadRows.map((row) => Number(row.value ?? row.y ?? row.median ?? 0)) } })} aria-label={`Download ${title} chart data`} title="Download chart data"><Download size={15} /></button></header>
    <div className="report-chart-canvas">
      <ResponsiveContainer width="100%" height="100%">
        {type === 'scatter'
          ? <ScatterChart margin={{ top: 12, right: 16, bottom: 20, left: 8 }}><CartesianGrid stroke="#e3e9eb" /><XAxis type="number" dataKey="x" name={chart.recommendation.x_column} label={{ value: chart.recommendation.x_column, position: 'insideBottom', offset: -10 }} /><YAxis type="number" dataKey="y" name={chart.recommendation.y_column || 'Value'} label={{ value: chart.recommendation.y_column || 'Value', angle: -90, position: 'insideLeft' }} /><Tooltip /><Scatter data={scatter} fill="#176b53" /></ScatterChart>
          : type === 'line'
            ? <LineChart data={series} margin={{ top: 12, right: 16, bottom: 20, left: 8 }}><CartesianGrid stroke="#e3e9eb" /><XAxis dataKey="label" /><YAxis /><Tooltip /><Legend /><Line dataKey="value" name={chart.recommendation.y_column || 'Value'} stroke="#176b53" strokeWidth={2} dot={false} /></LineChart>
            : type === 'pie'
              ? <PieChart><Tooltip formatter={(value: unknown) => { const numeric = Number(value); return [`${numeric.toLocaleString()} (${total ? ((numeric / total) * 100).toFixed(1) : 0}%)`, 'Value']; }} /><Legend /><Pie data={series} dataKey="value" nameKey="label" cx="50%" cy="48%" outerRadius="70%" label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}>{series.map((entry, index) => <Cell key={entry.label} fill={['#176b53', '#287ba3', '#c28a38', '#bd5b57', '#71849a'][index % 5]} />)}</Pie></PieChart>
              : type === 'box_plot'
                ? <ComposedChart data={box} margin={{ top: 12, right: 16, bottom: 20, left: 8 }}><CartesianGrid stroke="#e3e9eb" /><XAxis dataKey="label" /><YAxis /><Tooltip /><Legend /><Bar dataKey="base" stackId="box" fill="transparent" /><Bar dataKey="box" name="Interquartile range" stackId="box" fill="#91b8a8"><ErrorBar dataKey="error" width={8} stroke="#176b53" /></Bar><Line dataKey="median" name="Median" stroke="#bd5b57" /></ComposedChart>
                : <BarChart data={type === 'histogram' ? histogram : series} margin={{ top: 12, right: 16, bottom: 20, left: 8 }}><CartesianGrid stroke="#e3e9eb" /><XAxis dataKey="label" /><YAxis /><Tooltip /><Legend /><Bar dataKey="value" name={type === 'histogram' ? 'Frequency' : chart.recommendation.y_column || 'Value'} fill="#176b53" radius={[4, 4, 0, 0]} /></BarChart>}
      </ResponsiveContainer>
    </div>
    <footer>Backend rows used: {preview.metadata?.rows_used ?? preview.metadata?.points_returned ?? preview.metadata?.non_missing_values ?? '—'}{preview.metadata?.truncated ? ' · bounded preview' : ''}</footer>
  </article>;
}

export function VisualizationPage() {
  const { activeDatasetId, dataset } = useDataset();
  const [recommendations, setRecommendations] = useState<ChartRecommendation[]>([]);
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<ReportChart[]>([]);
  const [manualChart, setManualChart] = useState<ReportChart | null>(null);
  const [manualType, setManualType] = useState<ChartType>('bar');
  const [manualX, setManualX] = useState('');
  const [manualY, setManualY] = useState('');
  const [manualGenerating, setManualGenerating] = useState(false);
  const [error, setError] = useState('');

  const columns = useMemo(() => dataset?.column_names ?? [], [dataset?.column_names]);
  const types = useMemo(() => dataset?.data_types ?? {}, [dataset?.data_types]);
  const criticalIssues = health?.column_health?.filter((column) => column.status === 'critical') ?? [];
  const healthy = Boolean(health && criticalIssues.length === 0);

  useEffect(() => {
    if (!activeDatasetId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([getHealth(activeDatasetId), getVisualizationRecommendations(activeDatasetId)]).then(([nextHealth, result]) => {
      if (cancelled) return;
      setHealth(nextHealth);
      setRecommendations((result.recommendations ?? []).slice(0, 10).map((item) => ({ ...item, chart_type: normalizeChartType(item.chart_type) })));
      setReport([]);
      setManualChart(null);
    }).catch((requestError: Error) => { if (!cancelled) setError(requestError.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeDatasetId]);

  const generateReport = async () => {
    if (!activeDatasetId || !healthy || !recommendations.length) return;
    setGenerating(true);
    setError('');
    try {
      const charts = await Promise.all(recommendations.map(async (recommendation): Promise<ReportChart> => {
        try {
          const type = normalizeChartType(recommendation.chart_type);
          return {
            recommendation,
            preview: await getVisualizationPreview(activeDatasetId, {
              chart_type: type === 'box_plot' ? 'box' : type,
              column_a: recommendation.x_column,
              ...(recommendation.y_column ? { column_b: recommendation.y_column } : {}),
              aggregation: type === 'scatter' || type === 'histogram' ? 'none' : 'mean',
              bins: 10,
              limit: 1000,
            }),
          };
        } catch (requestError) {
          return { recommendation, error: requestError instanceof Error ? requestError.message : 'Chart generation failed.' };
        }
      }));
      setReport(charts);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The visualization report could not be generated.');
    } finally {
      setGenerating(false);
    }
  };

  const downloadChartData = (chart: ReportChart) => {
    if (!chart.preview?.labels || !chart.preview.values) return;
    const rows = [['Label', 'Value'], ...chart.preview.labels.map((label, index) => [String(label), String(chart.preview?.values?.[index] ?? '')])];
    const csv = rows.map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = `${(dataset?.filename || 'dataset').replace(/\.[^.]+$/, '')}-visualization-report.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const generateManualChart = async () => {
    if (!activeDatasetId || !healthy || !manualX) return;
    setManualGenerating(true);
    setError('');
    try {
      const type = normalizeChartType(manualType);
      const recommendation: ChartRecommendation = {
        chart_type: type,
        x_column: manualX,
        y_column: manualY || null,
        reason: 'Chart configured manually from the active dataset columns.',
      };
      setManualChart({
        recommendation,
        preview: await getVisualizationPreview(activeDatasetId, {
          chart_type: type === 'box_plot' ? 'box' : type,
          column_a: manualX,
          ...(manualY ? { column_b: manualY } : {}),
          aggregation: type === 'scatter' || type === 'histogram' ? 'none' : manualY ? 'mean' : 'count',
          bins: 10,
          limit: 1000,
        }),
      });
    } catch (requestError) {
      setManualChart({ recommendation: { chart_type: manualType, x_column: manualX, y_column: manualY || null, reason: 'Chart configured manually from the active dataset columns.' }, error: requestError instanceof Error ? requestError.message : 'Manual chart generation failed.' });
    } finally {
      setManualGenerating(false);
    }
  };

  if (!activeDatasetId) return <section className="panel empty-visualization"><h2>Upload a dataset to generate a visualization report.</h2><p>The report uses backend recommendations and calculations from the active dataset.</p></section>;
  const numerical = columns.filter((column) => /int|float|number|double|decimal/i.test(types[column] ?? '')).length;
  const datetime = columns.filter((column) => /date|time/i.test(types[column] ?? '')).length;

  return <><div className="page-heading"><div><div className="eyebrow">PRESENTATION REPORT</div><h1>Generate visualization report</h1><p>Review all backend-suggested charts in one presentation-ready report after the dataset passes health checks.</p></div><button className="primary-button" disabled={loading || generating || !healthy || !recommendations.length} onClick={() => { void generateReport(); }}><Play size={15} />{generating ? 'Generating report…' : 'Generate report'}</button></div>
    {error && <section className="panel viz-error" role="alert"><strong>Visualization report unavailable.</strong><span>{error}</span></section>}
    <section className={`panel report-readiness ${healthy ? 'report-ready' : 'report-blocked'}`}>
      {healthy ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
      <div><strong>{loading ? 'Checking dataset health…' : healthy ? 'Dataset is ready for visualization' : 'Resolve critical data issues before generating charts'}</strong><span>{health ? `${health.overall_score}% backend health · ${health.missing_percentage}% missing cells · ${health.duplicate_percentage}% duplicate rows` : 'Health information is loading from the backend.'}</span>{criticalIssues.length > 0 && <small>{criticalIssues.slice(0, 4).map((item) => `${item.column}: ${item.reasons.join(', ')}`).join(' · ')}</small>}</div>
      <button className="secondary-button" onClick={() => { if (activeDatasetId) { setReport([]); void Promise.all([getHealth(activeDatasetId), getVisualizationRecommendations(activeDatasetId)]).then(([nextHealth, result]) => { setHealth(nextHealth); setRecommendations(result.recommendations); }); } }} aria-label="Refresh visualization readiness"><RefreshCw size={14} /></button>
    </section>
    <section className="panel report-summary"><div><span>Dataset</span><strong>{dataset?.filename || activeDatasetId}</strong></div><div><span>Rows</span><strong>{dataset?.rows?.toLocaleString() ?? '—'}</strong></div><div><span>Columns</span><strong>{columns.length}</strong></div><div><span>Suggested charts</span><strong>{recommendations.length}</strong></div><div><span>Data types</span><strong>{numerical} numeric · {datetime} date/time</strong></div></section>
    {report.length > 0 && <section className="report-grid" aria-label="Generated visualization report">{report.map((chart, index) => <ChartVisual key={`${chart.recommendation.chart_type}-${chart.recommendation.x_column}-${index}`} chart={chart} onDownload={downloadChartData} />)}</section>}
    <section className="panel manual-chart-builder">
      <div className="manual-chart-heading"><div><div className="eyebrow">MANUAL CHART</div><h2>Build one custom chart</h2><p>Choose the chart type and columns when the recommended report needs a focused view.</p></div><WandSparkles size={20} /></div>
      <div className="manual-chart-controls">
        <label>Chart type<select value={manualType} onChange={(event) => setManualType(event.target.value as ChartType)}><option value="bar">Bar chart</option><option value="line">Line chart</option><option value="pie">Proportion chart</option><option value="scatter">Scatter plot</option><option value="box_plot">Box plot</option><option value="histogram">Histogram</option></select></label>
        <label>X or category column<select value={manualX} onChange={(event) => setManualX(event.target.value)}><option value="">Select a column</option>{columns.map((column) => <option key={column} value={column}>{column}</option>)}</select></label>
        <label>Y or measure column <span>(optional)</span><select value={manualY} onChange={(event) => setManualY(event.target.value)}><option value="">Count rows</option>{columns.filter((column) => column !== manualX).map((column) => <option key={column} value={column}>{column}</option>)}</select></label>
        <button className="primary-button" disabled={!healthy || !manualX || manualGenerating} onClick={() => { void generateManualChart(); }}>{manualGenerating ? 'Building…' : 'Create chart'}</button>
      </div>
    </section>
    {manualChart && <section className="report-grid manual-chart-result" aria-label="Manual visualization"><ChartVisual chart={manualChart} onDownload={downloadChartData} /></section>}
    {!report.length && healthy && !generating && <section className="panel report-start"><h2>Your report is ready to generate</h2><p>Click Generate report to render every chart recommendation together using backend-calculated data.</p></section>}
  </>;
}
