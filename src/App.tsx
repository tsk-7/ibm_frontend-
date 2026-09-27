import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent, type ReactNode } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  Bell,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Database,
  Download,
  FileSpreadsheet,
  GitBranch,
  History,
  LayoutDashboard,
  LineChart,
  Menu,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Table2,
  UploadCloud,
  WandSparkles,
  X,
} from 'lucide-react';
import { DataInsightAssistant } from './components/assistant';
import { useDataset } from './context/DatasetContext';
import { downloadDataset, getDataset, getDatasets, getDatasetPreview, getDatasetProfile, uploadDataset } from './services/datasetService';
import { getHealth } from './services/healthService';
import { getHistory } from './services/historyService';
import { getStatistics } from './services/statisticsService';
import { PreprocessPage } from './components/PreprocessPage';
import { VisualizationPage } from './components/VisualizationPage';

type Page = 'Dashboard' | 'Upload Dataset' | 'Dataset' | 'Preprocess' | 'Visualization' | 'Statistics' | 'Data Health' | 'History' | 'AI Assistant';
type IconType = typeof LayoutDashboard;

const navItems: { label: Page; icon: IconType }[] = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Upload Dataset', icon: UploadCloud },
  { label: 'Dataset', icon: Table2 },
  { label: 'Preprocess', icon: WandSparkles },
  { label: 'Visualization', icon: LineChart },
  { label: 'Statistics', icon: BarChart3 },
  { label: 'Data Health', icon: ShieldCheck },
  { label: 'History', icon: History },
  { label: 'AI Assistant', icon: Bot },
];

