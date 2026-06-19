'use client'

import React from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { useLogger } from 'next-axiom'
import { usePathname } from 'next/navigation'
import { Package, Box, LogOut, LayoutDashboard, UserCircle, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, logout } = useAuth()
  const pathname = usePathname()
  const [isLoggingOut, setIsLoggingOut] = React.useState(false)
  const log = useLogger()
  const { t } = useTranslation()

  const navigation = React.useMemo(() => [
    { name: t('layout.dashboard'), href: '/', icon: LayoutDashboard },
    { name: t('layout.categories'), href: '/categories', icon: Box },
    { name: t('layout.itemDefinitions'), href: '/item-definitions', icon: Package },
    { name: t('layout.reports'), href: '/reports', icon: BarChart3 },
  ], [t])

  if (!session) {
    return <>{children}</> // Don't show layout on login/signup
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)

    try {
      await logout()
    } catch (err) {
      log.error('Failed to log out', { error: err })
      setIsLoggingOut(false)
      alert(t('layout.failedToLogout'))
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-gray-50/50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sm:flex">
        <div className="flex h-16 shrink-0 items-center px-6">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xl tracking-tight">
            <Package className="h-6 w-6" />
            <span>Talo Box</span>
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
                      ? "bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 shadow-sm"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                  )}
                >
                  <item.icon className={cn("h-5 w-5", isActive ? "text-indigo-600" : "text-gray-400")} />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-800 p-4">
          <Link
            href="/profile"
            className="flex items-center gap-2 mb-4 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-gray-800 rounded-md transition-colors"
          >
            <UserCircle className="h-5 w-5 text-gray-400" />
            <span className="truncate">{session.user.email}</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/50 hover:text-red-700 dark:hover:text-red-400 transition-colors"
          >
            <LogOut className="h-5 w-5 text-gray-400 group-hover:text-red-600" />
            {isLoggingOut ? t('layout.loggingOut') : t('layout.logout')}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 sm:hidden">
           <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-lg">
            <Package className="h-5 w-5" />
            <span>Talo Box</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/profile"
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-1"
            >
              <UserCircle className="h-4 w-4" />
              <span className="max-w-[100px] truncate">{session.user.email}</span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 border-l pl-3 border-gray-200 dark:border-gray-800"
            >
               {isLoggingOut ? t('layout.loggingOut') : t('layout.logout')}
            </button>
          </div>
        </header>

        {/* Mobile Nav (simple scrollable row for now) */}
         <nav className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 sm:hidden no-scrollbar gap-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors border",
                    isActive
                      ? "bg-indigo-50 dark:bg-indigo-900/50 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300"
                      : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
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
