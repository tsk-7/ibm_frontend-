import api, { getApiErrorMessage } from './api';

export const getVisualizationRecommendations = async (datasetId) => {
  try {
    const response = await api.get(`/datasets/${datasetId}/visualization/recommendations`);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};