function App() {
  const { activeDatasetId, dataset, setActiveDatasetId, setDataset, loadDataset } = useDataset();
  const [page, setPage] = useState<Page>('Dashboard');
  const [availableDatasets, setAvailableDatasets] = useState<{ dataset_id: string; filename: string }[]>([]);
  const [datasetListError, setDatasetListError] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [notice, setNotice] = useState('');
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [dataRevision, setDataRevision] = useState(0);

  const resolvedDatasetId = activeDatasetId;

  useEffect(() => {
    let cancelled = false;
    getDatasets().then((result: { dataset_id: string; filename: string }[]) => {
      if (!cancelled) {
        setAvailableDatasets(Array.isArray(result) ? result : []);
        setDatasetListError('');
      }
    }).catch((requestError: Error) => {
      if (!cancelled) setDatasetListError(requestError.message);
    });
    return () => { cancelled = true; };
  }, []);

  const handlePageChange = (nextPage: Page) => {
    setPage(nextPage);
    setMobileNavOpen(false);
  };

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2800);
  };

  const handleUploadComplete = async (datasetId: string) => {
    setActiveDatasetId(datasetId);
    await loadDataset(datasetId);
    setShowUpload(false);
    setPage('Dataset');
    showNotice('Dataset uploaded successfully.');
  };

  const handleUploadFile = async (file: File) => {
    const extension = file.name.toLowerCase();
    if (!/\.(csv|xlsx|xls)$/i.test(extension)) throw new Error('Please upload a CSV or Excel file.');
    if (file.size > 50 * 1024 * 1024) throw new Error('Files must be 50 MB or smaller.');
    const response = await uploadDataset(file);
    if (!response.dataset_id) throw new Error('The backend did not return a dataset ID.');
    await handleUploadComplete(response.dataset_id);
  };

  const handleDatasetSelection = async (event: ChangeEvent<HTMLSelectElement>) => {
    const datasetId = event.target.value;
    if (!datasetId || datasetId === activeDatasetId) return;
    try {
      const selectedDataset = await getDataset(datasetId);
      setDataset(selectedDataset);
      setActiveDatasetId(datasetId);
      setAssistantOpen(false);
      showNotice(`Selected ${selectedDataset.filename}.`);
    } catch (requestError) {
      showNotice(requestError instanceof Error ? requestError.message : 'Could not load the selected dataset.');
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <div className="brand-mark"><Database size={17} /></div>
          <div><strong>DataInsight</strong><span>Studio</span></div>
        </div>
        <button className="mobile-menu" onClick={() => setMobileNavOpen(!mobileNavOpen)} aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileNavOpen}>
          {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <nav className={`topnav-links ${mobileNavOpen ? 'topnav-links-open' : ''}`} aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={`topnav-item ${page === label ? 'active' : ''}`} onClick={() => handlePageChange(label)} aria-current={page === label ? 'page' : undefined}>
              <Icon size={15} strokeWidth={1.8} /><span>{label === 'Upload Dataset' ? 'Upload' : label}</span>
            </button>
          ))}
        </nav>
        <div className="topbar-actions">
          <div className="search-box"><Search size={15} /><input placeholder="Search..." aria-label="Search" /></div>
          <label className="dataset-switcher">
            <span>Dataset</span>
            <select aria-label="Select active dataset" value={activeDatasetId} onChange={(event) => { void handleDatasetSelection(event); }} title={datasetListError || undefined}>
              <option value="">None selected</option>
              {activeDatasetId && !availableDatasets.some((item) => item.dataset_id === activeDatasetId) && <option value={activeDatasetId}>{dataset?.filename || activeDatasetId}</option>}
              {availableDatasets.map((item) => <option key={item.dataset_id} value={item.dataset_id}>{item.filename}</option>)}
            </select>
            <span className={`status-dot ${datasetListError ? 'status-dot-error' : ''}`} aria-hidden="true" />
          </label>
          <button className="icon-button" onClick={() => showNotice('You are all caught up.')} aria-label="Notifications"><Bell size={17} /><i /></button>
          <div className="profile-menu-wrap">
            <button className="profile-button" onClick={() => setProfileMenuOpen(!profileMenuOpen)} aria-expanded={profileMenuOpen} aria-haspopup="menu"><div className="avatar">A</div><span>Analyst</span><ChevronDown size={13} /></button>
            {profileMenuOpen && <div className="profile-menu" role="menu">
              <button role="menuitem" onClick={() => { showNotice('Settings are ready for your workspace.'); setProfileMenuOpen(false); }}><Settings size={15} />Settings</button>
              <button role="menuitem" onClick={() => { showNotice('Help center opened.'); setProfileMenuOpen(false); }}><CircleHelp size={15} />Help &amp; support</button>
            </div>}
          </div>
        </div>
      </header>
      <main className="main-area">
        <div className="content-wrap page-view" key={`${page}-${page === 'AI Assistant' ? 0 : dataRevision}`}>
          {page === 'Dashboard' && <Dashboard onUpload={() => setShowUpload(true)} onPageChange={handlePageChange} />}
          {page === 'Upload Dataset' && <UploadPage onUpload={() => setShowUpload(true)} onUploadFile={handleUploadFile} onNotice={showNotice} />}
          {page === 'Dataset' && <DatasetPage />}
          {page === 'Preprocess' && <PreprocessPage onNotice={showNotice} />}
          {page === 'Visualization' && <VisualizationPage />}
          {page === 'Statistics' && <StatisticsPage datasetId={activeDatasetId} />}
          {page === 'Data Health' && <HealthPage datasetId={activeDatasetId} />}
          {page === 'History' && <HistoryPage datasetId={activeDatasetId} />}
          {page === 'AI Assistant' && <DataInsightAssistant key={resolvedDatasetId || 'general'} datasetId={resolvedDatasetId || null} fullPage onDataChanged={() => setDataRevision((revision) => revision + 1)} />}
        </div>
      </main>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onUploadFile={handleUploadFile} />}
      <button className="assistant-launcher" onClick={() => {
          setAssistantOpen(true);
        }} aria-label="Open AI Assistant">
          <Bot size={18} /><span>AI Assistant</span>
      </button>
      {assistantOpen && (
        <div className="assistant-drawer-backdrop" onClick={() => setAssistantOpen(false)}>
          <div className="assistant-drawer" onClick={(event) => event.stopPropagation()}><DataInsightAssistant key={resolvedDatasetId || 'general'} datasetId={resolvedDatasetId || null} onDataChanged={() => setDataRevision((revision) => revision + 1)} onClose={() => setAssistantOpen(false)} /></div>
        </div>
      )}
      {notice && <div className="toast"><CheckCircle2 size={17} />{notice}</div>}
    </div>
  );
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow || 'DATA WORKSPACE'}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function EmptyDatasetState({ helper }: { helper: string }) {
  return <section className="panel" style={{ padding: '2rem' }}><div className="eyebrow">DATASET REQUIRED</div><h2>No dataset selected</h2><p>{helper}</p></section>;
}

