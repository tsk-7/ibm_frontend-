import api, { getApiErrorMessage } from './api';

export const uploadDataset = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await api.post('/datasets/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const getDatasets = async () => {
  try {
    const response = await api.get('/datasets');
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const getDataset = async (datasetId) => {
  try {
    const response = await api.get(`/datasets/${datasetId}`);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const getDatasetPreview = async (datasetId, params = {}) => {
  try {
    const response = await api.get(`/datasets/${datasetId}/preview`, { params });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const getDatasetProfile = async (datasetId) => {
  try {
    const response = await api.get(`/datasets/${datasetId}/profile`);
    const profile = response.data;
    const columnProfiles = profile?.columns || profile?.column_profiles;
    if (!profile || !Array.isArray(columnProfiles)) {
      throw new Error('The dataset profile response is missing column metadata.');
    }

    const general = profile.general || {};
    const totalRows = Number(general.row_count ?? profile.total_rows);
    const totalColumns = Number(general.column_count ?? profile.total_columns);
    const missingTotal = Number(general.missing_cell_count ?? profile.missing_values?.total);
    const duplicateRows = Number(general.duplicate_row_count ?? profile.duplicate_rows);
    const byColumn = Object.fromEntries(columnProfiles.map((column) => [
      column.name,
      Number.isFinite(Number(column.null_count ?? column.missing)) ? Number(column.null_count ?? column.missing) : null,
    ]));
    const dataTypes = Object.fromEntries(columnProfiles.map((column) => [column.name, column.dtype]));
    const uniqueValues = Object.fromEntries(columnProfiles.map((column) => [
      column.name,
      Number.isFinite(Number(column.unique_count)) ? Number(column.unique_count) : null,
    ]));

    if (![totalRows, totalColumns, missingTotal, duplicateRows].every(Number.isFinite)) {
      throw new Error('The dataset profile response is missing dataset-level metrics.');
    }

    return {
      ...profile,
      columns: columnProfiles,
      total_rows: totalRows,
      total_columns: totalColumns,
      numerical_columns: Array.isArray(profile.numerical_columns) ? profile.numerical_columns : [],
      categorical_columns: Array.isArray(profile.categorical_columns) ? profile.categorical_columns : [],
      datetime_columns: Array.isArray(profile.datetime_columns) ? profile.datetime_columns : [],
      missing_values: { by_column: byColumn, total: missingTotal },
      duplicate_rows: duplicateRows,
      unique_values: uniqueValues,
      data_types: dataTypes,
      column_profiles: columnProfiles,
    };
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const downloadDataset = (datasetId, format = 'csv') => {
  const url = `${api.defaults.baseURL}/datasets/${encodeURIComponent(datasetId)}/download?format=${format}`;
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.rel = 'noopener noreferrer';
  anchor.download = `${datasetId}.${format}`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
};
