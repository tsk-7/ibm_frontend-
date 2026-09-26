import api, { getApiErrorMessage } from './api';

export const processMissingValues = async (datasetId, payload) => {
  try {
    const response = await api.post(`/datasets/${datasetId}/preprocess/missing-values`, payload);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const processDuplicateRows = async (datasetId, payload = {}) => {
  try {
    const response = await api.post(`/datasets/${datasetId}/preprocess/duplicates`, payload);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const processDtype = async (datasetId, payload) => {
  try {
    const response = await api.post(`/datasets/${datasetId}/preprocess/dtype`, payload);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const renameColumn = async (datasetId, payload) => {
  try {
    const response = await api.post(`/datasets/${datasetId}/columns/rename`, payload);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const deleteColumn = async (datasetId, columnName) => {
  try {
    const response = await api.delete(`/datasets/${datasetId}/columns/${encodeURIComponent(columnName)}`);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const createColumn = async (datasetId, payload) => {
  try {
    const response = await api.post(`/datasets/${datasetId}/columns/create`, payload);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};
