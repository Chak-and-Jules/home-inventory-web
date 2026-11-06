import axios from 'axios';
import { getFirebaseAuth, getFirebaseIdentity, signOutFirebase } from './firebase';
import {
  InventoryPrediction,
  IgnorePredictionRequest,
  ApplyPredictionRequest,
  MessageResponse,
} from '../types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

export const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use(async (config) => {
  const { uid, token } = await getFirebaseIdentity();
  config.firebaseUid = uid;
  config.headers.Authorization = `Bearer ${token}`;

  if (typeof window !== 'undefined') {
    const homeId = localStorage.getItem('homeId');
    if (homeId) {
      const sanitizedHomeId = homeId.replace(/[\r\n]/g, '');
      config.headers['X-Home-Id'] = sanitizedHomeId;
    }
  }

  return config;
});

declare module 'axios' {
  interface InternalAxiosRequestConfig {
    firebaseUid?: string;
  }
}

api.interceptors.response.use((response) => response, async (error) => {
  // Revoked/disabled/deleted users cannot recover by retrying an API mutation.
  if (error.response?.status === 401 && error.config?.firebaseUid === getFirebaseAuth().currentUser?.uid) {
    await signOutFirebase();
  }
  return Promise.reject(error);
});

// Generic types
export type PaginatedResponse<T> = {
  data: T[];
  total: number;
};

// Prediction API helper functions
export const getPredictions = async (options?: { headers?: Record<string, string> }) => {
  const res = await api.get<InventoryPrediction[]>('/homes/predictions', options);
  return res.data;
};

export const ignorePrediction = async (
  payload: IgnorePredictionRequest,
  options?: { headers?: Record<string, string> }
) => {
  const res = await api.put<MessageResponse>('/homes/predictions/ignore', payload, options);
  return res.data;
};

export const applyPrediction = async (
  payload: ApplyPredictionRequest,
  options?: { headers?: Record<string, string> }
) => {
  const res = await api.put<MessageResponse>('/homes/predictions/apply', payload, options);
  return res.data;
};
