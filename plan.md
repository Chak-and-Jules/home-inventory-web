1. Add `web_theme?: 'Light' | 'Dark' | null;` to `ProfilePreference` in `src/types/language.ts`.
2. Add theme selection to `/profile` page (`src/app/profile/page.tsx`).
    - Add `updateThemeMutation` to call `PUT /profiles` with `{ web_theme: theme }`.
    - Apply the selected theme (`document.documentElement.classList.add/remove('dark')` and/or `document.documentElement.setAttribute('data-theme', theme.toLowerCase())`).
3. Set the initial theme on load based on user preferences.
    - Inside `src/components/AuthProvider.tsx`, in `fetchAndApplyPreferences`, apply the theme to `document.documentElement` if `res.data.web_theme` is "Dark" or "Light".
4. Configure Tailwind CSS to use dark mode variants.
    - Add `@custom-variant dark (&:is(.dark *));` to the top of `src/app/globals.css`.
5. Update i18n locales to support "Theme", "Light", and "Dark".
    - `src/lib/i18n/locales/en/common.json` and `src/lib/i18n/locales/tr/common.json`.
6. Use Tailwind dark variants `dark:bg-gray-900 dark:text-white` on the body in `src/app/layout.tsx`.
7. Pre-commit check and push.
