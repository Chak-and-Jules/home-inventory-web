import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useReducer } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useHome } from '@/components/HomeProvider';
import { getSignedImages, isHomeImagePath } from '@/lib/image-storage';
import type { SignedImage } from '@/types/image';

const REFRESH_MARGIN = 60_000;
const RETRY_INTERVAL = 30_000;

function earliestExpiry(images: SignedImage[] | undefined) {
  return images?.length ? Math.min(...images.map(image => Date.parse(image.expires_at))) : Infinity;
}

export function useSignedUrls(paths: (string | undefined | null)[]) {
  const { session } = useAuth();
  const { currentHomeId } = useHome();
  const uid = session?.user.uid;
  const [now, refreshClock] = useReducer(() => Date.now(), undefined, Date.now);
  const validPaths = useMemo(() => [...new Set(paths.filter((path): path is string =>
    !!path && !!currentHomeId && isHomeImagePath(path, currentHomeId)))].sort(), [paths, currentHomeId]);

  const query = useQuery({
    queryKey: ['signedUrls', uid, currentHomeId, validPaths],
    queryFn: ({ signal }) => getSignedImages(validPaths, currentHomeId!, signal),
    enabled: !!uid && !!currentHomeId && validPaths.length > 0,
    gcTime: 0,
    staleTime: query => Math.max(0, earliestExpiry(query.state.data) - Date.now() - REFRESH_MARGIN),
    refetchInterval: query => {
      const remaining = earliestExpiry(query.state.data) - Date.now() - REFRESH_MARGIN;
      return Number.isFinite(remaining) && remaining > 0 ? remaining : RETRY_INTERVAL;
    },
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    retry: false,
  });

  const expiry = earliestExpiry(query.data?.filter(image => Date.parse(image.expires_at) > now));
  useEffect(() => {
    // A failed refresh must still remove expired bearer URLs from mounted UI.
    const timer = Number.isFinite(expiry)
      ? setTimeout(refreshClock, Math.max(0, expiry - Date.now() + 1)) : undefined;
    const onVisible = () => refreshClock();
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [expiry]);

  const data: Record<string, string> = {};
  if (uid && currentHomeId) {
    for (const image of query.data ?? []) {
      if (Date.parse(image.expires_at) > now) data[image.path] = image.url;
    }
  }
  return { ...query, data };
}
