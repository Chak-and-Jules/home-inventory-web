import { createClient } from '@supabase/supabase-js'
import { getFirebaseAuth, getFirebaseIdentity } from './firebase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (typeof window !== 'undefined' && (!supabaseUrl || !supabaseAnonKey)) {
  console.warn('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY should be defined.')
}

// Supabase is retained for Storage only. Never restore a legacy Supabase session.
export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder-key', {
  accessToken: async () => {
    if (typeof window === 'undefined') return null
    try {
      const auth = getFirebaseAuth()
      await auth.authStateReady()
      return auth.currentUser ? (await getFirebaseIdentity()).token : null
    } catch (error) {
      if ((error as { code?: string }).code === 'auth/configuration-missing') return null
      throw error
    }
  },
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})
