'use client'

import { useAuth } from '@/components/AuthProvider'
import { useHome } from '@/components/HomeProvider'
import { api } from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Home as HomeIcon, CheckCircle2, Users, Trash2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'
import { AxiosError } from 'axios'
import type { UserHome, Language, ProfilePreference } from '@/types'
import { setLanguagePreference } from '@/lib/i18n/cookie'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

export default function ProfilePage() {
  const { session } = useAuth()
  const { setCurrentHomeId } = useHome()
  const queryClient = useQueryClient()
  const [newHomeName, setNewHomeName] = useState('')
  const { t, i18n } = useTranslation()

  const { data: languages } = useQuery<Language[]>({
    queryKey: ['languages'],
    queryFn: async () => {
      const res = await api.get<Language[]>('/languages')
      return res.data
    },
    enabled: !!session,
  })

  const { data: profilePreference, isPending: isPreferencePending } = useQuery({
    queryKey: ['profilePreference'],
    queryFn: async () => {
      const res = await api.get<ProfilePreference>('/profiles')
      return res.data
    },
    enabled: !!session,
  })

  const updateLanguageMutation = useMutation({
    mutationFn: (language_id: string) => api.put('/profiles', { language_id }),
    onSuccess: (_, language_id) => {
      queryClient.invalidateQueries({ queryKey: ['profilePreference'] });

      // Update i18n locally immediately
      const selectedLang = languages?.find(l => l.Id === language_id);
      if (selectedLang) {
        const langCode = selectedLang.Name.toLowerCase();
        let shortLang = 'en';
        if (langCode.includes('turkish')) shortLang = 'tr';
        if (langCode.includes('english')) shortLang = 'en';

        i18n.changeLanguage(shortLang);
        setLanguagePreference(shortLang);
      }
    },
    onError: () => {
      alert(t('profile.alerts.failedToUpdatePreferences'))
    }
  })

  const updateThemeMutation = useMutation({
    mutationFn: (web_theme: string) => api.put('/profiles', { web_theme }),
    onSuccess: (_, web_theme) => {
      queryClient.invalidateQueries({ queryKey: ['profilePreference'] });

      if (web_theme === 'Dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.setAttribute('data-theme', 'light');
      }
    },
    onError: () => {
      alert(t('profile.alerts.failedToUpdatePreferences'))
    }
  })



  const { data: userHomes, isPending } = useQuery({
    queryKey: ['homes'],
    queryFn: async () => {
      const res = await api.get<UserHome[]>('/homes')
      return res.data
    },
    enabled: !!session,
  })

  const createHomeMutation = useMutation({
    mutationFn: (name: string) => api.post('/homes', { name: name.trim() }),
    onSuccess: () => {
      setNewHomeName('')
      queryClient.invalidateQueries({ queryKey: ['homes'] })
    },
    onError: (err: unknown) => {
      const axiosError = err as AxiosError<{ error?: string }>
      alert(axiosError.response?.data?.error || t('profile.alerts.failedToCreateHome'))
    }
  })

  const deleteHomeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/homes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homes'] })
    },
    onError: (err: unknown) => {
      const axiosError = err as AxiosError<{ error?: string }>
      alert(axiosError.response?.data?.error || t('profile.alerts.failedToDeleteHome'))
    }
  })

  const setDefaultHomeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/homes/${id}/default`),
    onSuccess: (_, id) => {
      setCurrentHomeId(id)
      queryClient.invalidateQueries({ queryKey: ['homes'] })
    }
  })

  const handleCreate = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const name = newHomeName.trim()
    if (name) {
      createHomeMutation.mutate(name)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white dark:text-white">{t('profile.title')}</h1>
        <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400">{t('profile.description')}</p>
      </div>

      <Tabs defaultValue="profile_info" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="profile_info">{t('profile.tabs.profileInfo')}</TabsTrigger>
          <TabsTrigger value="homes">{t('profile.tabs.homes')}</TabsTrigger>
        </TabsList>
        <TabsContent value="profile_info">
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.profileInfo.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('profile.profileInfo.emailAddress')}</div>
                <div className="text-lg">{session?.user?.email}</div>
              </div>

              <div className="space-y-2 mt-6">
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('profile.profileInfo.language')}</div>
                {isPreferencePending ? (
                  <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-full max-w-sm animate-pulse"></div>
                ) : (
                  <select
                    className="flex h-10 w-full max-w-sm items-center justify-between rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 dark:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={profilePreference?.language_id || ''}
                    onChange={(e) => updateLanguageMutation.mutate(e.target.value)}
                    disabled={updateLanguageMutation.isPending}
                  >
                    <option value="" disabled>{t('profile.profileInfo.selectLanguage')}</option>
                    {languages?.map((lang) => (
                      <option key={lang.Id} value={lang.Id}>
                        {lang.Name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-2 mt-6">
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400 dark:text-gray-400">{t('profile.profileInfo.theme')}</div>
                {isPreferencePending ? (
                  <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-full max-w-sm animate-pulse"></div>
                ) : (
                  <select
                    className="flex h-10 w-full max-w-sm items-center justify-between rounded-md border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 px-3 py-2 text-sm ring-offset-white dark:ring-offset-gray-900 placeholder:text-gray-500 dark:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={profilePreference?.web_theme || 'Light'}
                    onChange={(e) => updateThemeMutation.mutate(e.target.value)}
                    disabled={updateThemeMutation.isPending}
                  >
                    <option value="Light">{t('profile.profileInfo.light')}</option>
                    <option value="Dark">{t('profile.profileInfo.dark')}</option>
                  </select>
                )}
              </div>


            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="homes">
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>{t('profile.homes.createNewHome')}</CardTitle>
                <CardDescription>{t('profile.homes.createNewHomeDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreate} className="flex gap-3">
                  <Input
                    type="text"
                    value={newHomeName}
                    onChange={(e) => setNewHomeName(e.target.value)}
                    placeholder={t('profile.homes.placeholder')}
                    className="max-w-md"
                    required
                  />
                  <Button type="submit" disabled={createHomeMutation.isPending || !newHomeName.trim()}>
                    <Plus className="h-4 w-4 mr-2" />
                    {createHomeMutation.isPending ? t('profile.homes.creating') : t('profile.homes.create')}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {isPending && (
                <Card className="flex flex-col min-h-[140px] animate-pulse bg-gray-50 dark:bg-gray-800/50">
                   <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                     <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                   </CardHeader>
                   <CardContent className="mt-auto pt-4">
                     <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                   </CardContent>
                </Card>
              )}
              {userHomes?.map((userHome) => (
                <Card key={userHome.HomeID} className={cn("flex flex-col transition-all hover:shadow-md", userHome.IsDefault && "border-indigo-200 dark:border-indigo-800 ring-1 ring-indigo-100 dark:ring-indigo-900/50")}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <HomeIcon className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
                      {userHome.Home.Name}
                    </CardTitle>
                    {userHome.IsDefault && (
                      <CheckCircle2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    )}
                  </CardHeader>
                  <CardContent className="flex-1 pb-2">
                    <div className="text-sm text-gray-500 dark:text-gray-400 capitalize">{t('profile.homes.role', { role: userHome.Role })}</div>
                  </CardContent>
                  <div className="p-4 pt-0 mt-auto flex items-center gap-2 flex-wrap">
                     {!userHome.IsDefault && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDefaultHomeMutation.mutate(userHome.HomeID)}
                        className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-xs h-8"
                      >
                        {t('profile.homes.setDefault')}
                      </Button>
                    )}

                    {(userHome.Role === 'owner' || userHome.Role === 'partner') && (
                      <Button variant="outline" size="sm" asChild className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-xs h-8">
                        <Link href={`/homes/users`} onClick={() => setCurrentHomeId(userHome.HomeID)}>
                          <Users className="h-3.5 w-3.5 mr-1.5" />
                          {t('profile.homes.users')}
                        </Link>
                      </Button>
                    )}

                    {userHome.Role === 'owner' && (
                       <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm(t('profile.alerts.confirmDeleteHome'))) {
                            deleteHomeMutation.mutate(userHome.HomeID)
                          }
                        }}
                        className="bg-white dark:bg-gray-800 border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 dark:hover:text-red-300 hover:border-red-200 dark:hover:border-red-800 text-xs h-8 ml-auto"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
              {(!userHomes || userHomes.length === 0) && (
                <div className="col-span-full py-12 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                  <HomeIcon className="mx-auto h-8 w-8 text-gray-400 mb-3" />
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">{t('profile.homes.noHomes')}</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('profile.homes.getStarted')}</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
