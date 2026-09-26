import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getDataset } from '../services/datasetService';

const DatasetContext = createContext(null);

export function DatasetProvider({ children }) {
  const [activeDatasetId, setActiveDatasetId] = useState(() => localStorage.getItem('activeDatasetId') || '');
  const [dataset, setDataset] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (activeDatasetId) {
      localStorage.setItem('activeDatasetId', activeDatasetId);
    } else {
      localStorage.removeItem('activeDatasetId');
    }
  }, [activeDatasetId]);

  const loadDataset = async (datasetId) => {
    if (!datasetId) {
      setDataset(null);
      setError('');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await getDataset(datasetId);
      setDataset(result);
      setActiveDatasetId(datasetId);
    } catch (err) {
      setError(err.message || 'Dataset is no longer available.');
      setDataset(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeDatasetId) {
      loadDataset(activeDatasetId);
    }
  }, []);

  const value = useMemo(() => ({
    activeDatasetId,
    dataset,
    loading,
    error,
    setActiveDatasetId: (datasetId) => {
      setActiveDatasetId(datasetId);
      if (datasetId) {
        localStorage.setItem('activeDatasetId', datasetId);
      }
    },
    setDataset,
    refreshDataset: () => {
      if (activeDatasetId) {
        return loadDataset(activeDatasetId);
      }
      return Promise.resolve();
    },
    loadDataset,
  }), [activeDatasetId, dataset, loading, error]);

  return <DatasetContext.Provider value={value}>{children}</DatasetContext.Provider>;
}

export function useDataset() {
  const context = useContext(DatasetContext);
  if (!context) {
    throw new Error('useDataset must be used within DatasetProvider');
  }
  return context;
}
