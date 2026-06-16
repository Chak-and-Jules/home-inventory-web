import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useLogger } from 'next-axiom'

export function useSignedUrls(paths: (string | undefined | null)[], bucket: string = 'item-definitions') {
  const log = useLogger()
  const validPaths = Array.from(new Set(paths.filter(Boolean) as string[]))

  return useQuery({
    queryKey: ['signedUrls', bucket, validPaths.sort()],
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
