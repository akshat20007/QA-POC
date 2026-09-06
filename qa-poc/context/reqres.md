# API Reference: ReqRes — https://reqres.in/

Explored: 2026-09-06, scope: public REST endpoints used by this PoC (users list, single user, create user).

Base URL: `https://reqres.in`

## Endpoints

### GET /api/users
Purpose: List users with pagination.
Query params:
- `page` (optional, default 1) — page number
- `per_page` (optional, default 6) — items per page

Response (200):
```json
{
  "page": 1,
  "per_page": 6,
  "total": 12,
  "total_pages": 2,
  "data": [
    { "id": 1, "email": "george.bluth@reqres.in", "first_name": "George", "last_name": "Bluth", "avatar": "..." }
  ],
  "support": { "url": "...", "text": "..." }
}
```

Notes: `data` is an array; each user has `id`, `email`, `first_name`, `last_name`, `avatar`.

### GET /api/users/{id}
Purpose: Fetch a single user by ID.
Path params: `id` (integer, e.g. 2)

Response (200):
```json
{
  "data": { "id": 2, "email": "janet.weaver@reqres.in", "first_name": "Janet", "last_name": "Weaver", "avatar": "..." },
  "support": { "url": "...", "text": "..." }
}
```

Response (404): User not found (for IDs that don't exist, e.g. 23).

### POST /api/users
Purpose: Create a new user (mock — does not persist).
Request body (JSON):
```json
{ "name": "morpheus", "job": "leader" }
```

Response (201):
```json
{
  "name": "morpheus",
  "job": "leader",
  "id": "583",
  "createdAt": "..."
}
```

## Common assertion patterns

- Status codes: 200 (OK), 201 (Created), 404 (Not Found)
- JSON path assertions: `data[0].email`, `data.id`, `page`, `per_page`, `total`
- Header assertions: `Content-Type: application/json`

## Caveats

- ReqRes is a mock API; POST/PUT/DELETE responses are simulated.
- Rate limiting may apply on heavy use; keep test counts reasonable.
- Use relative paths like `/api/users` — the runner prepends the base URL.
