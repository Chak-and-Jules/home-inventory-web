/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api, getPredictions, ignorePrediction, applyPrediction } from './api';
import { supabase } from './supabase';

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
      expect(config.headers?.['X-Home-Id']).toBe('valid-home-idMalicious-Header: true');
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
      expect(config.headers?.['Authorization']).toBe('Bearer fake-token');
      return [200, {}];
    });

    await api.get('/dummy');
  });
});

describe('predictions api endpoints', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as any);

    localStorage.clear();
    localStorage.setItem('homeId', 'test-home-uuid');

    mock = new MockAdapter(api);
  });

  it('getPredictions calls GET /homes/predictions with X-Home-Id header', async () => {
    const mockPredictions = [
      {
        id: 'pred-1',
        home_id: 'test-home-uuid',
        item_definition_id: 'item-1',
        predicted_quantity: 3,
        status: 'pending',
      },
    ];

    mock.onGet('/homes/predictions').reply((config) => {
      expect(config.headers?.['X-Home-Id']).toBe('test-home-uuid');
      return [200, mockPredictions];
    });

    const result = await getPredictions();
    expect(result).toEqual(mockPredictions);
  });

  it('ignorePrediction calls PUT /homes/predictions/ignore with payload and X-Home-Id header', async () => {
    const payload = { prediction_id: 'pred-1' };
    const mockResponse = { message: 'Prediction ignored successfully' };

    mock.onPut('/homes/predictions/ignore', payload).reply((config) => {
      expect(config.headers?.['X-Home-Id']).toBe('test-home-uuid');
      expect(JSON.parse(config.data)).toEqual(payload);
      return [200, mockResponse];
    });

    const result = await ignorePrediction(payload);
    expect(result).toEqual(mockResponse);
  });

  it('applyPrediction calls PUT /homes/predictions/apply with payload and X-Home-Id header', async () => {
    const payload = { prediction_id: 'pred-1', applied_amount: 5 };
    const mockResponse = { message: 'Prediction applied successfully' };

    mock.onPut('/homes/predictions/apply', payload).reply((config) => {
      expect(config.headers?.['X-Home-Id']).toBe('test-home-uuid');
      expect(JSON.parse(config.data)).toEqual(payload);
      return [200, mockResponse];
    });

    const result = await applyPrediction(payload);
    expect(result).toEqual(mockResponse);
  });
});
