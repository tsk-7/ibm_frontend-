export interface ChartRecommendation {
  chart_type: 'bar' | 'line' | 'scatter' | 'histogram' | 'pie' | 'box_plot' | 'box';
  x_column: string;
  y_column: string | null;
  reason: string;
}

export function getVisualizationRecommendations(datasetId: string): Promise<{ recommendations: ChartRecommendation[] }>;
export interface VisualizationPreview {
  title?: string;
  labels?: unknown[];
  values?: number[];
  x?: number[];
  y?: number[];
  bins?: number[];
  counts?: number[];
  groups?: Array<{ label: string; base: number; box: number; error: [number, number]; median: number }>;
  metadata?: {
    rows_used?: number;
    sample_size?: number;
    truncated?: boolean;
    points_returned?: number;
    non_missing_values?: number;
    rows_in_dataset?: number;
  };
}

export function getVisualizationPreview(datasetId: string, payload: {
  chart_type: 'bar' | 'line' | 'pie' | 'scatter' | 'box' | 'histogram';
  column_a: string;
  column_b?: string;
  aggregation: 'none' | 'count' | 'sum' | 'mean' | 'average' | 'median' | 'mode' | 'std';
  bins?: number;
  limit?: number;
}): Promise<VisualizationPreview>;
