# Action Plan: Home Users API Discrepancy

## The Problem
The frontend application includes a view to manage users for a home (`src/app/homes/users/page.tsx`), which relies on several endpoints that are missing from the backend API contract (`openapi.json`).

Specifically, the frontend currently expects the following endpoints to exist under `/homes/{id}/users`:
1. `GET /homes/{id}/users` - Retrieve a list of users for a home
2. `POST /homes/{id}/users` - Add a user to a home
3. `PUT /homes/{id}/users/{userId}/role` - Update a user's role within a home
4. `DELETE /homes/{id}/users/{userId}` - Remove a user from a home

However, looking at the provided backend `openapi.json`, there are no endpoints with `users` in the path, nor are there any tags or endpoints for managing the user lists of homes.

## Proposed Solution

To resolve this discrepancy, the backend and frontend must be synchronized. There are two general approaches to fix this, depending on the intended product design:

### Option 1: Add the Home Users Endpoints to the Backend
If managing home users is still a required feature, the missing endpoints must be implemented (or restored if they were accidentally removed) in the backend service.

**Backend Tasks:**
- Implement `GET /homes/{id}/users` returning a list of users.
- Implement `POST /homes/{id}/users` (accepting an email and a role).
- Implement `PUT /homes/{id}/users/{userId}/role` (accepting a new role).
- Implement `DELETE /homes/{id}/users/{userId}`.
- Ensure the `UserHome` and related entity schemas are correctly referenced in these endpoints.
- Update the `openapi.json` contract to include these endpoints.

**Frontend Tasks:**
- The current implementation in `src/app/homes/users/page.tsx` is already written for this contract, so it would only need minor adjustments if the backend schemas for the request payloads or responses change slightly from what is currently expected.

### Option 2: Remove Home Users Management from the Frontend
If managing home users has been deliberately removed from the backend design, or is going to be handled by a completely different mechanism, the feature should be removed from the frontend to match.

**Frontend Tasks:**
- Delete `src/app/homes/users/page.tsx`.
- Remove any links to `/homes/users` (such as the one found in `src/app/profile/page.tsx`).
- Remove related localization strings if applicable.

## Recommendation
Since `UserHome` is defined in the schemas and includes a `Role` property, it is highly likely that Option 1 is the intended path forward. We should update the backend to include these endpoints.
