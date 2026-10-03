import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, ErrorBar, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Box, ChartNoAxesCombined, Check, Circle, Download, GitBranch, LineChart as LineChartIcon, Maximize2, type LucideIcon } from 'lucide-react';
import { useDataset } from '../context/DatasetContext';
import { getDatasetPreview } from '../services/datasetService';
import { getVisualizationRecommendations, type ChartRecommendation } from '../services/visualizationService';

type ChartType = ChartRecommendation['chart_type'];
type Aggregation = 'none' | 'sum' | 'mean' | 'median' | 'mode' | 'stddev';
type RecordValue = Record<string, unknown>;
type SeriesPoint = { label: string; value: number };
type ScatterPoint = { x: number; y: number };
type BoxPoint = { label: string; base: number; box: number; error: [number, number]; median: number };

const chartMeta: Record<ChartType, { label: string; description: string; icon: LucideIcon }> = {
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
  const result = Array.from(groups, ([label, values]) => {
    const sorted = [...values].sort((a, b) => a - b); let value = values.length;
    if (aggregation === 'sum') value = values.reduce((total, item) => total + item, 0);
    if (aggregation === 'mean' || aggregation === 'none') value = values.reduce((total, item) => total + item, 0) / values.length;
    if (aggregation === 'median') value = percentile(sorted, .5);
    if (aggregation === 'mode') { const counts = new Map<number, number>(); values.forEach((item) => counts.set(item, (counts.get(item) ?? 0) + 1)); value = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]; }
    if (aggregation === 'stddev') { const mean = values.reduce((total, item) => total + item, 0) / values.length; value = Math.sqrt(values.reduce((total, item) => total + (item - mean) ** 2, 0) / values.length); }
    return { label, value };
  });
  return (chartType === 'line' ? result : result.sort((a, b) => b.value - a.value)).slice(0, 20);
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
  const [recommendations, setRecommendations] = useState<ChartRecommendation[]>([]);

  const columns = useMemo(() => dataset?.column_names ?? [], [dataset?.column_names]);
  const types = useMemo(() => dataset?.data_types ?? {}, [dataset?.data_types]);
  useEffect(() => { if (columns.length && !columns.includes(columnA)) setColumnA(columns[0]); if (columns.length > 1 && !columns.includes(columnB)) setColumnB(columns[1]); }, [columns, columnA, columnB]);
  useEffect(() => { if (chartType === 'scatter' || chartType === 'histogram' || chartType === 'box_plot') setAggregation('none'); else if (aggregation === 'none') setAggregation('mean'); }, [chartType, aggregation]);
  useEffect(() => {
    if (!activeDatasetId) return;
    let cancelled = false;
    setLoading(true); setError(''); setRecommendations([]);
    Promise.all([getDatasetPreview(activeDatasetId, { limit: 1000, offset: 0 }), getVisualizationRecommendations(activeDatasetId)]).then(([preview, recommendationResponse]) => {
      if (cancelled) return;
      setRecords(preview.rows.map((row) => Array.isArray(row) ? Object.fromEntries(preview.columns.map((column, index) => [column, row[index]])) : row));
      setRecommendations(Array.isArray(recommendationResponse?.recommendations) ? recommendationResponse.recommendations : []);
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
  const numericalColumnCount = columns.filter((column) => isNumeric(column, types)).length;
  const datetimeColumnCount = columns.filter((column) => /date|time/i.test(types[column] ?? '')).length;
  const categoricalColumnCount = Math.max(0, columns.length - numericalColumnCount - datetimeColumnCount);
  const applyRecommendation = (recommendation: ChartRecommendation) => {
    setChartType(recommendation.chart_type);
    setColumnA(recommendation.x_column);
    setColumnB(recommendation.y_column ?? '');
  };
  const downloadChartData = () => {
    if (!data.length) return;
    const headers = Object.keys(data[0] as Record<string, unknown>);
    const csv = [headers, ...data.map((record) => headers.map((header) => (record as Record<string, unknown>)[header]))]
      .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(dataset?.filename || 'dataset').replace(/\.[^.]+$/, '')}-${chartType}-preview.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const selectedRecommendation = recommendations.find((recommendation) => recommendation.chart_type === chartType && recommendation.x_column === columnA && (recommendation.y_column ?? '') === columnB);
  const seriesTotal = seriesData.reduce((total, point) => total + point.value, 0);
  const tooltipFormatter = (value: unknown, name?: string | number): [string, string] => {
    const numericValue = Number(value);
    const formattedValue = Number.isFinite(numericValue) ? numericValue.toLocaleString(undefined, { maximumFractionDigits: 3 }) : String(value ?? '—');
    const share = chartType === 'pie' && seriesTotal > 0 ? ` (${((numericValue / seriesTotal) * 100).toFixed(1)}%)` : '';
    const seriesName = chartType === 'histogram' ? 'Frequency'
      : chartType === 'pie' ? 'Value'
        : chartType === 'box_plot' ? ({ base: 'Lower quartile baseline', box: 'Interquartile range', median: 'Median' }[String(name)] ?? 'Value')
          : String(name || 'Value');
    return [`${formattedValue}${share}`, seriesName];
  };
  if (!activeDatasetId) return <section className="panel empty-visualization"><div className="eyebrow">VISUALIZATION STUDIO</div><h2>Upload a dataset to start exploring.</h2><p>Choose columns and a chart type after selecting an active dataset.</p></section>;

  return <><div className="page-heading"><div><div className="eyebrow">VISUALIZATION WORKSPACE</div><h1>Explore your data</h1><p>Build charts from the active dataset and review recommendations from its profile.</p></div></div>
    <section className="panel viz-recommendations" aria-label="Dataset-aware visualization guidance">
      <div className="viz-recommendation-heading"><div><div className="eyebrow">DATASET PROFILE</div><h2>Choose a useful view</h2><p>{numericalColumnCount} numerical · {categoricalColumnCount} categorical · {datetimeColumnCount} date/time columns, classified from dataset metadata.</p></div><span>{recommendations.length} backend recommendations</span></div>
      {loading ? <div className="page-loading" role="status"><span className="loading-indicator" />Reviewing dataset recommendations…</div> : recommendations.length ? <div className="viz-recommendation-list">{recommendations.map((recommendation, index) => <button className="viz-recommendation" key={`${recommendation.chart_type}-${recommendation.x_column}-${index}`} onClick={() => applyRecommendation(recommendation)}>
        <span className="recommendation-number">{String(index + 1).padStart(2, '0')}</span><span className="recommendation-copy"><strong>{chartMeta[recommendation.chart_type].label} · {recommendation.x_column}{recommendation.y_column ? ` × ${recommendation.y_column}` : ''}</strong><small>{recommendation.reason}</small></span><span className="recommendation-use">Use suggestion</span>
      </button>)}</div> : <p className="muted">No visualization recommendations were returned for this dataset.</p>}
    </section>
    {error && <section className="panel viz-error" role="alert"><strong>Visualization data could not be loaded.</strong><span>Please try again. Dataset-specific recommendations require a successful backend response.</span></section>}
    <div className="viz-studio-layout"><aside className="panel viz-config"><div className="viz-dataset-summary"><span>ACTIVE DATASET</span><strong>{dataset?.filename || activeDatasetId}</strong><small>{dataset?.rows?.toLocaleString() ?? '—'} rows · {columns.length} columns</small></div><div className="viz-config-section"><h2>What do you want to visualize?</h2><div className="chart-card-grid">{chartTypes.map((type) => { const Icon = chartMeta[type].icon; return <button className={`chart-card-option ${chartType === type ? 'active' : ''}`} key={type} onClick={() => setChartType(type)}><span className="chart-card-icon"><Icon size={20} /></span><span><strong>{chartMeta[type].label}</strong><small>{chartMeta[type].description}</small></span>{chartType === type && <Check size={15} />}</button>; })}</div></div><div className="viz-config-section"><h2>Select data</h2><label>{chartType === 'box_plot' ? 'Group by (optional)' : chartType === 'histogram' ? 'Numerical column' : 'Column A'}<select value={columnA} onChange={(event) => setColumnA(event.target.value)}>{columns.map((column) => <option key={column} value={column}>{column}</option>)}</select></label>{chartType !== 'histogram' && <label>{chartType === 'box_plot' ? 'Numerical value' : chartType === 'scatter' ? 'Column B / Y axis' : 'Column B / Value'}<select value={columnB} onChange={(event) => setColumnB(event.target.value)}><option value="">{chartType === 'box_plot' ? 'Use Column A as value' : 'Select a column'}</option>{columns.map((column) => <option key={column} value={column}>{column}</option>)}</select></label>}{chartType !== 'scatter' && chartType !== 'histogram' && <label>Aggregation<select value={aggregation} onChange={(event) => setAggregation(event.target.value as Aggregation)}>{aggregations.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>}<div className={`compatibility-message ${compatible ? 'valid' : 'invalid'}`}>{compatible ? 'Columns are compatible for this chart.' : chartType === 'scatter' ? 'Scatter plots require numerical values for both axes.' : chartType === 'histogram' ? 'Choose a numerical column for the histogram.' : chartType === 'pie' ? 'Pie charts require a categorical column and a numerical value.' : chartType === 'bar' ? 'Bar charts require a categorical column and a numerical value.' : 'Choose a compatible value column to generate this chart.'}</div></div></aside>
      <section className="panel viz-result" aria-label={`Visualization: ${title}`}>
        <div className="viz-result-header">
          <div><div className="eyebrow">CURRENT VISUALIZATION</div><h2>{title}</h2><p>{chartMeta[chartType].label} · {columnA}{chartType !== 'histogram' && columnB ? ` × ${columnB}` : ''} · {chartType === 'scatter' || chartType === 'histogram' ? 'Individual observations' : aggregationLabel}</p></div>
          <div className="chart-result-actions"><span className="viz-result-dataset">{records.length.toLocaleString()} preview rows</span><button className="chart-action-button" onClick={downloadChartData} disabled={!data.length || loading} aria-label="Download chart data as CSV" title="Download chart data as CSV"><Download size={16} /></button><button className="chart-action-button" onClick={() => { void document.querySelector('.viz-chart-canvas')?.requestFullscreen?.(); }} aria-label="Expand chart" title="Expand chart"><Maximize2 size={16} /></button></div>
        </div>
        <div className="chart-canvas viz-chart-canvas" role="img" aria-label={`${chartMeta[chartType].label} showing ${title}`}>
          {loading && <div className="chart-loading"><span />Loading dataset preview…</div>}
          {!loading && compatible && data.length > 0 && <ResponsiveContainer width="100%" height="100%">
            {chartType === 'scatter' ? <ScatterChart margin={{ top: 16, right: 18, bottom: 12, left: 4 }}><CartesianGrid stroke="#e4eaed" strokeDasharray="3 4" /><XAxis type="number" dataKey="x" name={columnA} tick={{ fill: '#65747c', fontSize: 11 }} tickMargin={8} /><YAxis type="number" dataKey="y" name={columnB} tick={{ fill: '#65747c', fontSize: 11 }} tickFormatter={(value: number) => value.toLocaleString()} /><Tooltip formatter={tooltipFormatter} contentStyle={{ border: '1px solid #dce3e6', borderRadius: 7, boxShadow: '0 6px 18px #20374418' }} /><Scatter data={scatterData} fill="#287ba3" /></ScatterChart>
              : chartType === 'line' ? <LineChart data={seriesData} margin={{ top: 16, right: 18, bottom: 12, left: 4 }}><CartesianGrid stroke="#e4eaed" strokeDasharray="3 4" vertical={false} /><XAxis dataKey="label" tick={{ fill: '#65747c', fontSize: 11 }} tickMargin={8} /><YAxis tick={{ fill: '#65747c', fontSize: 11 }} tickFormatter={(value: number) => value.toLocaleString()} /><Tooltip formatter={tooltipFormatter} contentStyle={{ border: '1px solid #dce3e6', borderRadius: 7, boxShadow: '0 6px 18px #20374418' }} /><Line type="linear" dataKey="value" name="Value" stroke="#176b53" strokeWidth={2.5} dot={{ r: 3, fill: '#176b53', strokeWidth: 1 }} activeDot={{ r: 5 }} /></LineChart>
                : chartType === 'pie' ? <PieChart><Tooltip formatter={tooltipFormatter} contentStyle={{ border: '1px solid #dce3e6', borderRadius: 7, boxShadow: '0 6px 18px #20374418' }} /><Legend verticalAlign="bottom" height={34} /><Pie data={seriesData} dataKey="value" nameKey="label" cx="50%" cy="46%" outerRadius="66%" paddingAngle={2} label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}>{seriesData.map((entry, index) => <Cell key={entry.label} fill={['#176b53', '#287ba3', '#c28a38', '#bd5b57', '#71849a'][index % 5]} />)}</Pie></PieChart>
                  : chartType === 'box_plot' ? <ComposedChart data={boxData} margin={{ top: 16, right: 18, bottom: 12, left: 4 }}><CartesianGrid stroke="#e4eaed" strokeDasharray="3 4" vertical={false} /><XAxis dataKey="label" tick={{ fill: '#65747c', fontSize: 11 }} tickMargin={8} /><YAxis tick={{ fill: '#65747c', fontSize: 11 }} tickFormatter={(value: number) => value.toLocaleString()} /><Tooltip formatter={tooltipFormatter} contentStyle={{ border: '1px solid #dce3e6', borderRadius: 7, boxShadow: '0 6px 18px #20374418' }} /><Bar dataKey="base" stackId="box" fill="transparent" isAnimationActive={false} /><Bar dataKey="box" name="Interquartile range" stackId="box" fill="#91b8a8"><ErrorBar dataKey="error" width={8} stroke="#176b53" /></Bar><Line type="linear" dataKey="median" name="Median" stroke="#bd5b57" dot={{ r: 3 }} /></ComposedChart>
                    : <BarChart data={seriesData} margin={{ top: 16, right: 18, bottom: 12, left: 4 }}><CartesianGrid stroke="#e4eaed" strokeDasharray="3 4" vertical={false} /><XAxis dataKey="label" tick={{ fill: '#65747c', fontSize: 11 }} tickMargin={8} interval="preserveStartEnd" /><YAxis tick={{ fill: '#65747c', fontSize: 11 }} tickFormatter={(value: number) => value.toLocaleString()} /><Tooltip formatter={tooltipFormatter} contentStyle={{ border: '1px solid #dce3e6', borderRadius: 7, boxShadow: '0 6px 18px #20374418' }} /><Bar dataKey="value" name={chartType === 'histogram' ? 'Frequency' : 'Value'} fill={chartType === 'histogram' ? '#287ba3' : '#176b53'} radius={[5, 5, 1, 1]} maxBarSize={48} /></BarChart>}
          </ResponsiveContainer>}
          {!loading && (!compatible || !data.length) && <div className="viz-empty-result"><ChartNoAxesCombined size={28} /><strong>{compatible ? 'No plottable values found' : 'Choose columns to begin'}</strong><span>{compatible ? 'Try another column combination from the active dataset.' : 'The chart preview will appear here when the configuration is valid.'}</span></div>}
        </div>
        <p className="chart-data-note">This chart is calculated from up to 1,000 rows returned by the dataset preview endpoint. It is not a full-dataset aggregate.</p>
        {selectedRecommendation && <div className="chart-guidance"><strong>Backend dataset guidance</strong><p>{selectedRecommendation.reason}</p></div>}
      </section>
    </div></>;
}
