import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api, getPredictions, ignorePrediction, applyPrediction } from './api';
import { getFirebaseIdentity, signOutFirebase } from './firebase';
import { PUBLIC_RUNTIME_CONFIG_ID } from './runtime-config';

import MockAdapter from 'axios-mock-adapter';

vi.mock('./firebase', () => ({
  getFirebaseIdentity: vi.fn(),
  getFirebaseAuth: () => ({ currentUser: { uid: 'firebase-uid' } }),
  signOutFirebase: vi.fn(async () => {}),
}));

describe('api interceptor', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementation
    vi.mocked(getFirebaseIdentity).mockResolvedValue({ uid: 'firebase-uid', token: 'current-id-token' });

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

  it('should set Authorization header from the Firebase SDK', async () => {
    vi.mocked(getFirebaseIdentity).mockResolvedValue({ uid: 'firebase-uid', token: 'current-id-token' });

    mock.onGet('/dummy').reply((config) => {
      expect(config.headers?.['Authorization']).toBe('Bearer current-id-token');
      return [200, {}];
    });

    await api.get('/dummy');
  });
  it('uses the runtime backend URL even when the Axios instance was imported earlier', async () => {
    const element = document.createElement('script');
    element.type = 'application/json';
    element.id = PUBLIC_RUNTIME_CONFIG_ID;
    element.textContent = JSON.stringify({ apiUrl: 'https://runtime.example.test/api/v1' });
    document.head.append(element);
    try {
      mock.onGet('/dummy').reply((config) => {
        expect(config.baseURL).toBe('https://runtime.example.test/api/v1');
        return [200, {}];
      });
      await api.get('/dummy');
    } finally { element.remove(); }
  });
  it('retrieves the current token on every request and overrides caller credentials', async () => {
    vi.mocked(getFirebaseIdentity).mockResolvedValueOnce({ uid: 'firebase-uid', token: 'first' })
      .mockResolvedValueOnce({ uid: 'firebase-uid', token: 'refreshed' });
    mock.onGet('/dummy').reply(200, {});
    await api.get('/dummy', { headers: { Authorization: 'Bearer old-supabase-token' } });
    await api.get('/dummy');
    expect(mock.history.get.map(c => c.headers?.Authorization)).toEqual(['Bearer first', 'Bearer refreshed']);
  });
  it('does not send a request when SDK token retrieval fails', async () => {
    vi.mocked(getFirebaseIdentity).mockRejectedValueOnce(new Error('expired'));
    mock.onPost('/dummy').reply(200);
    await expect(api.post('/dummy')).rejects.toThrow('expired');
    expect(mock.history.post).toHaveLength(0);
  });
  it('signs out on a backend 401 without replaying a mutation', async () => {
    mock.onPost('/dummy').reply(401);
    await expect(api.post('/dummy')).rejects.toThrow();
    expect(signOutFirebase).toHaveBeenCalledOnce();
    expect(mock.history.post).toHaveLength(1);
  });
  it('preserves a session on a backend service failure', async () => {
    mock.onPost('/dummy').reply(500);
    await expect(api.post('/dummy')).rejects.toThrow();
    expect(signOutFirebase).not.toHaveBeenCalled();
  });
  it('does not sign out a different user when an old request returns 401', async () => {
    vi.mocked(getFirebaseIdentity).mockResolvedValueOnce({ uid: 'previous-user', token: 'old-id-token' });
    mock.onGet('/dummy').reply(401);
    await expect(api.get('/dummy')).rejects.toThrow();
    expect(signOutFirebase).not.toHaveBeenCalled();
  });

});

describe('predictions api endpoints', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getFirebaseIdentity).mockResolvedValue({ uid: 'firebase-uid', token: 'current-id-token' });

    localStorage.clear();
    localStorage.setItem('homeId', 'test-home-uuid');

    mock = new MockAdapter(api);
  });

  it('getPredictions calls GET /homes/predictions with X-Home-Id header', async () => {
    const mockPredictions = [
      {
        prediction_id: 'pred-1',
        item_definition_details: { id: 'item-1', name: 'Rice', picture_url: '' },
        predicted_amount: 3000,
        prediction_date: '2030-01-01T00:00:00Z',
        base_size_unit_id: 'g',
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
    const payload = { prediction_id: 'pred-1', applied_amount: 5, quantity_unit_id: 'unit-1' };
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