type DatasetProfile = { total_rows: number; total_columns: number; missing_values: { total: number }; duplicate_rows: number };

function Dashboard({ onUpload, onPageChange }: { onUpload: () => void; onPageChange: (page: Page) => void }) {
  const { activeDatasetId, dataset } = useDataset();
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!activeDatasetId) return;
    let cancelled = false;
    Promise.all([getDatasetProfile(activeDatasetId), getHealth(activeDatasetId), getHistory(activeDatasetId)])
      .then(([nextProfile, nextHealth, nextHistory]: [DatasetProfile, HealthReport, HistoryEntry[]]) => {
        if (cancelled) return;
        setProfile(nextProfile);
        setHealth(nextHealth);
        setHistory(nextHistory);
        setError('');
      })
      .catch((requestError: Error) => {
        if (!cancelled) setError(requestError.message);
      });
    return () => { cancelled = true; };
  }, [activeDatasetId]);

  if (!activeDatasetId) {
    return <><PageHeading title="Data workspace" description="Analyze, clean, and understand your data in one workspace." action={<button className="primary-button" onClick={onUpload}><Plus size={16} /> Upload dataset</button>} /><EmptyDatasetState helper="Upload a dataset to see its profile, quality, and processing activity here." /></>;
  }

  const rowCount = profile?.total_rows ?? dataset?.rows ?? 0;
  const columnCount = profile?.total_columns ?? dataset?.columns ?? 0;

  return (
    <>
      <PageHeading title="Data workspace" description="Analyze, clean, and understand your data in one workspace." action={<button className="primary-button" onClick={onUpload}><Plus size={16} /> Upload dataset</button>} />
      {error && <section className="panel"><p role="alert">{error}</p></section>}
      <div className="stat-grid">
        <StatCard icon={Database} iconClass="blue" value={rowCount.toLocaleString()} label="Rows" note="Records in active dataset" />
        <StatCard icon={Table2} iconClass="teal" value={columnCount.toLocaleString()} label="Columns" note="Features available" />
        <StatCard icon={AlertCircle} iconClass="orange" value={profile?.missing_values.total.toLocaleString() ?? '—'} label="Missing values" note="Across your dataset" />
        <StatCard icon={GitBranch} iconClass="red" value={profile?.duplicate_rows.toLocaleString() ?? '—'} label="Duplicate rows" note="Detected in current data" />
      </div>
      <div className="dashboard-grid">
        <section className="panel current-dataset">
          <PanelTitle title="Current dataset" action={<button className="text-button" onClick={() => onPageChange('Dataset')}>Open dataset <ArrowUpRight size={14} /></button>} />
          <div className="file-row"><div className="file-icon green"><FileSpreadsheet size={20} /></div><div><strong>{dataset?.filename || activeDatasetId}</strong><span>Dataset ID: {activeDatasetId}</span></div><span className="ready-tag">{dataset?.processing_status || 'Loaded'}</span></div>
          <div className="dataset-mini-stats"><div><span>Rows</span><strong>{rowCount.toLocaleString()}</strong></div><div><span>Columns</span><strong>{columnCount.toLocaleString()}</strong></div><div><span>Updated</span><strong>{dataset?.uploaded_at ? new Date(dataset.uploaded_at).toLocaleDateString() : '—'}</strong></div></div>
          <div className="progress-line"><span style={{ width: `${health?.overall_score ?? 0}%` }} /></div><small className="muted">Data quality score <strong>{health ? `${health.overall_score}%` : '—'}</strong></small>
        </section>
        <section className="panel quick-actions"><PanelTitle title="Quick actions" /><div className="action-grid"><QuickAction icon={WandSparkles} title="Clean data" onClick={() => onPageChange('Preprocess')} /><QuickAction icon={LineChart} title="Create visualization" onClick={() => onPageChange('Visualization')} /><QuickAction icon={BarChart3} title="View statistics" onClick={() => onPageChange('Statistics')} /><QuickAction icon={ShieldCheck} title="Check data health" onClick={() => onPageChange('Data Health')} /></div></section>
        <section className="panel activity-panel"><PanelTitle title="Recent activity" action={<button className="text-button" onClick={() => onPageChange('History')}>View all <ArrowUpRight size={14} /></button>} /><div className="activity-list">{history.slice(0, 4).map((entry) => <div className="activity-row" key={entry.id}><div className="activity-icon blue"><CheckCircle2 size={14} /></div><div className="activity-copy"><strong>{entry.operation.replace(/_/g, ' ')}</strong><span>{entry.details || entry.column_name || `${entry.rows_before} to ${entry.rows_after} rows`}</span></div><time>{new Date(entry.timestamp).toLocaleString()}</time></div>)}{!history.length && <p className="muted">No processing activity recorded yet.</p>}</div></section>
        <section className="panel chart-panel"><PanelTitle title="Dataset quality" /><div className="chart-label"><span>Overall health score</span><strong>{health ? `${health.overall_score}%` : '—'}</strong></div><div className="health-progress"><i className="green" style={{ width: `${health?.completeness ?? 0}%` }} /></div><div className="dataset-mini-stats"><div><span>Completeness</span><strong>{health ? `${health.completeness}%` : '—'}</strong></div><div><span>Consistency</span><strong>{health ? `${health.consistency}%` : '—'}</strong></div><div><span>Validity</span><strong>{health ? `${health.validity}%` : '—'}</strong></div></div></section>
      </div>
      <div className="tip-banner"><div className="tip-icon"><Sparkles size={18} /></div><div><strong>Get more from your data</strong><span>Use the preprocessing tools to clean, transform, and prepare your dataset before analysis.</span></div><button className="secondary-button" onClick={() => onPageChange('Preprocess')}>Explore tools <ChevronRight size={14} /></button></div>
    </>
  );
}

