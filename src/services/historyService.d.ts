export interface HistoryEntry {
  id: number;
  operation: string;
  column_name: string | null;
  rows_before: number;
  rows_after: number;
  details: string | null;
  timestamp: string;
}

export function getHistory(datasetId: string): Promise<HistoryEntry[]>;
