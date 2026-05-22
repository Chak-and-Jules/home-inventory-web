import axios from 'axios';
import { supabase } from './supabase';

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
      config.headers['X-Home-Id'] = homeId;
    }
  }

  return config;
});

// Generic types
export type PaginatedResponse<T> = {
  data: T[];
  total: number;
}
