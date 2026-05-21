'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Package } from 'lucide-react'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setIsLoading(true)

    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setIsLoading(false)
    } else {
      setSuccess("Account created successfully! You can now log in.")
      setTimeout(() => router.push('/login'), 2000)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
       {/* Decorative background elements */}
      <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-indigo-100 blur-3xl opacity-50 pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-blue-100 blur-3xl opacity-50 pointer-events-none" />

      <div className="max-w-md w-full space-y-8 bg-white/80 backdrop-blur-xl p-10 rounded-3xl shadow-xl border border-gray-100 relative z-10">
        <div className="flex flex-col items-center">
           <div className="p-3 bg-indigo-50 rounded-2xl mb-4">
            <Package className="h-8 w-8 text-indigo-600" />
          </div>
          <h2 className="text-center text-3xl font-extrabold text-gray-900 tracking-tight">
            Create an account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-500">
            Start managing your home inventory today
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSignup}>
          {error && (
             <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm text-center font-medium border border-red-100">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 rounded-lg bg-green-50 text-green-700 text-sm text-center font-medium border border-green-100">
              {success}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email-address">Email address</Label>
              <Input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11"
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-11 text-base font-semibold shadow-md transition-transform hover:-translate-y-0.5 active:translate-y-0"
            disabled={isLoading || !!success}
          >
            {isLoading ? 'Creating account...' : 'Sign up'}
          </Button>
        </form>

        <div className="text-sm text-center mt-6">
          <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors">
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
