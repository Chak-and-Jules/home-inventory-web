'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { AuthProvider } from '@/components/AuthProvider'
import { HomeProvider } from '@/components/HomeProvider'

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false } } }))

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <HomeProvider>
          {children}
        </HomeProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
