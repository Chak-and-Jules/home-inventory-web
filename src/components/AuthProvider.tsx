'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import { api } from '@/lib/api'

type AuthContextType = {
  user: User | null
  session: Session | null
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType>({ user: null, session: null, isLoading: true })

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      setUser(session?.user ?? null)
      setIsLoading(false)

      if (session?.user?.email) {
        // Sync profile to backend so we have the email recorded
        try {
          await api.post('/profiles/sync', { email: session.user.email })
        } catch (err) {
          if (process.env.NODE_ENV !== 'production') {
            console.error("Failed to sync profile", err)
          }
        }
      }

      if (!session && pathname !== '/login' && pathname !== '/signup') {
        router.push('/login')
      }
    }

    initializeAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setIsLoading(false)
      
      if (session?.user?.email) {
        try {
          await api.post('/profiles/sync', { email: session.user.email })
        } catch (err) {
          if (process.env.NODE_ENV !== 'production') {
            console.error("Failed to sync profile", err)
          }
        }
      }

      if (!session && pathname !== '/login' && pathname !== '/signup') {
        router.push('/login')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [pathname, router])

  return (
    <AuthContext.Provider value={{ user, session, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