function StatCard({ icon: Icon, iconClass, value, label, note }: { icon: IconType; iconClass: string; value: string; label: string; note: string }) { return <div className="stat-card"><div className={`stat-icon ${iconClass}`}><Icon size={18} /></div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></div>; }
function PanelTitle({ title, action }: { title: string; action?: ReactNode }) { return <div className="panel-title"><h2>{title}</h2>{action}</div>; }
function QuickAction({ icon: Icon, title, onClick }: { icon: IconType; title: string; onClick: () => void }) { return <button className="quick-action" onClick={onClick}><div><Icon size={17} /></div><span>{title}</span><ChevronRight size={14} /></button>; }

function UploadPage({ onUpload, onUploadFile, onNotice }: { onUpload: () => void; onUploadFile: (file: File) => Promise<void>; onNotice: (message: string) => void }) {
  const { dataset } = useDataset();
  const [dragging, setDragging] = useState(false);

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (!file) return;
    try {
      await onUploadFile(file);
    } catch (uploadError) {
      onNotice(uploadError instanceof Error ? uploadError.message : 'Unable to upload dataset.');
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onUpload();
    }
  };

  return <><PageHeading title="Upload dataset" description="Add a CSV or Excel file to start analyzing your data." /><div className="upload-layout"><section className="panel upload-card"><div className={`drop-zone ${dragging ? 'drag-active' : ''}`} role="button" tabIndex={0} aria-label="Choose or drop a dataset file" onClick={onUpload} onKeyDown={handleKeyDown} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }} onDrop={(event) => { void handleDrop(event); }}><div className="upload-icon"><UploadCloud size={28} /></div><h2>Drag &amp; drop your dataset here</h2><p>or <span className="inline-link">browse files</span> from your computer</p><span>Supported formats: CSV, XLSX, XLS <i /> Maximum file size: 50 MB</span></div><div className="upload-history">{dataset ? <><div className="file-row"><div className="file-icon green"><FileSpreadsheet size={20} /></div><div><strong>{dataset.filename}</strong><span>Active dataset</span></div><span className="ready-tag">Loaded</span></div></> : <p className="muted">Your active dataset will appear here after upload.</p>}</div></section><section className="panel guide-card"><div className="tip-icon"><Sparkles size={18} /></div><h2>Make your dataset analysis-ready</h2><p>For the best results, make sure your file has clear column names, one header row, and consistent data types.</p><div className="guide-item"><Check size={14} /> Keep each row as one record</div><div className="guide-item"><Check size={14} /> Use descriptive column names</div><div className="guide-item"><Check size={14} /> Remove sensitive information</div></section></div></>;
}

