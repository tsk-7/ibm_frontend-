export interface ChartRecommendation {
  chart_type: 'bar' | 'line' | 'scatter' | 'histogram' | 'pie' | 'box_plot';
  x_column: string;
  y_column: string | null;
  reason: string;
}

export function getVisualizationRecommendations(datasetId: string): Promise<{ recommendations: ChartRecommendation[] }>;
