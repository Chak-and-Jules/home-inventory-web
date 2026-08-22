The backend OpenAPI contract mismatches:

1. `Category`: Missing `HomeID`, `Home`, `CreatedAt`, `UpdatedAt` in frontend `src/types/index.ts`.
2. `InventoryItem`: Missing `Home`, `CreatedAt`, `UpdatedAt` in frontend.
3. `ItemDefinition`: Missing `CreatedAt`, `Language`, `HomeID`, `Home`, `UpdatedAt` in frontend.
4. `SizeUnit`: Missing `CreatedAt`, `UpdatedAt` in frontend.
5. `ShoppingListItem`: Frontend has `is_dismissed` and `is_predictive` which are not in the OpenAPI contract. (I can remove them from the TS type, but I should check if they are used elsewhere in the UI first. Let's find usages of them first).
6. `MaintenanceTask`: Frontend has `Dependencies`, `custom_frequency_metric`, `custom_frequency` which are not in the OpenAPI contract. Wait, memory says: "Maintenance task repeat frequency endpoint API requests and responses use snake_case properties (`custom_frequency`, `custom_frequency_metric`) in alignment with the backend schema." So maybe the OpenAPI contract is just outdated or doesn't have it explicitly documented, BUT they ARE expected by the backend and used extensively in the frontend. We shouldn't remove them from the UI/TS types since they seem like valid extensions/features. Wait, the prompt says "Fix simple contract mismatches. Offer solution for more complex contract discrepancies". This means I should point out that `openapi.json` is missing them and offer a solution to update the backend.