function DatasetPage() {
  const { activeDatasetId } = useDataset();
  const [rows, setRows] = useState<unknown[][]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const limit = 50;

  useEffect(() => {
    if (!activeDatasetId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    const fetchPreview = async () => {
      try {
        const response = await getDatasetPreview(activeDatasetId, { limit, offset });
        if (cancelled) return;
        const previewRows = Array.isArray(response?.rows) ? response.rows : [];
        setRows(previewRows.map((row: unknown) => Array.isArray(row) ? row : Object.values(row as Record<string, unknown>)));
        setColumns(Array.isArray(response?.columns) ? response.columns : []);
        setTotalRows(Number(response?.total_rows) || 0);
      } catch (requestError) {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : 'Dataset preview could not be loaded.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchPreview();
    return () => { cancelled = true; };
  }, [activeDatasetId, offset]);

  if (!activeDatasetId) {
    return <EmptyDatasetState helper="Upload a dataset to preview rows and columns." />;
  }

  const filteredRows = rows.filter((row) => row.some((cell) => String(cell ?? '').toLowerCase().includes(search.toLowerCase())));
  const pageCount = Math.max(1, Math.ceil(totalRows / limit));
  const currentPage = Math.floor(offset / limit) + 1;

  return <><PageHeading title="Dataset preview" description="Review the rows and columns in your active dataset." action={<div className="button-row"><button className="secondary-button" onClick={() => downloadDataset(activeDatasetId, 'csv')}><Download size={15} /> Download CSV</button><button className="primary-button" onClick={() => downloadDataset(activeDatasetId, 'xlsx')}><Download size={15} /> Download Excel</button></div>} /><section className="panel table-panel"><div className="table-toolbar"><div className="table-search"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search this page..." /></div><span className="muted">{loading ? 'Loading...' : `${offset + 1}-${Math.min(offset + rows.length, totalRows)} of ${totalRows} rows`}</span></div>{error && <p role="alert">{error}</p>}<div className="table-scroll"><table><thead><tr>{columns.map((head) => <th key={head}>{head}</th>)}</tr></thead><tbody>{filteredRows.map((row, rowIndex) => <tr key={`${String(row[0] ?? rowIndex)}-${rowIndex}`}>{row.map((cell, index) => <td key={`${String(row[0] ?? rowIndex)}-${index}`} className={index === 3 ? 'revenue-cell' : ''}>{String(cell ?? '')}</td>)}</tr>)}</tbody></table></div><div className="pagination"><span>{filteredRows.length} rows on this page</span><div><button className="page-button" disabled={currentPage <= 1 || loading} onClick={() => setOffset(Math.max(0, offset - limit))}>‹</button>{Array.from({ length: Math.min(pageCount, 4) }, (_, index) => index + 1).map((number) => <button className={`page-button ${number === currentPage ? 'selected' : ''}`} key={number} onClick={() => setOffset((number - 1) * limit)}>{number}</button>)}<button className="page-button" disabled={currentPage >= pageCount || loading} onClick={() => setOffset(Math.min((pageCount - 1) * limit, offset + limit))}>›</button></div></div></section></>;
}

type StatisticsResponse = {
  numerical: Record<string, { count: number; mean: number | null; median: number | null; minimum: number | null; maximum: number | null; standard_deviation: number | null }>;
  categorical: Record<string, { unique_values: number; most_frequent_value: string | number | null; most_frequent_count: number }>;
};

function StatisticsPage({ datasetId }: { datasetId: string | null }) {
  const [statistics, setStatistics] = useState<StatisticsResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!datasetId) return;
    let cancelled = false;
    getStatistics(datasetId).then((result: StatisticsResponse) => {
      if (!cancelled) {
        setStatistics(result);
        setError('');
      }
    }).catch((requestError: Error) => {
      if (!cancelled) setError(requestError.message);
    });
    return () => { cancelled = true; };
  }, [datasetId]);

  if (!datasetId) return <EmptyDatasetState helper="Upload a dataset to view its statistics." />;
  if (error) return <><PageHeading title="Statistical analysis" description="Get detailed statistical insights about your dataset." /><section className="panel"><p role="alert">{error}</p></section></>;

  const format = (value: number | null | undefined) => value == null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 3 });
  const numericalRows = Object.entries(statistics?.numerical ?? {}).map(([column, values]) => [
    column, format(values.count), format(values.mean), format(values.median), format(values.minimum), format(values.maximum), format(values.standard_deviation),
  ]);
  const categoricalRows = Object.entries(statistics?.categorical ?? {}).map(([column, values]) => [
    column, format(values.unique_values), String(values.most_frequent_value ?? '—'), format(values.most_frequent_count),
  ]);

  return <><PageHeading title="Statistical analysis" description="Get detailed statistical insights about your dataset." /><div className="stats-layout"><section className="panel"><PanelTitle title="Numerical statistics" /><DataTable headers={['Column', 'Count', 'Mean', 'Median', 'Min', 'Max', 'Std dev']} rows={numericalRows} /></section><section className="panel"><PanelTitle title="Categorical statistics" /><DataTable headers={['Column', 'Unique values', 'Most common', 'Frequency']} rows={categoricalRows} /></section></div></>;
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) { return <div className="compact-table-scroll"><table className="compact-table"><thead><tr>{headers.map((head) => <th key={head}>{head}</th>)}</tr></thead><tbody>{rows.map((row, idx) => <tr key={`${row[0] || idx}-${idx}`}>{row.map((cell, cellIndex) => <td className={cellIndex === 0 ? 'strong-cell' : ''} key={`${cell}-${cellIndex}`}>{cell}</td>)}</tr>)}</tbody></table></div>; }

