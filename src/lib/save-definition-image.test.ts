import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveDefinitionImage, ImageRollbackError, cleanupImage, imageSaveErrorKey } from './save-definition-image';
import { uploadImage, deleteImage } from './image-storage';
import { resizeImage } from './imageUtils';
vi.mock('./image-storage', async importOriginal => ({
  ...await importOriginal<typeof import('./image-storage')>(), uploadImage: vi.fn(), deleteImage: vi.fn(),
}));
vi.mock('./imageUtils', () => ({ resizeImage: vi.fn() }));
const homeId = '00000000-0000-4000-8000-000000000001';
const oldPath = `${homeId}/00000000-0000-4000-8000-000000000002.jpg`;
const newPath = `${homeId}/00000000-0000-4000-8000-000000000003.jpg`;
const file = new File(['original'], 'original.png', { type: 'image/png' });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(uploadImage).mockResolvedValue(newPath);
  vi.mocked(deleteImage).mockResolvedValue(undefined);
  vi.mocked(resizeImage).mockResolvedValue(new Blob(['resized'], { type: 'image/jpeg' }));
});
describe('definition image lifecycle', () => {
  it('saves only the generated key before deleting the previous object', async () => {
    const save = vi.fn(async (path: string) => {
      expect(path).toBe(newPath);
      expect(deleteImage).not.toHaveBeenCalled();
    });
    await expect(saveDefinitionImage({ homeId, file, previousPath: oldPath, save })).resolves.toEqual({ cleanupFailed: false });
    expect(resizeImage).toHaveBeenCalledWith(file);
    expect(deleteImage).toHaveBeenCalledExactlyOnceWith(oldPath, homeId);
  });
  it('clears the SQL reference before deleting a removed image', async () => {
    const save = vi.fn(async (path: string) => { expect(path).toBe(''); expect(deleteImage).not.toHaveBeenCalled(); });
    await saveDefinitionImage({ homeId, imagePath: '', previousPath: oldPath, save });
    expect(uploadImage).not.toHaveBeenCalled();
    expect(deleteImage).toHaveBeenCalledExactlyOnceWith(oldPath, homeId);
  });
  it('preserves unchanged images without upload or deletion', async () => {
    await saveDefinitionImage({ homeId, imagePath: oldPath, previousPath: oldPath, save: vi.fn(async () => {}) });
    expect(uploadImage).not.toHaveBeenCalled(); expect(deleteImage).not.toHaveBeenCalled();
  });
  it.each([undefined, oldPath])('cleans up a new upload when creation/update fails (previous=%s)', async previousPath => {
    const error = new Error('save failed');
    await expect(saveDefinitionImage({ homeId, file, previousPath, save: vi.fn().mockRejectedValue(error) })).rejects.toBe(error);
    expect(deleteImage).toHaveBeenCalledExactlyOnceWith(newPath, homeId);
  });
  it('does not save when upload fails', async () => {
    vi.mocked(uploadImage).mockRejectedValue(new Error('denied'));
    const save = vi.fn();
    await expect(saveDefinitionImage({ homeId, file, previousPath: oldPath, save })).rejects.toThrow('denied');
    expect(save).not.toHaveBeenCalled(); expect(deleteImage).not.toHaveBeenCalled();
  });
  it('reports old-image cleanup failure while preserving a successful save', async () => {
    vi.mocked(deleteImage).mockRejectedValue(new Error('provider failure'));
    const save = vi.fn(async () => {});
    expect(await saveDefinitionImage({ homeId, file, previousPath: oldPath, save })).toEqual({ cleanupFailed: true });
    expect(save).toHaveBeenCalledOnce();
  });
  it('reports failed rollback separately from a successful cleanup', async () => {
    vi.mocked(deleteImage).mockRejectedValue(new Error('provider failure'));
    const error = await saveDefinitionImage({ homeId, file, save: vi.fn().mockRejectedValue(new Error('SQL failure')) }).catch(e => e);
    expect(error).toBeInstanceOf(ImageRollbackError);
    expect(imageSaveErrorKey(error)).toBe('ui.imageRollbackFailed');
  });
  it('never deletes unmigrated Supabase paths or another home\'s objects', async () => {
    await cleanupImage('legacy-home/image.jpg', homeId);
    await cleanupImage(`https://example.test/${oldPath}`, homeId);
    await cleanupImage(oldPath, 'another-home');
    expect(deleteImage).not.toHaveBeenCalled();
  });
});
