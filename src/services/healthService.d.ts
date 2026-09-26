export interface HealthReport {
  overall_score: number;
  completeness: number;
  consistency: number;
  validity: number;
  duplicate_percentage: number;
  missing_percentage: number;
  outlier_percentage: number;
  scoring?: Record<string, string>;
}

export function getHealth(datasetId: string): Promise<HealthReport>;
export function getOutliers(datasetId: string): Promise<Record<string, unknown>>;
