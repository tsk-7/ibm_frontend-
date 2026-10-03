import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Database, GitBranch, Plus, Trash2, WandSparkles } from 'lucide-react';
import { useDataset } from '../context/DatasetContext';
import { getDatasetPreview, getDatasetProfile, type DatasetProfile, type DatasetPreview } from '../services/datasetService';
import { getStatistics, type StatisticsResponse } from '../services/statisticsService';
import { createColumn, deleteColumn, processDtype, processDuplicateRows, processMissingValues, renameColumn } from '../services/preprocessingService';

const DATA_TYPES = ['integer', 'float', 'string', 'boolean', 'datetime'];
const MISSING_METHODS = ['remove_rows', 'mean', 'median', 'mode', 'custom', 'ffill', 'bfill'];
const methodLabels: Record<string, string> = { remove_rows: 'Remove rows', mean: 'Mean', median: 'Median', mode: 'Mode', custom: 'Custom value', ffill: 'Forward fill', bfill: 'Backward fill' };
type PreviewRecord = Record<string, unknown>;

const isMissingValue = (value: unknown) => value == null || (typeof value === 'string' && value.trim() === '');
const displayValue = (value: unknown) => isMissingValue(value) ? 'Missing' : typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 3 }) : String(value);

function toPreviewRecords(preview: DatasetPreview): PreviewRecord[] {
  return preview.rows.map((row) => Array.isArray(row)
    ? Object.fromEntries(preview.columns.map((column, index) => [column, row[index]]))
    : row);
}

