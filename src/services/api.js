import axios from 'axios';

const configuredApiUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';
const API_BASE_URL = `${configuredApiUrl.replace(/\/+$/, '').replace(/\/api$/, '')}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error?.response?.data?.detail || error?.response?.data?.message || error.message;
    const normalized = new Error(message || 'Request failed');
    normalized.status = error?.response?.status;
    return Promise.reject(normalized);
  }
);

export const getApiErrorMessage = (error) => {
  if (!error) return 'Unable to connect to DataInsight backend.';
  if (error.status === 404) return 'Dataset is no longer available.';
  if (error.status === 400 || error.status === 422) return error.message || 'The request could not be processed.';
  if (error.status === 500) return 'Unable to connect to DataInsight backend.';
  if (error.message && error.message.includes('Network Error')) return 'Unable to connect to DataInsight backend.';
  if (error.message && error.message.includes('not found')) return 'Dataset is no longer available.';
  return error.message || 'Unable to connect to DataInsight backend.';
};

export default api;
