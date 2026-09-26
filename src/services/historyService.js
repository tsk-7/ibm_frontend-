import api, { getApiErrorMessage } from './api';

export const getHistory = async (datasetId) => {
  try {
    const response = await api.get(`/datasets/${datasetId}/history`);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};
