import type { Dispatch, ReactElement, ReactNode, SetStateAction } from 'react';

export interface Dataset {
  dataset_id: string;
  filename: string;
  rows: number;
  columns: number;
  uploaded_at: string;
  column_names: string[];
  data_types: Record<string, string>;
  processing_status: string;
}

export interface DatasetContextValue {
  activeDatasetId: string;
  dataset: Dataset | null;
  loading: boolean;
  error: string;
  setActiveDatasetId: (datasetId: string) => void;
  setDataset: Dispatch<SetStateAction<Dataset | null>>;
  refreshDataset: () => Promise<void>;
  loadDataset: (datasetId: string) => Promise<void>;
}

export function DatasetProvider(props: { children: ReactNode }): ReactElement;
export function useDataset(): DatasetContextValue;
