export function processMissingValues(datasetId: string, payload: { column?: string; method: string; value?: unknown }): Promise<Record<string, unknown>>;
export function processDuplicateRows(datasetId: string, payload?: { action?: 'detect' | 'remove' }): Promise<Record<string, unknown>>;
export function processDtype(datasetId: string, payload: { column: string; dtype: string }): Promise<Record<string, unknown>>;
export function renameColumn(datasetId: string, payload: { old_name: string; new_name: string }): Promise<Record<string, unknown>>;
export function deleteColumn(datasetId: string, columnName: string): Promise<Record<string, unknown>>;
export function createColumn(datasetId: string, payload: { name: string; operation: string }): Promise<Record<string, unknown>>;
