## Complex Contract Discrepancies - Action Plan

### Overview
During the alignment of the frontend TypeScript types with the backend OpenAPI contract (`openapi.json`), several discrepancies were discovered concerning the `MaintenanceTask` and `MaintenanceTaskRequest` endpoints.

Specifically, the following fields are heavily utilized in the frontend React components and expected by the live API logic, but they are omitted from the current backend OpenAPI schema:
- `Dependencies` (TaskItemDependency[])
- `custom_frequency_metric` (string)
- `custom_frequency` (number)

*(Note: Memory guidelines explicitly confirm that "Maintenance task repeat frequency endpoint API requests and responses use snake_case properties (`custom_frequency`, `custom_frequency_metric`) in alignment with the backend schema.")*

### Why We Should Update the Backend
Instead of removing these features from the frontend (which would break functional UI dependencies and user expectations), the correct approach is to update the backend's contract to truthfully reflect the system's current behavior.

### Proposed Action Plan for Backend
1. **Update Go Models & DTOs**: Ensure that the Go backend `MaintenanceTask` struct and related request DTOs (`MaintenanceTaskRequest`) include the `Dependencies`, `custom_frequency_metric`, and `custom_frequency` fields.
2. **Update Swagger/OpenAPI Spec**: Regenerate or manually update `openapi.json` to include these fields in the respective schemas.
3. **Verify API Logic**: Ensure that the endpoints (`GET /maintenance-tasks`, `POST /maintenance-tasks`, `PUT /maintenance-tasks/{id}`) properly handle and serialize/deserialize these fields based on the exact casing expected by the frontend (`Dependencies`, `custom_frequency`, `custom_frequency_metric`).

This plan avoids breaking the existing frontend functionality while establishing a fully accurate contract across both systems.
