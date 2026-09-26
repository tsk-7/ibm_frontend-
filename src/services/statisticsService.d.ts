export interface StatisticsResponse {
  numerical: Record<string, {
    count: number;
    mean: number | null;
    median: number | null;
    standard_deviation: number | null;
    minimum: number | null;
    maximum: number | null;
    q1: number | null;
    q3: number | null;
  }>;
  categorical: Record<string, {
    count: number;
    unique_values: number;
    most_frequent_value: string | number | null;
    most_frequent_count: number;
  }>;
}

export function getStatistics(datasetId: string): Promise<StatisticsResponse>;
