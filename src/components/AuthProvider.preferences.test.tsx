import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthProvider';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(), get: vi.fn(), post: vi.fn(),
  router: { push: vi.fn() }, log: { error: vi.fn() },
  i18n: { changeLanguage: vi.fn(async () => {}) },
  authChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
}));
vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => mocks.router }));
vi.mock('next-axiom', () => ({ useLogger: () => mocks.log }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: mocks.i18n }) }));
vi.mock('@/lib/api', () => ({ api: { get: mocks.get, post: mocks.post } }));
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: mocks.getSession, onAuthStateChange: mocks.authChange } } }));

function Status() {
  const { isPreferencesLoaded } = useAuth();
  return <div>{isPreferencesLoaded ? 'Ready' : 'Waiting'}</div>;
}
describe('initial profile preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.classList.remove('dark');
    document.documentElement.removeAttribute('data-theme');
    mocks.post.mockResolvedValue({});
    mocks.get.mockResolvedValue({ data: { web_theme: 'Dark', Language: { name: 'English' } } });
  });
  it('applies dark theme before revealing content and deduplicates profile sync in Strict Mode', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'strict-user', email: 'test@example.test' } } } });
    let complete!: (value: unknown) => void;
    mocks.get.mockReturnValue(new Promise((resolve) => { complete = resolve; }));
    render(<StrictMode><AuthProvider><Status /></AuthProvider></StrictMode>);
    await waitFor(() => expect(mocks.get).toHaveBeenCalled());
    expect(screen.getByText('Waiting')).toBeInTheDocument();
    await act(async () => complete({ data: { web_theme: 'Dark', Language: { name: 'Türkçe' } } }));
    await screen.findByText('Ready');
    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(mocks.i18n.changeLanguage).toHaveBeenCalledWith('tr');
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });
  it('still reads preferences when profile sync fails', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'failed-sync-user', email: 'test@example.test' } } } });
    mocks.post.mockRejectedValue(new Error('Unavailable'));
    render(<AuthProvider><Status /></AuthProvider>);
    await screen.findByText('Ready');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });
  it('resolves the saved language ID when preferences omit the embedded language', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'language-id-user', email: 'test@example.test' } } } });
    mocks.get.mockImplementation(async (path: string) => ({ data: path === '/profiles'
      ? { web_theme: 'Dark', language_id: 'turkish' }
      : [{ id: 'turkish', name: 'Türkçe' }] }));
    render(<AuthProvider><Status /></AuthProvider>);
    await screen.findByText('Ready');
    expect(mocks.i18n.changeLanguage).toHaveBeenCalledWith('tr');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });
  it('completes preference loading again after remounting an already synced user', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'remount-user', email: 'test@example.test' } } } });
    const first = render(<AuthProvider><Status /></AuthProvider>);
    await screen.findByText('Ready');
    first.unmount();
    mocks.get.mockResolvedValue({ data: { web_theme: 'Light' } });
    render(<AuthProvider><Status /></AuthProvider>);
    await screen.findByText('Ready');
    expect(document.documentElement).not.toHaveClass('dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });
});
