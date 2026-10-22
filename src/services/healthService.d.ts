export interface HealthReport {
  overall_score: number;
  completeness: number;
  consistency: number;
  validity: number;
  duplicate_percentage: number;
  missing_percentage: number;
  outlier_percentage: number;
  scoring?: Record<string, string>;
  column_health?: Array<{
    column: string;
    status: string;
    missing: number;
    missing_percentage: number;
    duplicates: number | null;
    outliers: number | null;
    dtype_concerns: string | null;
    reasons: string[];
  }>;
}

export function getHealth(datasetId: string): Promise<HealthReport>;
export function getOutliers(datasetId: string): Promise<Record<string, unknown>>;
