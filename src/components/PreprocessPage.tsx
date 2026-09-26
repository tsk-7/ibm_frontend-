import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, GitBranch, Plus, Trash2, WandSparkles } from 'lucide-react';
import { useDataset } from '../context/DatasetContext';
import {
  createColumn,
  deleteColumn,
  processDtype,
  processDuplicateRows,
  processMissingValues,
  renameColumn,
} from '../services/preprocessingService';

const EMPTY_COLUMNS: string[] = [];
const DATA_TYPES = ['integer', 'float', 'string', 'boolean', 'datetime'];
const MISSING_METHODS = ['remove_rows', 'mean', 'median', 'mode', 'custom', 'ffill', 'bfill'];

export function PreprocessPage({ onNotice }: { onNotice: (message: string) => void }) {
  const { activeDatasetId, dataset, loadDataset } = useDataset();
  const columns: string[] = dataset?.column_names ?? EMPTY_COLUMNS;
  const [selectedColumn, setSelectedColumn] = useState('');
  const [missingMethod, setMissingMethod] = useState('median');
  const [customValue, setCustomValue] = useState('');
  const [targetType, setTargetType] = useState('string');
  const [newColumnName, setNewColumnName] = useState('');
  const [expression, setExpression] = useState('');
  const [renamedColumn, setRenamedColumn] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (columns.length && !columns.includes(selectedColumn)) setSelectedColumn(columns[0]);
  }, [columns, selectedColumn]);

  useEffect(() => {
    const currentType = dataset?.data_types?.[selectedColumn] ?? '';
    if (/int|float|number/i.test(currentType)) {
      if (!['mean', 'median', 'mode', 'custom', 'remove_rows', 'ffill', 'bfill'].includes(missingMethod)) setMissingMethod('median');
    } else if (missingMethod === 'mean' || missingMethod === 'median') {
      setMissingMethod('mode');
    }
    setTargetType(currentType.includes('int') ? 'integer' : currentType.includes('float') ? 'float' : 'string');
    setRenamedColumn(selectedColumn);
  }, [dataset, selectedColumn, missingMethod]);

  if (!activeDatasetId) {
    return <section className="panel" style={{ padding: '2rem' }}><div className="eyebrow">DATASET REQUIRED</div><h2>No dataset selected</h2><p>Upload a dataset to access preprocessing tools.</p></section>;
  }

  const runOperation = async (operation: () => Promise<unknown>, successMessage: string) => {
    setBusy(true);
    setError('');
    try {
      await operation();
      await loadDataset(activeDatasetId);
      onNotice(successMessage);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The operation could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  const applyMissingValues = () => runOperation(() => processMissingValues(activeDatasetId, {
    column: selectedColumn,
    method: missingMethod,
    ...(missingMethod === 'custom' ? { value: customValue } : {}),
  }), 'Missing values updated.');

  const removeDuplicates = () => runOperation(
    () => processDuplicateRows(activeDatasetId, { action: 'remove' }),
    'Duplicate rows removed.',
  );

  const convertType = () => runOperation(
    () => processDtype(activeDatasetId, { column: selectedColumn, dtype: targetType }),
    'Column type converted.',
  );

  const rename = () => runOperation(
    () => renameColumn(activeDatasetId, { old_name: selectedColumn, new_name: renamedColumn }),
    'Column renamed.',
  );

  const removeColumn = () => {
    if (window.confirm(`Delete the column "${selectedColumn}" from this dataset?`)) {
      void runOperation(() => deleteColumn(activeDatasetId, selectedColumn), 'Column deleted.');
    }
  };

  const addColumn = () => runOperation(
    () => createColumn(activeDatasetId, { name: newColumnName, operation: expression }),
    'Calculated column created.',
  );

  const numericColumn = /int|float|number/i.test(dataset?.data_types?.[selectedColumn] ?? '');
  const availableMethods = MISSING_METHODS.filter((method) => numericColumn || !['mean', 'median'].includes(method));

  return <><div className="page-heading"><div><div className="eyebrow">DATA WORKSPACE</div><h1>Data preprocessing</h1><p>Clean and prepare the active dataset.</p></div></div>
    {error && <section className="panel" role="alert"><p>{error}</p></section>}
    <div className="preprocess-grid">
      <section className="panel issue-card">
        <div className="issue-heading"><div className="stat-icon orange"><AlertCircle size={17} /></div><div><h2>Missing values</h2><span>Choose a column and fill or remove missing rows.</span></div></div>
        <div className="field-list"><label className="field-row"><strong>Column</strong><select value={selectedColumn} onChange={(event) => setSelectedColumn(event.target.value)} disabled={!columns.length || busy}>{columns.map((column) => <option key={column} value={column}>{column}</option>)}</select></label>
          <label className="field-row"><strong>Method</strong><select value={missingMethod} onChange={(event) => setMissingMethod(event.target.value)} disabled={busy}>{availableMethods.map((method) => <option key={method} value={method}>{method}</option>)}</select></label>
          {missingMethod === 'custom' && <label className="field-row"><strong>Value</strong><input value={customValue} onChange={(event) => setCustomValue(event.target.value)} disabled={busy} /></label>}
        </div>
        <button className="secondary-button full" onClick={() => void applyMissingValues()} disabled={busy || !selectedColumn}>{busy ? 'Applying...' : 'Apply missing value rules'}</button>
      </section>
      <section className="panel issue-card">
        <div className="issue-heading"><div className="stat-icon red"><GitBranch size={17} /></div><div><h2>Duplicate rows</h2><span>Remove repeated records from the active dataset.</span></div></div>
        <div className="success-box"><CheckCircle2 size={16} /><span>Duplicate detection and removal are handled by the backend.</span></div>
        <button className="danger-button" onClick={() => void removeDuplicates()} disabled={busy}>{busy ? 'Applying...' : 'Remove duplicates'}</button>
      </section>
      <section className="panel wide-panel">
        <div className="panel-title"><h2>Data type conversion</h2></div>
        <div className="field-list"><label className="field-row"><strong>Column</strong><select value={selectedColumn} onChange={(event) => setSelectedColumn(event.target.value)} disabled={!columns.length || busy}>{columns.map((column) => <option key={column} value={column}>{column}</option>)}</select></label>
          <label className="field-row"><strong>Convert to</strong><select value={targetType} onChange={(event) => setTargetType(event.target.value)} disabled={busy}>{DATA_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
        </div>
        <button className="secondary-button" onClick={() => void convertType()} disabled={busy || !selectedColumn}>Convert column type</button>
      </section>
      <section className="panel wide-panel">
        <div className="panel-title"><h2>Manage columns</h2></div>
        <div className="field-list"><label className="field-row"><strong>Selected column</strong><select value={selectedColumn} onChange={(event) => setSelectedColumn(event.target.value)} disabled={!columns.length || busy}>{columns.map((column) => <option key={column} value={column}>{column}</option>)}</select></label>
          <label className="field-row"><strong>Rename to</strong><input value={renamedColumn} onChange={(event) => setRenamedColumn(event.target.value)} disabled={busy} /></label>
        </div>
        <div className="button-row"><button className="secondary-button" onClick={() => void rename()} disabled={busy || !selectedColumn || !renamedColumn}>Rename column</button><button className="danger-button" onClick={removeColumn} disabled={busy || !selectedColumn}><Trash2 size={14} /> Delete column</button></div>
        <div className="field-list"><label className="field-row"><strong>New column</strong><input value={newColumnName} onChange={(event) => setNewColumnName(event.target.value)} placeholder="Column name" disabled={busy} /></label>
          <label className="field-row"><strong>Expression</strong><input value={expression} onChange={(event) => setExpression(event.target.value)} placeholder="Price * Quantity" disabled={busy} /></label>
        </div>
        <button className="primary-button" onClick={() => void addColumn()} disabled={busy || !newColumnName || !expression}><Plus size={15} /> Create calculated column</button>
      </section>
    </div>
    <div className="tip-banner"><div className="tip-icon"><WandSparkles size={18} /></div><div><strong>Changes apply to the current dataset</strong><span>The backend keeps the original upload unchanged and records successful processing operations.</span></div></div>
  </>;
}
