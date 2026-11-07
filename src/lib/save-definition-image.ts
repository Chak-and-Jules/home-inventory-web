import { isAxiosError } from 'axios';
import { deleteImage, isHomeImagePath, uploadImage } from './image-storage';
import { resizeImage } from './imageUtils';

export class ImageRollbackError extends Error {
  constructor(cause: unknown) {
    super('Saving failed and the new image could not be removed', { cause });
  }
}

export function imageSaveErrorKey(error: unknown): string {
  if (error instanceof ImageRollbackError) return 'ui.imageRollbackFailed';
  if (isAxiosError(error) && error.response?.status === 403) return 'ui.imageAccessDenied';
  if (isAxiosError(error) && error.response?.status === 503 && error.response.headers['retry-after']) return 'ui.imageUploadBusy';
  return 'ui.imageSaveFailed';
}

export async function cleanupImage(path: string | null | undefined, homeId: string): Promise<boolean> {
  // Legacy Supabase keys/URLs are not migrated and must never be sent to GCS.
  if (!path || !isHomeImagePath(path, homeId)) return false;
  try {
    await deleteImage(path, homeId);
    return false;
  } catch {
    return true;
  }
}

export async function saveDefinitionImage({ homeId, file, imagePath, previousPath, save }: {
  homeId: string;
  file?: File | null;
  imagePath?: string;
  previousPath?: string | null;
  save: (path: string) => Promise<unknown>;
}): Promise<{ cleanupFailed: boolean }> {
  let uploadedPath: string | undefined;
  if (file) uploadedPath = await uploadImage(await resizeImage(file), file.name, homeId);
  const nextPath = uploadedPath ?? imagePath ?? '';
  try {
    await save(nextPath);
  } catch (error) {
    if (uploadedPath && await cleanupImage(uploadedPath, homeId)) throw new ImageRollbackError(error);
    throw error;
  }
  // Only delete the old object after the SQL reference has been replaced/cleared.
  const cleanupFailed = previousPath !== nextPath && await cleanupImage(previousPath, homeId);
  return { cleanupFailed };
}
