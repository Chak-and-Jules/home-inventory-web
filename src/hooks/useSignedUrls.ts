import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useLogger } from 'next-axiom'
import { useMemo } from 'react'

const CACHE_KEY_PREFIX = 'signed_url_cache_';
const URL_EXPIRATION_SECONDS = 31536000; // 1 year

type CachedUrl = {
  url: string;
  expiresAt: number;
};

export function useSignedUrls(paths: (string | undefined | null)[], bucket: string = 'item-definitions') {
  const log = useLogger()

  const validPaths = useMemo(() => {
    return Array.from(new Set(paths.filter(Boolean) as string[])).sort()
  }, [paths])

  return useQuery({
    queryKey: ['signedUrls', bucket, validPaths],
    queryFn: async () => {
      if (validPaths.length === 0) return {}

      const result: Record<string, string> = {}
      const missingPaths: string[] = []
      const now = Date.now()

      // 1. Check local cache first
      for (const path of validPaths) {
        const cacheKey = `${CACHE_KEY_PREFIX}${bucket}_${path}`;
        try {
          const cachedString = localStorage.getItem(cacheKey);
          if (cachedString) {
            const cached: CachedUrl = JSON.parse(cachedString);
            // Add a 1 hour buffer to ensure we don't return URLs right about to expire
            if (cached.expiresAt > now + 3600000) {
              result[path] = cached.url;
              continue;
            } else {
              localStorage.removeItem(cacheKey); // Expired or close to expiring
            }
          }
        } catch {
          // Ignore JSON parse errors and just refetch
        }
        missingPaths.push(path);
      }

      // 2. Fetch missing paths from Supabase
      if (missingPaths.length > 0) {
        const { data, error } = await supabase.storage.from(bucket).createSignedUrls(missingPaths, URL_EXPIRATION_SECONDS)

        if (error) {
          log.error('Error fetching signed URLs:', { error })
        } else if (data) {
          data.forEach(item => {
            if (item.signedUrl && item.path) {
              result[item.path] = item.signedUrl;
              // Cache it
              try {
                const expiresAt = now + (URL_EXPIRATION_SECONDS * 1000);
                localStorage.setItem(`${CACHE_KEY_PREFIX}${bucket}_${item.path}`, JSON.stringify({
                  url: item.signedUrl,
                  expiresAt
                }));
              } catch {
                // Ignore storage quota errors
              }
            }
          });
        }
      }

      return result;
    },
    enabled: validPaths.length > 0,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours in memory cache
  })
}
