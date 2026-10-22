export interface StatisticsResponse {
  numerical: Record<string, {
    count: number;
    missing: number;
    mean: number | null;
    median: number | null;
    standard_deviation: number | null;
    variance: number | null;
    minimum: number | null;
    maximum: number | null;
    q1: number | null;
    q3: number | null;
    iqr?: number | null;
    range?: number | null;
    outlier_count?: number;
    outlier_percentage?: number;
  }>;
  categorical: Record<string, {
    count: number;
    unique_values: number;
    most_frequent_value: string | number | null;
    most_frequent_count: number;
    top_values?: Array<{ value: unknown; count: number; percentage: number }>;
  }>;
}

export function getStatistics(datasetId: string): Promise<StatisticsResponse>;
