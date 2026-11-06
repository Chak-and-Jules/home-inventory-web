import { StrictMode } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthProvider'
import type { User } from 'firebase/auth'

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(), push: vi.fn(), signOut: vi.fn(), post: vi.fn(), get: vi.fn(),
  clear: vi.fn(), cancel: vi.fn(async () => {}), subscribe: vi.fn(),
  i18n: { changeLanguage: vi.fn(async () => {}) }, log: { error: vi.fn() },
}))
vi.mock('next/navigation', () => ({ usePathname: () => '/login', useRouter: () => ({ push: mocks.push }) }))
vi.mock('next-axiom', () => ({ useLogger: () => mocks.log }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: mocks.i18n }) }))
vi.mock('@/lib/navigation', () => ({ fullPageRedirect: mocks.redirect }))
vi.mock('@/lib/api', () => ({ api: { post: mocks.post, get: mocks.get } }))
vi.mock('firebase/auth', () => ({ onIdTokenChanged: mocks.subscribe }))
vi.mock('@/lib/firebase', () => ({ getFirebaseAuth: () => ({}), signOutFirebase: mocks.signOut, authErrorKey: () => 'auth.authenticationFailed' }))
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => client }))
const client = { clear: mocks.clear, cancelQueries: mocks.cancel }
let authChanged: (user: User | null) => void
const firebaseUser = { uid: 'firebase-non-uuid', email: 'test@example.test' } as User
const internalId = '00000000-0000-4000-8000-000000000123'
function Status() {
  const { user, session, profileId, authError, logout, deleteAccount } = useAuth()
  return <>
    <p>{user?.uid ?? 'anonymous'}:{profileId ?? 'no-profile'}:{session ? 'signed-in' : 'signed-out'}</p>
    {authError && <p>{authError}</p>}
    <button onClick={() => void logout().catch(() => {})}>Logout</button>
    <button onClick={() => void deleteAccount().catch(() => {})}>Delete</button>
    <button onClick={() => void deleteAccount('/account/delete-request').catch(() => {})}>Delete request</button>
  </>
}
async function initialize() {
  render(<AuthProvider><Status /></AuthProvider>)
  await act(async () => authChanged(firebaseUser))
  await screen.findByText(`firebase-non-uuid:${internalId}:signed-in`)
}
describe('Firebase profile lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mocks.subscribe.mockImplementation((_auth, callback) => { authChanged = callback; callback(null); return vi.fn() })
    mocks.post.mockResolvedValue({ data: { ID: internalId, Email: firebaseUser.email } })
    mocks.get.mockResolvedValue({ data: { web_theme: 'Light' } })
    mocks.signOut.mockImplementation(async () => authChanged(null))
  })
  it('keeps the Firebase UID separate from the returned profile UUID', async () => {
    await initialize()
    expect(mocks.post).toHaveBeenCalledWith('/profiles/sync', { profile: { id: firebaseUser.uid, email: firebaseUser.email } })
    expect(mocks.post).toHaveBeenCalledOnce()
  })
  it('does not expose a session before profile sync finishes', async () => {
    let finish!: (value: unknown) => void
    mocks.post.mockReturnValue(new Promise(resolve => { finish = resolve }))
    render(<AuthProvider><Status /></AuthProvider>)
    await act(async () => authChanged(firebaseUser))
    expect(screen.getByText('anonymous:no-profile:signed-out')).toBeInTheDocument()
    await act(async () => finish({ data: { ID: internalId } }))
    await screen.findByText(`firebase-non-uuid:${internalId}:signed-in`)
  })
  it('fails closed and permits a later sync retry after a backend failure', async () => {
    mocks.post.mockRejectedValueOnce(new Error('backend unavailable'))
    render(<AuthProvider><Status /></AuthProvider>)
    await act(async () => authChanged(firebaseUser))
    await screen.findByText('auth.profileSyncFailed')
    expect(screen.getByText('anonymous:no-profile:signed-out')).toBeInTheDocument()
    expect(mocks.get).not.toHaveBeenCalled()
    await act(async () => authChanged(firebaseUser))
    await screen.findByText(`firebase-non-uuid:${internalId}:signed-in`)
    expect(mocks.post).toHaveBeenCalledTimes(2)
  })
  it('rejects a sync response without an internal UUID', async () => {
    mocks.post.mockResolvedValue({ data: {} })
    render(<AuthProvider><Status /></AuthProvider>)
    await act(async () => authChanged(firebaseUser))
    await screen.findByText('auth.profileSyncFailed')
    expect(mocks.signOut).toHaveBeenCalledOnce()
  })
  it('deduplicates repeated token events and keeps the session stable', async () => {
    await initialize()
    const clears = mocks.clear.mock.calls.length
    await act(async () => authChanged({ ...firebaseUser } as User))
    expect(mocks.post).toHaveBeenCalledOnce()
    expect(mocks.get).toHaveBeenCalledOnce()
    expect(mocks.clear).toHaveBeenCalledTimes(clears)
  })
  it.each(['Delete', 'Delete request'])('deletes using the internal UUID via %s and clears local state', async (button) => {
    await initialize()
    localStorage.setItem('homeId', 'private-home')
    localStorage.setItem('signed_url_cache_item-definitions_file', 'private-url')
    const clears = mocks.clear.mock.calls.length
    await userEvent.click(screen.getByRole('button', { name: button }))
    await waitFor(() => expect(mocks.redirect).toHaveBeenCalledWith('/login'))
    expect(mocks.post).toHaveBeenLastCalledWith(button === 'Delete' ? '/profiles/delete-account' : '/account/delete-request', { user_id: internalId, email: firebaseUser.email })
    expect(localStorage.getItem('homeId')).toBeNull()
    expect(localStorage.getItem('signed_url_cache_item-definitions_file')).toBeNull()
    expect(mocks.clear.mock.calls.length).toBeGreaterThan(clears)
    expect(screen.getByText('anonymous:no-profile:signed-out')).toBeInTheDocument()
  })
  it('keeps account state when deletion fails', async () => {
    await initialize()
    mocks.post.mockRejectedValueOnce(new Error('Firebase deletion failed'))
    localStorage.setItem('homeId', 'private-home')
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText(`firebase-non-uuid:${internalId}:signed-in`)).toBeInTheDocument()
    expect(localStorage.getItem('homeId')).toBe('private-home')
    expect(mocks.signOut).not.toHaveBeenCalled()
    expect(mocks.redirect).not.toHaveBeenCalled()
  })
  it('clears profile, homes, and caches when a session is revoked', async () => {
    await initialize()
    localStorage.setItem('homeId', 'private-home')
    await act(async () => authChanged(null))
    expect(screen.getByText('anonymous:no-profile:signed-out')).toBeInTheDocument()
    expect(localStorage.getItem('homeId')).toBeNull()
    expect(mocks.clear).toHaveBeenCalled()
  })
  it('ignores a profile response for a previous account', async () => {
    let finish!: (value: unknown) => void
    mocks.post.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    render(<StrictMode><AuthProvider><Status /></AuthProvider></StrictMode>)
    await act(async () => authChanged(firebaseUser))
    await act(async () => authChanged(null))
    await act(async () => finish({ data: { ID: internalId } }))
    expect(screen.getByText('anonymous:no-profile:signed-out')).toBeInTheDocument()
  })
  it('clears application state and redirects after logout', async () => {
    await initialize()
    await userEvent.click(screen.getByRole('button', { name: 'Logout' }))
    expect(mocks.redirect).toHaveBeenCalledWith('/login')
    expect(mocks.signOut).toHaveBeenCalledOnce()
  })
})
