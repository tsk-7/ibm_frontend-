import api, { getApiErrorMessage } from './api';

export const getHealth = async (datasetId) => {
  try {
    const response = await api.get(`/datasets/${datasetId}/health`);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const getOutliers = async (datasetId) => {
  try {
    const response = await api.get(`/datasets/${datasetId}/outliers`);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};
