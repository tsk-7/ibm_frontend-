import api, { getApiErrorMessage } from './api';

export const getStatistics = async (datasetId) => {
  try {
    const response = await api.get(`/datasets/${datasetId}/statistics`);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};
