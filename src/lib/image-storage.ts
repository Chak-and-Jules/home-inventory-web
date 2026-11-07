import { isAxiosError } from 'axios';
import { api } from './api';
import type { SignedImage } from '@/types/image';

const imagePathPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png)$/;

export function isHomeImagePath(path: string, homeId: string): boolean {
  return imagePathPattern.test(path) && path.split('/')[0] === homeId;
}

function headers(homeId: string) {
  if (!homeId) throw new Error('An image request requires a home');
  return { 'X-Home-Id': homeId };
}

export async function uploadImage(blob: Blob, fileName: string, homeId: string): Promise<string> {
  const form = new FormData();
  form.append('file', blob, fileName);
  // Axios/browser supplies Content-Type with the multipart boundary.
  const { data } = await api.post<{ path: string }>('/images', form, { headers: headers(homeId) });
  if (!isHomeImagePath(data.path, homeId)) throw new Error('Invalid image upload response');
  return data.path;
}

export async function deleteImage(path: string, homeId: string): Promise<void> {
  if (!isHomeImagePath(path, homeId)) throw new Error('Invalid image path for this home');
  await api.delete('/images', { headers: headers(homeId), params: { path } });
}

export async function getSignedImages(paths: string[], homeId: string, signal?: AbortSignal): Promise<SignedImage[]> {
  const requestHeaders = headers(homeId);
  const unique = [...new Set(paths)];
  if (unique.some(path => !isHomeImagePath(path, homeId))) throw new Error('Invalid image path for this home');

  async function batch(keys: string[]): Promise<SignedImage[]> {
    try {
      const { data } = await api.post<{ images: SignedImage[] }>('/images/signed-urls', { paths: keys }, {
        headers: requestHeaders, signal,
      });
      return data.images.filter(image => keys.includes(image.path) && image.url && Date.parse(image.expires_at) > Date.now());
    } catch (error) {
      // Isolate missing objects from the all-or-nothing batch. Never split or
      // retry permission/provider errors, which apply to the whole request.
      if (!isAxiosError(error) || error.response?.status !== 404) throw error;
      if (keys.length === 1) return [];
      const middle = Math.ceil(keys.length / 2);
      return [...await batch(keys.slice(0, middle)), ...await batch(keys.slice(middle))];
    }
  }

  const images: SignedImage[] = [];
  for (let i = 0; i < unique.length; i += 100) images.push(...await batch(unique.slice(i, i + 100)));
  return images;
}
