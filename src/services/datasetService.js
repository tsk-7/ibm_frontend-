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
    return response.data;
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
