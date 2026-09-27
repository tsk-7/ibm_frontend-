import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, ErrorBar, Line, LineChart, Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Box, ChartNoAxesCombined, Check, Circle, GitBranch, LineChart as LineChartIcon } from 'lucide-react';
import { useDataset } from '../context/DatasetContext';
import { getDatasetPreview } from '../services/datasetService';
import { getVisualizationRecommendations, type ChartRecommendation } from '../services/visualizationService';

type ChartType = ChartRecommendation['chart_type'];
type Aggregation = 'none' | 'sum' | 'mean' | 'median' | 'mode' | 'stddev';
type RecordValue = Record<string, unknown>;
type SeriesPoint = { label: string; value: number };
type ScatterPoint = { x: number; y: number };
type BoxPoint = { label: string; base: number; box: number; error: [number, number]; median: number };

const chartMeta: Record<ChartType, { label: string; description: string; icon: ComponentType<{ size?: number }> }> = {
  bar: { label: 'Bar chart', description: 'Compare values by category', icon: BarChart3 },
  line: { label: 'Line chart', description: 'Show ordered trends', icon: LineChartIcon },
  pie: { label: 'Pie chart', description: 'Show proportions', icon: Circle },
  scatter: { label: 'Scatter plot', description: 'Find relationships', icon: ChartNoAxesCombined },
  box_plot: { label: 'Box plot', description: 'Compare distribution spread', icon: Box },
  histogram: { label: 'Histogram', description: 'Understand a distribution', icon: GitBranch },
};
const chartTypes: ChartType[] = ['bar', 'line', 'pie', 'scatter', 'box_plot', 'histogram'];
const aggregations: { value: Aggregation; label: string }[] = [
  { value: 'none', label: 'None' }, { value: 'sum', label: 'Sum' }, { value: 'mean', label: 'Mean (Average)' },
  { value: 'median', label: 'Median' }, { value: 'mode', label: 'Mode' }, { value: 'stddev', label: 'Standard deviation' },
];

const toNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : typeof value === 'string' && value.trim() && Number.isFinite(Number(value)) ? Number(value) : null;
const isNumeric = (value: string, types: Record<string, string>) => /int|float|number|double|decimal/i.test(types[value] ?? '');
const percentile = (values: number[], position: number) => values[Math.min(values.length - 1, Math.floor(position * values.length))];

function aggregate(records: RecordValue[], chartType: ChartType, columnA: string, columnB: string, aggregation: Aggregation) {
  if (chartType === 'scatter') return records.flatMap((record) => { const x = toNumber(record[columnA]); const y = toNumber(record[columnB]); return x === null || y === null ? [] : [{ x, y }]; });
  if (chartType === 'histogram') {
    const values = records.map((record) => toNumber(record[columnA])).filter((value): value is number => value !== null);
    if (!values.length) return [];
    const minimum = Math.min(...values); const range = Math.max(...values) - minimum || 1;
    const bins = Array.from({ length: 10 }, () => 0);
    values.forEach((value) => { bins[Math.min(9, Math.floor(((value - minimum) / range) * 10))] += 1; });
    return bins.map((value, index) => ({ label: `${(minimum + range * index / 10).toPrecision(3)}-${(minimum + range * (index + 1) / 10).toPrecision(3)}`, value }));
  }
  if (chartType === 'box_plot') {
    const groups = new Map<string, number[]>();
    records.forEach((record) => { const value = toNumber(record[columnB || columnA]); if (value !== null) { const label = columnB ? String(record[columnA] ?? '(empty)') : 'All values'; groups.set(label, [...(groups.get(label) ?? []), value]); } });
    return Array.from(groups, ([label, rawValues]) => { const values = [...rawValues].sort((a, b) => a - b); const q1 = percentile(values, .25); const median = percentile(values, .5); const q3 = percentile(values, .75); return { label, base: q1, box: q3 - q1, error: [values[0] - q1, values[values.length - 1] - q3] as [number, number], median }; }).slice(0, 12);
  }
  const groups = new Map<string, number[]>();
  records.forEach((record) => { const label = String(record[columnA] ?? '(empty)'); const value = columnB ? toNumber(record[columnB]) : 1; if (value !== null) groups.set(label, [...(groups.get(label) ?? []), value]); });
  return Array.from(groups, ([label, values]) => {
    const sorted = [...values].sort((a, b) => a - b); let value = values.length;
    if (aggregation === 'sum') value = values.reduce((total, item) => total + item, 0);
    if (aggregation === 'mean' || aggregation === 'none') value = values.reduce((total, item) => total + item, 0) / values.length;
    if (aggregation === 'median') value = percentile(sorted, .5);
    if (aggregation === 'mode') { const counts = new Map<number, number>(); values.forEach((item) => counts.set(item, (counts.get(item) ?? 0) + 1)); value = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]; }
    if (aggregation === 'stddev') { const mean = values.reduce((total, item) => total + item, 0) / values.length; value = Math.sqrt(values.reduce((total, item) => total + (item - mean) ** 2, 0) / values.length); }
    return { label, value };
  }).sort((a, b) => b.value - a.value).slice(0, 20);
}

