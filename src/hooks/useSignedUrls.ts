import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useLogger } from 'next-axiom'
import { useMemo } from 'react'

export function useSignedUrls(paths: (string | undefined | null)[], bucket: string = 'item-definitions') {
  const log = useLogger()

  const validPaths = useMemo(() => {
    return Array.from(new Set(paths.filter(Boolean) as string[])).sort()
  }, [paths])

  return useQuery({
    queryKey: ['signedUrls', bucket, validPaths],
    queryFn: async () => {
      if (validPaths.length === 0) return {}

      const { data, error } = await supabase.storage.from(bucket).createSignedUrls(validPaths, 3600)

      if (error) {
        log.error('Error fetching signed URLs:', { error })
        return {}
      }

      if (!data) return {}

      return Object.fromEntries(data.map(s => [s.path, s.signedUrl]))
    },
    enabled: validPaths.length > 0,
    staleTime: 1000 * 60 * 50, // 50 minutes
  })
}
