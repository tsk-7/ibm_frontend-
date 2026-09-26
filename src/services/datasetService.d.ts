import type { Dataset } from '../context/DatasetContext';

export interface DatasetPreview {
  columns: string[];
  rows: Array<Record<string, unknown> | unknown[]>;
  total_rows: number;
}

export interface DatasetProfile {
  dataset_id: string;
  total_rows: number;
  total_columns: number;
  numerical_columns: string[];
  categorical_columns: string[];
  datetime_columns: string[];
  missing_values: { by_column: Record<string, number>; total: number };
  duplicate_rows: number;
  unique_values: Record<string, number>;
  memory_usage_bytes: number;
  data_types: Record<string, string>;
}

export function uploadDataset(file: File): Promise<{ dataset_id: string; filename: string; rows: number; columns: number; message: string }>;
export function getDatasets(): Promise<Dataset[]>;
export function getDataset(datasetId: string): Promise<Dataset>;
export function getDatasetPreview(datasetId: string, params?: { limit?: number; offset?: number }): Promise<DatasetPreview>;
export function getDatasetProfile(datasetId: string): Promise<DatasetProfile>;
export function downloadDataset(datasetId: string, format?: 'csv' | 'xlsx'): void;
