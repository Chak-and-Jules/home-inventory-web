import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from './api';
import { supabase } from './supabase';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

// Mock supabase
vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

describe('api interceptor', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementation
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as any);

    // Clear localStorage
    localStorage.clear();

    mock = new MockAdapter(api);
  });

  it('should strip CRLF characters from X-Home-Id header', async () => {
    // Set a malicious homeId with CRLF injection
    localStorage.setItem('homeId', 'valid-home-id\r\nMalicious-Header: true');

    // Setup mock response
    mock.onGet('/dummy').reply((config) => {
      // Assert that the headers are sanitized
      expect(config.headers['X-Home-Id']).toBe('valid-home-idMalicious-Header: true');
      return [200, {}];
    });

    // Make a dummy request to trigger the interceptor
    await api.get('/dummy');
  });

  it('should set Authorization header if session exists', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { access_token: 'fake-token' } },
      error: null,
    } as any);

    mock.onGet('/dummy').reply((config) => {
      expect(config.headers['Authorization']).toBe('Bearer fake-token');
      return [200, {}];
    });

    await api.get('/dummy');
  });
});
