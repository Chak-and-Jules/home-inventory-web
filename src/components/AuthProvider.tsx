'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useLogger } from 'next-axiom'
import { useRouter, usePathname } from 'next/navigation'
import { api } from '@/lib/api'
import { fullPageRedirect } from '@/lib/navigation'

type AuthContextType = {
  user: User | null
  session: Session | null
  isLoading: boolean
  logout: () => Promise<void>
}

type ProfileSyncPayload = {
  profile: {
    id: string
    email: string
  }
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  logout: async () => {},
})

async function syncProfile(user: User) {
  if (!user.email) return

  const payload: ProfileSyncPayload = {
    profile: {
      id: user.id,
      email: user.email,
    },
  }

  await api.post('/profiles/sync', payload)
}

const syncedUsers = new Set<string>()

function syncProfileSafely(user: User, log: ReturnType<typeof useLogger>) {
  if (syncedUsers.has(user.id)) return
  syncedUsers.add(user.id)

  syncProfile(user).catch((err) => {
    log.error("Failed to sync profile", { error: err })
    syncedUsers.delete(user.id)
  })
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const log = useLogger()
  const router = useRouter()
  const pathname = usePathname()

  const logout = async () => {
    setIsLoading(true)

    const { error } = await supabase.auth.signOut()

    if (error) {
      setIsLoading(false)
      throw error
    }

    setSession(null)
    setUser(null)
    fullPageRedirect('/login')
  }

  useEffect(() => {
    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      setUser(session?.user ?? null)
      setIsLoading(false)

      if (session?.user) {
        // Sync profile to backend so we have user details recorded
        syncProfileSafely(session.user, log)
      }

      if (!session && pathname !== '/login' && pathname !== '/signup') {
        router.push('/login')
      }
    }

    initializeAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setIsLoading(false)
      
      if (session?.user) {
        const user = session.user
        setTimeout(() => {
          syncProfileSafely(user, log)
        }, 0)
      }

      if (!session && pathname !== '/login' && pathname !== '/signup') {
        router.push('/login')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [pathname, router, log])

  return (
    <AuthContext.Provider value={{ user, session, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
