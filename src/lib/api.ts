import axios from 'axios';
import { supabase } from './supabase';
import {
  InventoryPrediction,
  IgnorePredictionRequest,
  ApplyPredictionRequest,
  MessageResponse,
  Recipe,
  RecipeRequest,
  CookRecipeRequest,
  MealSuggestion,
} from '../types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

export const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }

  if (typeof window !== 'undefined') {
    const homeId = localStorage.getItem('homeId');
    if (homeId) {
      const sanitizedHomeId = homeId.replace(/[\r\n]/g, '');
      config.headers['X-Home-Id'] = sanitizedHomeId;
    }
  }

  return config;
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

// Recipe API helper functions
export const getRecipes = async (options?: { headers?: Record<string, string> }) => {
  const res = await api.get<Recipe[]>('/recipes', options);
  return res.data;
};

export const getRecipe = async (id: string, options?: { headers?: Record<string, string> }) => {
  const res = await api.get<Recipe>(`/recipes/${id}`, options);
  return res.data;
};

export const createRecipe = async (
  payload: RecipeRequest,
  options?: { headers?: Record<string, string> }
) => {
  const res = await api.post<Recipe>('/recipes', payload, options);
  return res.data;
};

export const updateRecipe = async (
  id: string,
  payload: RecipeRequest,
  options?: { headers?: Record<string, string> }
) => {
  const res = await api.put<MessageResponse>(`/recipes/${id}`, payload, options);
  return res.data;
};

export const deleteRecipe = async (id: string, options?: { headers?: Record<string, string> }) => {
  const res = await api.delete<MessageResponse>(`/recipes/${id}`, options);
  return res.data;
};

export const cookRecipe = async (
  id: string,
  payload?: CookRecipeRequest,
  options?: { headers?: Record<string, string> }
) => {
  const res = await api.post<MessageResponse>(`/recipes/${id}/cook`, payload, options);
  return res.data;
};

export const getMealSuggestions = async (options?: { headers?: Record<string, string> }) => {
  const res = await api.get<MealSuggestion[]>('/recipes/suggestions', options);
  return res.data;
};
