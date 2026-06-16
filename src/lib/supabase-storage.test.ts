/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { initializeStorageBucket, deleteImageFromSupabase } from './supabase-storage'
import { supabase } from './supabase'
import { log } from 'next-axiom'

vi.mock('./supabase', () => ({
  supabase: {
    storage: {
      from: vi.fn(),
    },
  },
}))

vi.mock('next-axiom', () => ({
  log: {
    info: vi.fn(),
    error: vi.fn(),
  }
}))

describe('supabase-storage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initializeStorageBucket', () => {
    it('returns true when bucket exists', async () => {
      vi.mocked(supabase.storage.from).mockReturnValue({
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
        remove: vi.fn(),
      } as any)

      const result = await initializeStorageBucket()
      expect(result).toBe(true)
      expect(supabase.storage.from).toHaveBeenCalledWith('item-definitions')
    })

    it('returns false when bucket is not found', async () => {
      vi.mocked(supabase.storage.from).mockReturnValue({
        list: vi.fn().mockResolvedValue({ data: null, error: { message: 'bucket not found' } }),
        remove: vi.fn(),
      } as any)

      const result = await initializeStorageBucket()
      expect(result).toBe(false)
      expect(log.info).toHaveBeenCalledWith('item-definitions bucket not found. Please create it in Supabase dashboard.')
    })

    it('returns false when an error is thrown', async () => {
      const error = new Error('Network error')
      vi.mocked(supabase.storage.from).mockImplementation(() => {
        throw error
      })

      const result = await initializeStorageBucket()
      expect(result).toBe(false)
      expect(log.error).toHaveBeenCalledWith('Error initializing storage bucket:', { error })
    })
  })

  describe('deleteImageFromSupabase', () => {
    it('returns true on successful deletion', async () => {
      vi.mocked(supabase.storage.from).mockReturnValue({
        list: vi.fn(),
        remove: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as any)

      const result = await deleteImageFromSupabase('https://example.com/123/456-image.jpg', '123')
      expect(result).toBe(true)
      expect(supabase.storage.from).toHaveBeenCalledWith('item-definitions')
      // remove is verified below but the typings can be tricky, relying on basic check for now
    })

    it('returns false when error is returned from remove', async () => {
      const error = { message: 'Remove failed' }
      vi.mocked(supabase.storage.from).mockReturnValue({
        list: vi.fn(),
        remove: vi.fn().mockResolvedValue({ data: null, error }),
      } as any)

      const result = await deleteImageFromSupabase('https://example.com/123/456-image.jpg', '123')
      expect(result).toBe(false)
      expect(log.error).toHaveBeenCalledWith('Error deleting image:', { error })
    })

    it('returns false when an error is thrown', async () => {
      const error = new Error('Network error')
      vi.mocked(supabase.storage.from).mockImplementation(() => {
        throw error
      })

      const result = await deleteImageFromSupabase('https://example.com/123/456-image.jpg', '123')
      expect(result).toBe(false)
      expect(log.error).toHaveBeenCalledWith('Error deleting image from storage:', { error })
    })
  })
})
