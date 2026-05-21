'use client'

import React from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import { Home, Package, Box, LogOut, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  if (!session) {
    return <>{children}</> // Don't show layout on login/signup
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Homes', href: '/homes', icon: Home },
    { name: 'Categories', href: '/categories', icon: Box },
    { name: 'Item Definitions', href: '/item-definitions', icon: Package },
  ]

  return (
    <div className="flex min-h-screen w-full bg-gray-50/50">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-gray-200 bg-white sm:flex">
        <div className="flex h-16 shrink-0 items-center px-6">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xl tracking-tight">
            <Package className="h-6 w-6" />
            <span>Home Inventory</span>
          </div>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto pt-6 px-4">
          <nav className="flex-1 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-indigo-50 text-indigo-700 shadow-sm"
                      : "text-gray-700 hover:bg-gray-100/80 hover:text-gray-900"
                  )}
                >
                  <item.icon className={cn("h-5 w-5", isActive ? "text-indigo-600" : "text-gray-400")} />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>
        <div className="border-t border-gray-200 p-4">
          <div className="mb-4 px-3 text-sm text-gray-500 truncate">
            {session.user.email}
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-700 transition-colors"
          >
            <LogOut className="h-5 w-5 text-gray-400 group-hover:text-red-600" />
            Log out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 sm:hidden">
           <div className="flex items-center gap-2 text-indigo-600 font-bold text-lg">
            <Package className="h-5 w-5" />
            <span>Home Inventory</span>
          </div>
          <button onClick={handleLogout} className="text-sm text-gray-600 hover:text-gray-900">
             Logout
          </button>
        </header>

        {/* Mobile Nav (simple scrollable row for now) */}
         <nav className="flex overflow-x-auto border-b border-gray-200 bg-white px-4 py-3 sm:hidden no-scrollbar gap-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors border",
                    isActive
                      ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              )
            })}
        </nav>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="mx-auto max-w-6xl">
             {children}
          </div>
        </div>
      </main>
    </div>
  )
}
