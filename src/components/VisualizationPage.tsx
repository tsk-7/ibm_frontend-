import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { useDataset } from '../context/DatasetContext';
import { getDatasetPreview } from '../services/datasetService';
import { getVisualizationRecommendations, type ChartRecommendation } from '../services/visualizationService';

const EMPTY_RECOMMENDATIONS: ChartRecommendation[] = [];
type ScatterPoint = { x: number; y: number };
type SeriesPoint = { label: string; value: number };
const toFiniteNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
};

function aggregateRecords(records: Record<string, unknown>[], recommendation: ChartRecommendation) {
  if (recommendation.chart_type === 'scatter' && recommendation.y_column) {
    return records.flatMap((record) => {
      const x = toFiniteNumber(record[recommendation.x_column]);
      const y = toFiniteNumber(record[recommendation.y_column!]);
      return x === null || y === null ? [] : [{ x, y }];
    });
  }

  if (recommendation.chart_type === 'histogram') {
    const values = records.map((record) => toFiniteNumber(record[recommendation.x_column])).filter((value): value is number => value !== null);
    if (!values.length) return [];
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const range = maximum - minimum || 1;
    const bins = Array.from({ length: 10 }, () => ({ label: '', value: 0 }));
    values.forEach((value) => {
      const index = Math.min(9, Math.floor(((value - minimum) / range) * 10));
      bins[index].value += 1;
    });
    return bins.map((bin, index) => ({ ...bin, label: `${(minimum + (range * index) / 10).toPrecision(3)}-${(minimum + (range * (index + 1)) / 10).toPrecision(3)}` }));
  }

  const groups = new Map<string, { total: number; count: number }>();
  records.forEach((record) => {
    const label = String(record[recommendation.x_column] ?? '(empty)');
    const value = recommendation.y_column ? toFiniteNumber(record[recommendation.y_column]) : 1;
    if (value === null) return;
    const current = groups.get(label) ?? { total: 0, count: 0 };
    current.total += value;
    current.count += 1;
    groups.set(label, current);
  });
  return Array.from(groups, ([label, values]) => ({ label, value: values.total / values.count }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 20);
}

export function VisualizationPage() {
  const { activeDatasetId } = useDataset();
  const [recommendations, setRecommendations] = useState<ChartRecommendation[]>(EMPTY_RECOMMENDATIONS);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!activeDatasetId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getVisualizationRecommendations(activeDatasetId),
      getDatasetPreview(activeDatasetId, { limit: 1000, offset: 0 }),
    ]).then(([recommendationResponse, preview]) => {
      if (cancelled) return;
      const nextRecommendations = recommendationResponse.recommendations ?? [];
      setRecommendations(nextRecommendations);
      setSelectedIndex(0);
      setRecords(preview.rows.map((row) => Array.isArray(row)
        ? Object.fromEntries(preview.columns.map((column, index) => [column, row[index]]))
        : row));
      setError('');
    }).catch((requestError: Error) => {
      if (!cancelled) setError(requestError.message);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeDatasetId]);

  if (!activeDatasetId) return <section className="panel" style={{ padding: '2rem' }}><div className="eyebrow">DATASET REQUIRED</div><h2>No dataset selected</h2><p>Upload a dataset to explore chart recommendations.</p></section>;

  const selected = recommendations[selectedIndex];
  const data = selected ? aggregateRecords(records, selected) : [];
  const scatterData = data.filter((point): point is ScatterPoint => 'x' in point && 'y' in point);
  const seriesData = data.filter((point): point is SeriesPoint => 'label' in point && 'value' in point);
  const isScatter = selected?.chart_type === 'scatter';
  const chartName = selected ? `${selected.chart_type} · ${selected.x_column}${selected.y_column ? ` vs ${selected.y_column}` : ''}` : 'Recommended chart';

  return <><div className="page-heading"><div><div className="eyebrow">DATA WORKSPACE</div><h1>Visualization studio</h1><p>Explore charts recommended for the active dataset.</p></div></div>
    {error && <section className="panel" role="alert"><p>{error}</p></section>}
    <div className="viz-layout">
      <section className="panel chart-builder"><div className="panel-title"><h2>Recommendations</h2></div>{loading && <p>Loading dataset recommendations...</p>}{!loading && !recommendations.length && !error && <p>No suitable charts were found for this dataset.</p>}{recommendations.slice(0, 30).map((recommendation, index) => <button className={`quick-action ${index === selectedIndex ? 'active' : ''}`} key={`${recommendation.chart_type}-${recommendation.x_column}-${recommendation.y_column ?? 'count'}`} onClick={() => setSelectedIndex(index)}><span>{recommendation.chart_type}</span><span>{recommendation.x_column}{recommendation.y_column ? ` · ${recommendation.y_column}` : ''}</span></button>)}</section>
      <section className="panel visualization"><div className="panel-title"><h2>{chartName}</h2><span className="muted">First 1,000 rows</span></div>{selected && <p className="muted">{selected.reason}</p>}<div style={{ width: '100%', height: 340 }}>{selected && data.length > 0 && <ResponsiveContainer width="100%" height="100%">{isScatter ? <ScatterChart><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" dataKey="x" name={selected.x_column} /><YAxis type="number" dataKey="y" name={selected.y_column ?? 'Value'} /><Tooltip cursor={{ strokeDasharray: '3 3' }} /><Scatter data={scatterData} fill="#178b75" /></ScatterChart> : selected.chart_type === 'line' ? <LineChart data={seriesData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis /><Tooltip /><Line type="monotone" dataKey="value" stroke="#178b75" dot={false} /></LineChart> : <BarChart data={seriesData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis /><Tooltip /><Bar dataKey="value" fill="#178b75" /></BarChart>}</ResponsiveContainer>}</div>{selected && !data.length && <p>No plottable values were found in the preview.</p>}</section>
    </div>
  </>;
}