export function PreprocessPage({ onNotice }: { onNotice: (message: string) => void }) {
  const { activeDatasetId, dataset, loadDataset } = useDataset();
  const columns = useMemo(() => dataset?.column_names ?? [], [dataset?.column_names]);
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [statistics, setStatistics] = useState<StatisticsResponse | null>(null);
  const [sampleRows, setSampleRows] = useState<PreviewRecord[] | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState('');
  const [missingMethod, setMissingMethod] = useState('median');
  const [customValue, setCustomValue] = useState('');
  const [targetType, setTargetType] = useState('string');
  const [renamedColumn, setRenamedColumn] = useState('');
  const [newColumnName, setNewColumnName] = useState('');
  const [expression, setExpression] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!activeDatasetId) {
      setProfile(null);
      setStatistics(null);
      setSampleRows(null);
      setPreviewReady(false);
      return;
    }

    let cancelled = false;
    setPreviewReady(false);
    setSampleRows(null);
    void getDatasetProfile(activeDatasetId).then((result) => { if (!cancelled) setProfile(result); }).catch(() => { if (!cancelled) setProfile(null); });
    void getStatistics(activeDatasetId).then((result) => { if (!cancelled) setStatistics(result); }).catch(() => { if (!cancelled) setStatistics(null); });
    return () => { cancelled = true; };
  }, [activeDatasetId, dataset]);
  useEffect(() => { if (columns.length && !columns.includes(selectedColumn)) setSelectedColumn(columns[0]); }, [columns, selectedColumn]);
  useEffect(() => { const currentType = dataset?.data_types?.[selectedColumn] ?? ''; setTargetType(/int/i.test(currentType) ? 'integer' : /float|number/i.test(currentType) ? 'float' : 'string'); setRenamedColumn(selectedColumn); }, [dataset, selectedColumn]);

  const missingByColumn = profile?.missing_values?.by_column ?? {};
  const affectedColumns = columns.filter((column) => Number(missingByColumn[column] ?? 0) > 0);
  const missingTotal = Number(profile?.missing_values?.total ?? 0);
  const selectedMissing = Number(missingByColumn[selectedColumn] ?? 0);
  const numericColumn = /int|float|number|double|decimal/i.test(dataset?.data_types?.[selectedColumn] ?? '');
  const availableMethods = MISSING_METHODS.filter((method) => numericColumn || !['mean', 'median'].includes(method));
  const missingPercentage = profile?.total_rows && profile.total_columns ? (missingTotal / (profile.total_rows * profile.total_columns)) * 100 : 0;
  const qualityStatus = missingTotal === 0 && (profile?.duplicate_rows ?? 0) === 0 ? 'Healthy' : 'Needs attention';
  const numericalStats = statistics?.numerical?.[selectedColumn];
  const categoricalStats = statistics?.categorical?.[selectedColumn];
  const replacementValue = missingMethod === 'mean' ? numericalStats?.mean
    : missingMethod === 'median' ? numericalStats?.median
      : missingMethod === 'mode' ? categoricalStats?.most_frequent_value
        : missingMethod === 'custom' ? customValue
          : null;
  const hasReplacementValue = replacementValue !== null && replacementValue !== undefined && (typeof replacementValue !== 'string' || replacementValue.trim() !== '');
  const selectedMethodDescription = missingMethod === 'median' ? 'Fills each missing cell with the backend-reported median for this numerical column.'
    : missingMethod === 'mean' ? 'Fills each missing cell with the backend-reported mean for this numerical column.'
      : missingMethod === 'mode' ? 'Fills each missing cell with the most frequent value returned for this column.'
        : missingMethod === 'remove_rows' ? 'Removes rows with missing values in the selected column.'
          : missingMethod === 'custom' ? 'Fills each missing cell with the value you enter.'
            : missingMethod === 'ffill' ? 'Fills missing cells from the previous non-missing value.'
              : 'Fills missing cells from the next non-missing value.';
  const previewAfterRows = useMemo(() => {
    if (!sampleRows) return [];
    if (missingMethod === 'remove_rows') return sampleRows.filter((row) => !isMissingValue(row[selectedColumn]));
    return sampleRows.map((row, index) => {
      if (!isMissingValue(row[selectedColumn])) return row;
      let value: unknown = replacementValue;
      if (missingMethod === 'ffill') value = sampleRows.slice(0, index).reverse().find((candidate) => !isMissingValue(candidate[selectedColumn]))?.[selectedColumn] ?? null;
      if (missingMethod === 'bfill') value = sampleRows.slice(index + 1).find((candidate) => !isMissingValue(candidate[selectedColumn]))?.[selectedColumn] ?? null;
      return isMissingValue(value) ? row : { ...row, [selectedColumn]: value };
    });
  }, [sampleRows, selectedColumn, missingMethod, replacementValue]);
  const sampleAffected = sampleRows?.filter((row) => isMissingValue(row[selectedColumn])).length ?? 0;
  const canApplyPreview = previewReady && (missingMethod === 'remove_rows' || missingMethod === 'ffill' || missingMethod === 'bfill' || hasReplacementValue);

  if (!activeDatasetId) return <section className="panel empty-preprocess"><div className="eyebrow">DATA CLEANING WORKSPACE</div><h2>Upload a dataset to begin cleaning.</h2><p>Inspect quality issues, apply supported transformations, and verify the result here.</p></section>;

  const runOperation = async (operation: () => Promise<unknown>, message: string) => { setBusy(true); setError(''); try { await operation(); await loadDataset(activeDatasetId); onNotice(message); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'The operation could not be completed.'); } finally { setBusy(false); } };
  const createMissingPreview = async () => {
    setPreviewLoading(true);
    setPreviewReady(false);
    setError('');
    try {
      const preview = await getDatasetPreview(activeDatasetId, { limit: 8, offset: 0 });
      setSampleRows(toPreviewRecords(preview));
      setPreviewReady(true);
    } catch {
      setError('Unable to load a sample preview. Please try again.');
    } finally {
      setPreviewLoading(false);
    }
  };
  const applyMissing = () => {
    if (!canApplyPreview) return;
    void runOperation(() => processMissingValues(activeDatasetId, { column: selectedColumn, method: missingMethod, ...(missingMethod === 'custom' ? { value: customValue } : {}) }), 'Missing values updated.');
  };
  const removeDuplicates = () => void runOperation(() => processDuplicateRows(activeDatasetId, { action: 'remove' }), 'Duplicate rows removed.');
  const convertType = () => void runOperation(() => processDtype(activeDatasetId, { column: selectedColumn, dtype: targetType }), 'Column type converted.');
  const rename = () => void runOperation(() => renameColumn(activeDatasetId, { old_name: selectedColumn, new_name: renamedColumn }), 'Column renamed.');
  const removeColumn = () => { if (window.confirm(`Delete the column "${selectedColumn}" from this dataset?`)) void runOperation(() => deleteColumn(activeDatasetId, selectedColumn), 'Column deleted.'); };
  const addColumn = () => void runOperation(() => createColumn(activeDatasetId, { name: newColumnName, operation: expression }), 'Calculated column created.');

  return <><div className="page-heading preprocess-page-heading"><div><div className="eyebrow">DATA CLEANING WORKSPACE</div><h1>Prepare your dataset</h1><p>Inspect problems, clean the active dataset, transform columns, then verify.</p></div><div className="preprocess-status"><span className={qualityStatus === 'Healthy' ? 'status-good' : 'status-warning'}>{qualityStatus}</span><small>{dataset?.filename || activeDatasetId}</small></div></div>
    <div className="preprocess-workflow"><span className="active"><b>01</b> Inspect</span><ArrowRight size={15} /><span><b>02</b> Clean</span><ArrowRight size={15} /><span><b>03</b> Transform</span><ArrowRight size={15} /><span><b>04</b> Verify</span></div>
    {error && <section className="panel preprocess-error" role="alert"><AlertCircle size={17} /><p>{error}</p></section>}
    <div className="preprocess-summary"><div><Database size={17} /><span>Rows<strong>{profile?.total_rows?.toLocaleString() ?? dataset?.rows?.toLocaleString() ?? '—'}</strong></span></div><div><Database size={17} /><span>Columns<strong>{profile?.total_columns ?? columns.length}</strong></span></div><div><AlertCircle size={17} /><span>Missing cells<strong>{missingTotal.toLocaleString()}</strong></span></div><div><GitBranch size={17} /><span>Duplicate rows<strong>{profile?.duplicate_rows?.toLocaleString() ?? '—'}</strong></span></div></div>
    <section className="panel missing-workspace">
      <div className="section-kicker">
        <div><div className="eyebrow">DATA QUALITY · PRIORITY</div><h2>Missing values</h2><p>Review backend counts, choose a rule, and inspect a sample before changing data.</p></div>
        <div className="missing-total"><strong>{missingTotal.toLocaleString()}</strong><span>{missingPercentage.toFixed(1)}% of dataset cells</span></div>
      </div>
      <div className="missing-content">
        <div className="missing-table-wrap">
          <div className="missing-table-heading"><span>Column</span><span>Missing</span><span>Type</span><span>Suggested rule</span></div>
          {affectedColumns.length ? affectedColumns.map((column) => <button className={`missing-table-row ${selectedColumn === column ? 'selected' : ''}`} key={column} onClick={() => { setSelectedColumn(column); setPreviewReady(false); }}>
            <strong>{column}</strong><b>{Number(missingByColumn[column]).toLocaleString()}</b><span>{dataset?.data_types?.[column] || 'Unknown'}</span><span>{/int|float|number/i.test(dataset?.data_types?.[column] ?? '') ? 'Median' : 'Mode'}</span>
          </button>) : <div className="missing-empty"><CheckCircle2 size={18} />No missing values reported by the backend.</div>}
        </div>
        <div className="missing-action-card">
          <div className="eyebrow">PREVIEW BEFORE APPLYING</div>
          <h3>{selectedColumn || 'Select a column'}</h3>
          <p>{selectedMissing.toLocaleString()} missing values reported for this column.</p>
          <label>Method<select value={missingMethod} onChange={(event) => { setMissingMethod(event.target.value); setPreviewReady(false); }} disabled={busy || previewLoading}>{availableMethods.map((method) => <option key={method} value={method}>{methodLabels[method]}</option>)}</select></label>
          {missingMethod === 'custom' && <label>Custom value<input value={customValue} onChange={(event) => { setCustomValue(event.target.value); setPreviewReady(false); }} disabled={busy || previewLoading} /></label>}
          <div className="method-explanation"><strong>What it does</strong><span>{selectedMethodDescription}</span><strong>Potential effect</strong><span>Filled values become part of later statistics. Review this sample and the updated health report after applying.</span></div>
          <div className="backend-value"><span>Value from backend statistics</span><strong>{hasReplacementValue ? displayValue(replacementValue) : missingMethod === 'mean' || missingMethod === 'median' || missingMethod === 'mode' ? 'Not returned for this column' : 'Not applicable'}</strong></div>
          <button className="secondary-button" onClick={() => void createMissingPreview()} disabled={busy || previewLoading || !selectedColumn || !selectedMissing}>{previewLoading ? 'Loading sample...' : 'Preview change'}</button>
        </div>
      </div>
    </section>
    {previewReady && sampleRows && <section className="panel before-after-panel">
      <div className="before-after-heading"><div><div className="eyebrow">SAMPLE PREVIEW</div><h2>Review the proposed change</h2></div><span>{sampleRows.length} rows loaded from the backend preview</span></div>
      <div className="before-after-grid">
        {[{ title: 'Before', rows: sampleRows }, { title: 'After', rows: previewAfterRows }].map(({ title, rows }) => <div className="preview-table-wrap" key={title}>
          <h3>{title}</h3><table className="preview-column-table"><thead><tr><th>Sample row</th><th>{selectedColumn}</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${title}-${index}`}><td>{index + 1}</td><td>{displayValue(row[selectedColumn])}</td></tr>)}</tbody></table>
        </div>)}
      </div>
      <p className="preview-note">{missingMethod === 'remove_rows' ? `${sampleAffected} rows with a missing ${selectedColumn} value appear in this sample. Total affected rows are not returned by the profile API.` : `${sampleAffected} missing cells appear in this sample; the backend reports ${selectedMissing.toLocaleString()} for the full column.`}</p>
      {!canApplyPreview && <p className="preview-note" role="status">A backend replacement value is not available for this method and column. Choose another supported method or enter a custom value.</p>}
      <div className="button-row preview-actions"><button className="secondary-button" onClick={() => void createMissingPreview()} disabled={busy || previewLoading}>{previewLoading ? 'Refreshing...' : 'Refresh preview'}</button><button className="primary-button" onClick={applyMissing} disabled={busy || !canApplyPreview}>{busy ? 'Applying...' : 'Confirm and apply'}</button></div>
    </section>}
    <div className="preprocess-secondary-grid"><section className="panel cleaning-card"><div className="card-heading"><div className="stat-icon orange"><GitBranch size={17} /></div><div><h2>Duplicate rows</h2><p>{profile?.duplicate_rows?.toLocaleString() ?? '—'} repeated records detected by the backend.</p></div></div><div className="warning-note">Removing duplicates modifies the active dataset.</div><button className="danger-button" onClick={removeDuplicates} disabled={busy || !profile?.duplicate_rows}>{busy ? 'Applying...' : 'Remove duplicates'}</button></section><section className="panel cleaning-card"><div className="card-heading"><div className="stat-icon teal"><WandSparkles size={17} /></div><div><h2>Data type conversion</h2><p>Make a selected column compatible with analysis.</p></div></div><div className="compact-form"><label>Column<select value={selectedColumn} onChange={(event) => setSelectedColumn(event.target.value)} disabled={busy}>{columns.map((column) => <option key={column} value={column}>{column}</option>)}</select></label><label>Current type<span className="type-pill">{dataset?.data_types?.[selectedColumn] || 'Unknown'}</span></label><label>Target type<select value={targetType} onChange={(event) => setTargetType(event.target.value)} disabled={busy}>{DATA_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label></div><button className="secondary-button" onClick={convertType} disabled={busy || !selectedColumn}>Convert column type</button></section></div>
    <section className="panel manage-columns"><div className="section-kicker"><div><div className="eyebrow">DATA STRUCTURE</div><h2>Manage columns</h2><p>Rename, remove, or create features without leaving the cleaning workspace.</p></div></div><div className="manage-column-grid"><div className="manage-subcard"><h3>Rename column</h3><label>Current column<select value={selectedColumn} onChange={(event) => setSelectedColumn(event.target.value)} disabled={busy}>{columns.map((column) => <option key={column} value={column}>{column}</option>)}</select></label><label>New name<input value={renamedColumn} onChange={(event) => setRenamedColumn(event.target.value)} disabled={busy} /></label><button className="secondary-button" onClick={rename} disabled={busy || !selectedColumn || !renamedColumn}>Rename column</button></div><div className="manage-subcard destructive-subcard"><h3>Delete column</h3><p>This removes the selected column from the active dataset.</p><button className="danger-button" onClick={removeColumn} disabled={busy || !selectedColumn}><Trash2 size={14} /> Delete {selectedColumn || 'column'}</button></div><div className="manage-subcard calculated-subcard"><h3>Calculated column</h3><label>New column<input value={newColumnName} onChange={(event) => setNewColumnName(event.target.value)} placeholder="Column name" disabled={busy} /></label><label>Expression<input value={expression} onChange={(event) => setExpression(event.target.value)} placeholder="Price * Quantity" disabled={busy} /></label><button className="primary-button" onClick={addColumn} disabled={busy || !newColumnName || !expression}><Plus size={15} /> Create calculated column</button></div></div></section>
    <div className="tip-banner"><div className="tip-icon"><WandSparkles size={18} /></div><div><strong>Verify after every operation</strong><span>Refresh the dataset preview and health views to confirm backend changes were applied.</span></div></div>
  </>;
}