type HealthReport = {
  overall_score: number;
  completeness: number;
  consistency: number;
  validity: number;
  missing_percentage: number;
  duplicate_percentage: number;
  outlier_percentage: number;
};

function HealthPage({ datasetId }: { datasetId: string | null }) {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!datasetId) return;
    let cancelled = false;
    getHealth(datasetId).then((result: HealthReport) => {
      if (!cancelled) {
        setReport(result);
        setError('');
      }
    }).catch((requestError: Error) => {
      if (!cancelled) setError(requestError.message);
    });
    return () => { cancelled = true; };
  }, [datasetId]);

  if (!datasetId) return <EmptyDatasetState helper="Upload a dataset to check its data health." />;
  if (error) return <><PageHeading title="Data health" description="Understand the quality and reliability of your dataset." /><section className="panel"><p role="alert">{error}</p></section></>;

  const metrics = report ? [
    { label: 'Completeness', value: report.completeness, color: 'green' },
    { label: 'Consistency', value: report.consistency, color: 'blue' },
    { label: 'Validity', value: report.validity, color: 'orange' },
  ] : [];
  const issues = report ? [
    { title: 'Missing values', detail: 'Share of all dataset cells', value: report.missing_percentage, color: 'orange' },
    { title: 'Duplicate rows', detail: 'Share of dataset rows', value: report.duplicate_percentage, color: 'red' },
    { title: 'Numerical outliers', detail: 'Share of non-missing numerical values', value: report.outlier_percentage, color: 'blue' },
  ] : [];

  return <><PageHeading title="Data health" description="Understand the quality and reliability of your dataset." /><div className="health-grid"><section className="panel health-score"><div className="score-ring"><div><strong>{report?.overall_score ?? '...'}</strong><span>/100</span></div></div><div><div className="eyebrow">DATA HEALTH SCORE</div><h2>{report ? 'Dataset quality' : 'Loading health report'}</h2><p>{report ? 'Scores are calculated from the current processed dataset.' : ' '}</p></div></section>{metrics.map(({ label, value, color }) => <div className="panel health-stat" key={label}><div className={`health-stat-icon ${color}`}><ShieldCheck size={17} /></div><span>{label}</span><strong>{value}%</strong><div className="health-progress"><i className={color} style={{ width: `${value}%` }} /></div><small>Backend score</small></div>)}</div><section className="panel issues-table"><PanelTitle title="Quality indicators" />{issues.map(({ title, detail, value, color }) => <div className="health-issue" key={title}><div className={`health-issue-icon ${color}`}><AlertCircle size={15} /></div><div><strong>{title}</strong><span>{detail}</span></div><b>{value}%</b></div>)}</section></>;
}

