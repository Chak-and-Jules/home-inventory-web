import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { api } from './api';
import { getSignedImages, uploadImage, deleteImage } from './image-storage';

vi.mock('./firebase', () => ({
  getFirebaseIdentity: vi.fn(async () => ({ uid: 'firebase-user', token: 'firebase-token' })),
  getFirebaseAuth: () => ({ currentUser: { uid: 'firebase-user' } }),
  signOutFirebase: vi.fn(),
}));
export const home = '00000000-0000-4000-8000-000000000001';
const otherHome = '00000000-0000-4000-8000-000000000002';
const path = (n: number) => `${home}/00000000-0000-4000-8000-${String(n).padStart(12, '0')}.jpg`;
const image = (key: string) => ({ path: key, url: `https://storage.googleapis.com/private/${key}?signature=secret`, expires_at: new Date(Date.now() + 900_000).toISOString() });
let mock: MockAdapter;
beforeEach(() => { mock = new MockAdapter(api); localStorage.setItem('homeId', otherHome); });
afterEach(() => { mock.restore(); localStorage.clear(); });

describe('private image API', () => {
  it('uploads exactly one multipart file with Firebase auth and the explicit home', async () => {
    const blob = new Blob(['jpeg'], { type: 'image/jpeg' });
    mock.onPost('/images').reply(config => {
      expect(config.headers?.Authorization).toBe('Bearer firebase-token');
      expect(config.headers?.['X-Home-Id']).toBe(home);
      expect(config.data).toBeInstanceOf(FormData);
      const form = config.data as FormData;
      expect([...form.keys()]).toEqual(['file']);
      expect((form.get('file') as File).name).toBe('camera.png');
      expect((form.get('file') as File).type).toBe('image/jpeg');
      return [201, { path: path(1) }];
    });
    await expect(uploadImage(blob, 'camera.png', home)).resolves.toBe(path(1));
  });
  it('deduplicates and splits signed URL requests into batches of at most 100', async () => {
    const keys = Array.from({ length: 205 }, (_, i) => path(i + 1));
    mock.onPost('/images/signed-urls').reply(config => {
      expect(config.headers?.Authorization).toBe('Bearer firebase-token');
      expect(config.headers?.['X-Home-Id']).toBe(home);
      const paths = JSON.parse(config.data).paths as string[];
      expect(paths.length).toBeLessThanOrEqual(100);
      return [200, { images: paths.map(image) }];
    });
    expect(await getSignedImages([...keys, keys[0]], home)).toHaveLength(205);
    expect(mock.history.post.map(c => JSON.parse(c.data).paths.length)).toEqual([100, 100, 5]);
  });
  it('isolates a missing object without hiding existing images', async () => {
    mock.onPost('/images/signed-urls').reply(config => {
      const keys = JSON.parse(config.data).paths as string[];
      return keys.includes(path(2)) ? [404, { error: 'missing' }] : [200, { images: keys.map(image) }];
    });
    expect((await getSignedImages([path(1), path(2), path(3)], home)).map(i => i.path)).toEqual([path(1), path(3)]);
  });
  it.each([403, 502, 503])('propagates %s without splitting or retrying', async status => {
    mock.onPost('/images/signed-urls').reply(status, { error: 'unavailable' });
    await expect(getSignedImages([path(1), path(2)], home)).rejects.toThrow();
    expect(mock.history.post).toHaveLength(1);
  });
  it.each([`${otherHome}/00000000-0000-4000-8000-000000000001.jpg`, 'https://example.test/a.jpg', '../image.jpg'])('rejects invalid/cross-home paths before sending %s', async key => {
    await expect(getSignedImages([key], home)).rejects.toThrow();
    await expect(deleteImage(key, home)).rejects.toThrow();
    expect(mock.history).toHaveLength(0);
  });
  it('accepts idempotent deletion and passes the unmodified object key as a query parameter', async () => {
    mock.onDelete('/images').reply(config => {
      expect(config.params).toEqual({ path: path(1) });
      expect(config.headers?.['X-Home-Id']).toBe(home);
      expect(config.headers?.Authorization).toBe('Bearer firebase-token');
      return [204];
    });
    await expect(deleteImage(path(1), home)).resolves.toBeUndefined();
  });
  it('does not retry viewer upload/delete denials or a busy upload', async () => {
    mock.onPost('/images').reply(403);
    mock.onDelete('/images').reply(403);
    await expect(uploadImage(new Blob(), 'a.jpg', home)).rejects.toThrow();
    await expect(deleteImage(path(1), home)).rejects.toThrow();
    mock.onPost('/images').reply(503, {}, { 'Retry-After': '1' });
    await expect(uploadImage(new Blob(), 'a.jpg', home)).rejects.toMatchObject({ response: { status: 503 } });
    expect(mock.history).toHaveLength(3);
  });
  it('forwards cancellation and never requests an empty batch', async () => {
    expect(await getSignedImages([], home)).toEqual([]);
    const controller = new AbortController(); controller.abort();
    await expect(getSignedImages([path(1)], home, controller.signal)).rejects.toThrow();
    expect(mock.history).toHaveLength(0);
  });
});
