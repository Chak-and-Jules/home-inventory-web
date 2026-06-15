<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Overview
This repository is a frontend project built with Next.js, React, TypeScript, Tailwind CSS, Supabase, Axios, and React Query.
It interacts with a separate backend service via `api.ts` at the URL specified by `NEXT_PUBLIC_API_URL` or `http://localhost:8080/api/v1`.

# Architecture and Coding Guidelines

## React Query
- **Loading states:** Use `isPending` instead of `isLoading` when using React Query (v5), particularly for queries that may be disabled initially. `isLoading` is derived from `isPending && isFetching` and evaluates to false when a query is disabled but not actively fetching.

## Supabase
- **Public URLs:** Pre-calculate the storage bucket's base URL prefix at the module level (e.g., using `getPublicUrl('')`) and concatenate it with file paths when generating public URLs for lists of storage items. Avoid calling `supabase.storage.from(...).getPublicUrl(...)` repeatedly inside render loops to prevent memory allocation and performance degradation.
- **File Uploads:** Generate unique filenames using UUIDs (e.g., `crypto.randomUUID()`) and preserve the original file extension to prevent naming conflicts when uploading files to Supabase Storage.
- **Client Initialization:** Avoid throwing hard errors if environment variables like `NEXT_PUBLIC_SUPABASE_URL` are missing, as this breaks static page generation (prerendering) during the build process in Next.js. Instead, log a console warning and use placeholder values for the client creation.

## API and State Management
- Backend API contract is placed here: `https://github.com/Chak-and-Jules/home-inventory-backend/blob/main/openapi.json`. Check the contract when doing backend integrations.
- **Home ID (`homeId`):** The application relies heavily on `homeId` for transactions (categories, item definitions, inventory items).
  - Store it in the application state/context (e.g., when a default home is selected or upon login).
  - Send the `X-Home-Id` header explicitly in every API request for Categories, Item Definitions, and Inventory Items.
  - **Never** pass `homeId` as a URL query parameter.
- **Deduplication:** Deduplicate frontend API calls (such as profile syncing) using module-level state (e.g., a `Set` of tracking IDs) to handle concurrent executions caused by React Strict Mode or multiple auth state change events, preventing race conditions that result in duplicate resource creation on the backend.

## Types
- **Shared Definitions:** Centralize shared TypeScript type definitions (e.g., Home, UserHome, Profile, Category, ItemDefinition) in the `src/types/` directory (e.g., `src/types/home.ts`) to prevent duplication and ensure code health.

# Development Commands
- **Linting:** `npm run lint`
- **Type Checking:** `npx tsc --noEmit`
- **Testing:** `npx vitest run`
- **Building:** `npm run build`

## Git Workflow

- Every code change must be pushed to the remote `https://github.com/Chak-and-Jules/home-inventory-web` repository.
- Changes should be pushed to a new branch created using `main` as the base branch.
- Once pushed, a new Pull Request (PR) must be created to merge the new branch into the `main` branch.
