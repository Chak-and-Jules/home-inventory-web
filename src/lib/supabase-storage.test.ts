import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { deleteImageFromSupabase, initializeStorageBucket } from './supabase-storage'
import { supabase } from './supabase'

vi.mock('./supabase', () => ({
  supabase: {
    storage: {
      from: vi.fn(),
    },
  },
}))

// Mock console.error and console.log to keep test output clean
const originalConsoleError = console.error
const originalConsoleLog = console.log
beforeEach(() => {
  console.error = vi.fn()
  console.log = vi.fn()
  vi.clearAllMocks()
})
afterAll(() => {
  console.error = originalConsoleError
  console.log = originalConsoleLog
})

describe('supabase-storage', () => {
  describe('deleteImageFromSupabase', () => {
    it('returns false if supabase.storage.from.remove returns an error', async () => {
      // Setup mock
      const mockRemove = vi.fn().mockResolvedValue({ error: new Error('Mock error') })
      ;(supabase.storage.from as ReturnType<typeof vi.fn>).mockReturnValue({ remove: mockRemove })

      // Call function
      const result = await deleteImageFromSupabase('https://example.com/homeId/filename.jpg', 'homeId')

      // Assert result
      expect(result).toBe(false)
      expect(supabase.storage.from).toHaveBeenCalledWith('item-definitions')
      expect(mockRemove).toHaveBeenCalledWith(['homeId/filename.jpg'])
      expect(console.error).toHaveBeenCalled()
    })

    it('returns true if image is successfully deleted', async () => {
      // Setup mock
      const mockRemove = vi.fn().mockResolvedValue({ error: null })
      ;(supabase.storage.from as ReturnType<typeof vi.fn>).mockReturnValue({ remove: mockRemove })

      // Call function
      const result = await deleteImageFromSupabase('https://example.com/homeId/filename.jpg', 'homeId')

      // Assert result
      expect(result).toBe(true)
      expect(supabase.storage.from).toHaveBeenCalledWith('item-definitions')
      expect(mockRemove).toHaveBeenCalledWith(['homeId/filename.jpg'])
    })

    it('returns false if an exception is thrown', async () => {
      // Setup mock
      ;(supabase.storage.from as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      // Call function
      const result = await deleteImageFromSupabase('https://example.com/homeId/filename.jpg', 'homeId')

      // Assert result
      expect(result).toBe(false)
      expect(console.error).toHaveBeenCalled()
    })
  })

  describe('initializeStorageBucket', () => {
    it('returns true if bucket exists', async () => {
      const mockList = vi.fn().mockResolvedValue({ data: [], error: null })
      ;(supabase.storage.from as ReturnType<typeof vi.fn>).mockReturnValue({ list: mockList })

      const result = await initializeStorageBucket()

      expect(result).toBe(true)
    })

    it('returns false if bucket not found error', async () => {
      const mockList = vi.fn().mockResolvedValue({ data: null, error: { message: 'bucket not found' } })
      ;(supabase.storage.from as ReturnType<typeof vi.fn>).mockReturnValue({ list: mockList })

      const result = await initializeStorageBucket()

      expect(result).toBe(false)
      expect(console.log).toHaveBeenCalled()
    })

    it('returns true if other error', async () => {
      const mockList = vi.fn().mockResolvedValue({ data: null, error: { message: 'some other error' } })
      ;(supabase.storage.from as ReturnType<typeof vi.fn>).mockReturnValue({ list: mockList })

      const result = await initializeStorageBucket()

      expect(result).toBe(true)
    })

    it('returns false if exception is thrown', async () => {
      ;(supabase.storage.from as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      const result = await initializeStorageBucket()

      expect(result).toBe(false)
      expect(console.error).toHaveBeenCalled()
    })
  })
})
