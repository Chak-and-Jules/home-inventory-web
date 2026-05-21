import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import { api } from './api';
import { supabase } from './supabase';
import { AxiosResponse } from 'axios';

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

describe('API Interceptor', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up a dummy adapter to intercept the request and return the config
    api.defaults.adapter = async (config) => {
      return {
        data: null,
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        request: {}
      } as unknown as AxiosResponse;
    };
  });

  it('should inject Authorization header if access token exists', async () => {
    const mockSession = { access_token: 'test-token' };
    (supabase.auth.getSession as Mock).mockResolvedValue({ data: { session: mockSession } });

    const response = await api.get('/test');

    expect(response.config.headers.Authorization).toBe('Bearer test-token');
    expect(supabase.auth.getSession).toHaveBeenCalledTimes(1);
  });

  it('should not inject Authorization header if access token does not exist', async () => {
    const mockSession = { access_token: null };
    (supabase.auth.getSession as Mock).mockResolvedValue({ data: { session: mockSession } });

    const response = await api.get('/test');

    expect(response.config.headers.Authorization).toBeUndefined();
    expect(supabase.auth.getSession).toHaveBeenCalledTimes(1);
  });

  it('should not inject Authorization header if session is null', async () => {
    (supabase.auth.getSession as Mock).mockResolvedValue({ data: { session: null } });

    const response = await api.get('/test');

    expect(response.config.headers.Authorization).toBeUndefined();
    expect(supabase.auth.getSession).toHaveBeenCalledTimes(1);
  });
});