export function VisualizationPage() {
  const { activeDatasetId, dataset } = useDataset();
  const [records, setRecords] = useState<RecordValue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [columnA, setColumnA] = useState('');
  const [columnB, setColumnB] = useState('');
  const [aggregation, setAggregation] = useState<Aggregation>('mean');

  const columns = useMemo(() => dataset?.column_names ?? [], [dataset?.column_names]);
  const types = useMemo(() => dataset?.data_types ?? {}, [dataset?.data_types]);
  useEffect(() => { if (columns.length && !columns.includes(columnA)) setColumnA(columns[0]); if (columns.length > 1 && !columns.includes(columnB)) setColumnB(columns[1]); }, [columns, columnA, columnB]);
  useEffect(() => { if (chartType === 'scatter' || chartType === 'histogram' || chartType === 'box_plot') setAggregation('none'); else if (aggregation === 'none') setAggregation('mean'); }, [chartType, aggregation]);
  useEffect(() => {
    if (!activeDatasetId) return;
    let cancelled = false;
    setLoading(true); setError('');
    Promise.all([getDatasetPreview(activeDatasetId, { limit: 1000, offset: 0 }), getVisualizationRecommendations(activeDatasetId)]).then(([preview]) => {
      if (cancelled) return;
      setRecords(preview.rows.map((row) => Array.isArray(row) ? Object.fromEntries(preview.columns.map((column, index) => [column, row[index]])) : row));
    }).catch((requestError: Error) => { if (!cancelled) setError(requestError.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeDatasetId]);

  const compatible = useMemo(() => {
    if (!columnA) return false;
    if (chartType === 'scatter') return isNumeric(columnA, types) && isNumeric(columnB, types);
    if (chartType === 'histogram') return isNumeric(columnA, types);
    if (chartType === 'box_plot') return isNumeric(columnB || columnA, types) && (!columnB || !isNumeric(columnA, types));
    if (chartType === 'bar' || chartType === 'pie') return Boolean(columnB) && !isNumeric(columnA, types) && isNumeric(columnB, types);
    return Boolean(columnB) && isNumeric(columnB, types);
  }, [chartType, columnA, columnB, types]);
  const data = useMemo(() => compatible ? aggregate(records, chartType, columnA, columnB, aggregation) : [], [records, chartType, columnA, columnB, aggregation, compatible]);
  const scatterData = data as ScatterPoint[]; const seriesData = data as SeriesPoint[]; const boxData = data as BoxPoint[];
  const aggregationLabel = aggregations.find((item) => item.value === aggregation)?.label ?? 'None';
  const title = chartType === 'scatter' ? `${columnA} vs ${columnB}` : chartType === 'histogram' ? `${columnA} distribution` : chartType === 'box_plot' ? `${columnB || columnA} distribution${columnB ? ` by ${columnA}` : ''}` : `${aggregationLabel} ${columnB || columnA}${columnB ? ` by ${columnA}` : ''}`;
  if (!activeDatasetId) return <section className="panel empty-visualization"><div className="eyebrow">VISUALIZATION STUDIO</div><h2>Upload a dataset to start exploring.</h2><p>Choose columns and a chart type after selecting an active dataset.</p></section>;

  return <><div className="page-heading"><div><div className="eyebrow">VISUALIZATION STUDIO</div><h1>Explore your data</h1><p>Choose the columns, statistic, and chart that answer your question.</p></div></div>{error && <section className="panel" role="alert"><p>Unable to load visualization data. Please try again.</p></section>}
    <div className="viz-studio-layout"><aside className="panel viz-config"><div className="viz-dataset-summary"><span>ACTIVE DATASET</span><strong>{dataset?.filename || activeDatasetId}</strong><small>{dataset?.rows?.toLocaleString() ?? '—'} rows · {columns.length} columns</small></div><div className="viz-config-section"><h2>What do you want to visualize?</h2><div className="chart-card-grid">{chartTypes.map((type) => { const Icon = chartMeta[type].icon; return <button className={`chart-card-option ${chartType === type ? 'active' : ''}`} key={type} onClick={() => setChartType(type)}><span className="chart-card-icon"><Icon size={20} /></span><span><strong>{chartMeta[type].label}</strong><small>{chartMeta[type].description}</small></span>{chartType === type && <Check size={15} />}</button>; })}</div></div><div className="viz-config-section"><h2>Select data</h2><label>{chartType === 'box_plot' ? 'Group by (optional)' : chartType === 'histogram' ? 'Numerical column' : 'Column A'}<select value={columnA} onChange={(event) => setColumnA(event.target.value)}>{columns.map((column) => <option key={column} value={column}>{column}</option>)}</select></label>{chartType !== 'histogram' && <label>{chartType === 'box_plot' ? 'Numerical value' : chartType === 'scatter' ? 'Column B / Y axis' : 'Column B / Value'}<select value={columnB} onChange={(event) => setColumnB(event.target.value)}><option value="">{chartType === 'box_plot' ? 'Use Column A as value' : 'Select a column'}</option>{columns.map((column) => <option key={column} value={column}>{column}</option>)}</select></label>}{chartType !== 'scatter' && chartType !== 'histogram' && <label>Aggregation<select value={aggregation} onChange={(event) => setAggregation(event.target.value as Aggregation)}>{aggregations.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>}<div className={`compatibility-message ${compatible ? 'valid' : 'invalid'}`}>{compatible ? 'Columns are compatible for this chart.' : chartType === 'scatter' ? 'Scatter plots require numerical values for both axes.' : chartType === 'histogram' ? 'Choose a numerical column for the histogram.' : chartType === 'pie' ? 'Pie charts require a categorical column and a numerical value.' : chartType === 'bar' ? 'Bar charts require a categorical column and a numerical value.' : 'Choose a compatible value column to generate this chart.'}</div></div></aside>
      <section className="panel viz-result"><div className="viz-result-header"><div><div className="eyebrow">CURRENT VISUALIZATION</div><h2>{title}</h2><p>{chartMeta[chartType].label} · {columnA}{chartType !== 'histogram' && columnB ? ` × ${columnB}` : ''} · {chartType === 'scatter' || chartType === 'histogram' ? 'Individual observations' : aggregationLabel}</p></div><span className="viz-result-dataset">{records.length.toLocaleString()} preview rows</span></div><div className="chart-canvas viz-chart-canvas">{loading && <div className="chart-loading"><span />Loading dataset preview...</div>}{!loading && compatible && data.length > 0 && <ResponsiveContainer width="100%" height="100%">{chartType === 'scatter' ? <ScatterChart><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" dataKey="x" name={columnA} /><YAxis type="number" dataKey="y" name={columnB} /><Tooltip /><Scatter data={scatterData} fill="#166534" /></ScatterChart> : chartType === 'line' ? <LineChart data={seriesData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis /><Tooltip /><Line type="monotone" dataKey="value" stroke="#166534" strokeWidth={2} dot={false} /></LineChart> : chartType === 'pie' ? <PieChart><Tooltip /><Pie data={seriesData} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius="70%" label>{seriesData.map((entry, index) => <Cell key={entry.label} fill={['#166534', '#16a34a', '#65a30d', '#f59e0b', '#eab308'][index % 5]} />)}</Pie></PieChart> : chartType === 'box_plot' ? <ComposedChart data={boxData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis /><Tooltip /><Bar dataKey="base" stackId="box" fill="transparent" isAnimationActive={false} /><Bar dataKey="box" stackId="box" fill="#bbf7d0"><ErrorBar dataKey="error" width={8} stroke="#166534" /></Bar><Line type="monotone" dataKey="median" stroke="#14532d" dot={{ r: 3 }} /></ComposedChart> : chartType === 'histogram' ? <BarChart data={seriesData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis /><Tooltip /><Bar dataKey="value" fill="#166534" radius={[4, 4, 0, 0]} /></BarChart> : <BarChart data={seriesData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis /><Tooltip /><Bar dataKey="value" fill="#166534" radius={[4, 4, 0, 0]} /></BarChart>}</ResponsiveContainer>}{!loading && (!compatible || !data.length) && <div className="viz-empty-result"><ChartNoAxesCombined size={28} /><strong>{compatible ? 'No plottable values found' : 'Choose columns to begin'}</strong><span>{compatible ? 'Try another column combination from the active dataset.' : 'The chart preview will appear here when the configuration is valid.'}</span></div>}</div></section>
    </div></>;
}
