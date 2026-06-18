'use client'

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { useAuth } from './AuthProvider'
import { useLogger } from 'next-axiom'
import { api } from '@/lib/api'
import type { UserHome } from '@/types'

type HomeContextType = {
  currentHomeId: string | null
  setCurrentHomeId: (id: string) => void
  isLoading: boolean
}

const HomeContext = createContext<HomeContextType>({
  currentHomeId: null,
  setCurrentHomeId: () => {},
  isLoading: true,
})

export function HomeProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  const [currentHomeId, setCurrentHomeIdState] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const log = useLogger()

  const setCurrentHomeId = useCallback((id: string) => {
    setCurrentHomeIdState(id)
    if (typeof window !== 'undefined') {
      localStorage.setItem('homeId', id)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const fetchHomes = async () => {
      if (!session) {
        if (isMounted) {
          setCurrentHomeIdState(null)
          if (typeof window !== 'undefined') {
             localStorage.removeItem('homeId')
          }
          setIsLoading(false)
        }
        return
      }

      setIsLoading(true)
      try {
        const res = await api.get<UserHome[]>('/homes')
        const userHomes = res.data

        if (userHomes && userHomes.length > 0) {
          const defaultHome = userHomes.find(h => h.IsDefault) || userHomes[0]

          if (isMounted) {
            setCurrentHomeIdState(defaultHome.HomeID)
            if (typeof window !== 'undefined') {
               localStorage.setItem('homeId', defaultHome.HomeID)
            }
          }
        } else {
          if (isMounted) {
             setCurrentHomeIdState(null)
             if (typeof window !== 'undefined') {
               localStorage.removeItem('homeId')
             }
          }
        }
      } catch (error) {
        log.error('Failed to fetch homes', { error })
        if (isMounted) {
          setCurrentHomeIdState(null)
          if (typeof window !== 'undefined') {
             localStorage.removeItem('homeId')
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchHomes()

    return () => {
      isMounted = false
    }
  }, [session, log])

  const contextValue = useMemo(() => ({
    currentHomeId,
    setCurrentHomeId,
    isLoading
  }), [currentHomeId, setCurrentHomeId, isLoading])

  return (
    <HomeContext.Provider value={contextValue}>
      {children}
    </HomeContext.Provider>
  )
}

export const useHome = () => useContext(HomeContext)