type HistoryEntry = { id: number; operation: string; column_name: string | null; rows_before: number; rows_after: number; details: string | null; timestamp: string };

function HistoryPage({ datasetId }: { datasetId: string | null }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!datasetId) return;
    let cancelled = false;
    getHistory(datasetId).then((result: HistoryEntry[]) => {
      if (!cancelled) {
        setEntries(result);
        setError('');
      }
    }).catch((requestError: Error) => {
      if (!cancelled) setError(requestError.message);
    });
    return () => { cancelled = true; };
  }, [datasetId]);

  const exportHistory = () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `dataset-history-${datasetId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (!datasetId) return <EmptyDatasetState helper="Upload a dataset to view its processing history." />;
  return <><PageHeading title="Processing history" description="Track all operations performed on your dataset." action={<button className="secondary-button" onClick={exportHistory} disabled={!entries.length}><Download size={15} /> Export history</button>} /><section className="panel history-panel">{error && <p role="alert">{error}</p>}{!error && !entries.length && <p>No processing operations have been recorded yet.</p>}{entries.map((entry) => <div className="history-row" key={entry.id}><time>{new Date(entry.timestamp).toLocaleString()}</time><div className="timeline-icon blue"><CheckCircle2 size={15} /></div><div><strong>{entry.operation.replace(/_/g, ' ')}</strong><span>{entry.details || [entry.column_name, `${entry.rows_before} to ${entry.rows_after} rows`].filter(Boolean).join(' · ')}</span></div><span className="success-tag"><Check size={11} /> Success</span></div>)}</section></>;
}

function UploadModal({ onClose, onUploadFile }: { onClose: () => void; onUploadFile: (file: File) => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const onFileSelected = async (file?: File | null) => {
    if (!file) return;

    setUploading(true);
    try {
      await onUploadFile(file);
    } catch (error: unknown) {
      window.alert(error instanceof Error ? error.message : 'Unable to upload dataset.');
    } finally {
      setUploading(false);
      onClose();
    }
  };

  return <div className="modal-backdrop" onClick={onClose}><div className="modal" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><div className="eyebrow">NEW DATASET</div><h2>Upload a dataset</h2></div><button className="icon-button" onClick={onClose} aria-label="Close upload dialog"><X size={18} /></button></div><input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={(event) => { void onFileSelected(event.target.files?.[0]); }} /><div className={`modal-drop ${dragging ? 'drag-active' : ''}`} onClick={() => inputRef.current?.click()} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void onFileSelected(event.dataTransfer.files[0]); }}><UploadCloud size={26} /><strong>Drop your file here</strong><span>CSV, XLSX, or XLS up to 50 MB</span><button type="button" className="secondary-button" disabled={uploading}>{uploading ? 'Uploading...' : 'Browse files'}</button></div><div className="modal-footer"><button className="text-button" onClick={onClose}>Cancel</button><button className="primary-button" onClick={() => inputRef.current?.click()} disabled={uploading}>{uploading ? 'Uploading...' : 'Upload dataset'} <ArrowUpRight size={14} /></button></div></div></div>;
}

export default App;
