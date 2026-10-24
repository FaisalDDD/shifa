# API Reference

All API routes return JSON. Success responses use the envelope
`{ "ok": true, "data": ..., "meta"?: {...} }`; errors use
`{ "ok": false, "error": { "code", "message", "fields"? } }` with an appropriate
HTTP status. Private endpoints require a Supabase session cookie.

## Public

### Products

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products` | List products (paginated). Query: `page`, `page_size`. |
| GET | `/api/products/search` | Search products. See below. |
| GET | `/api/products/[id]` | Product detail (includes active ingredients). |
| GET | `/api/products/[id]/availability` | Nearby pharmacies + stock for a product. Query: `latitude`, `longitude`, `radius` (km). |

`/api/products/search` query params:

| Param | Type | Notes |
|-------|------|-------|
| `q` | string | Product/brand/ingredient/barcode/identifier |
| `latitude`, `longitude` | number | Optional; enables availability + distance |
| `radius` | number | km, default 10, max 200 |
| `strength`, `dosage_form` | string | Exact-match filters |
| `sort` | `relevance`\|`distance`\|`freshness` | default relevance |
| `page`, `page_size` | number | pagination (page_size max 50) |

### Pharmacies

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/pharmacies` | List pharmacies (paginated). Query: `page`, `page_size`, `active`, `verified`. |
| GET | `/api/pharmacies/nearby` | Nearby pharmacies (PostGIS). Query: `latitude`, `longitude`, `radius`, `product_id?`, `open_now?`. |
| GET | `/api/pharmacies/[id]` | Pharmacy detail (id or slug). |
| GET | `/api/pharmacies/[id]/inventory` | Pharmacy's reported stock. |

### Misc

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Liveness check. |
| GET | `/auth/callback` | Supabase Auth code exchange (email confirm / OAuth / magic link). |

## Customer (authenticated)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/reservations` | List own reservations. |
| POST | `/api/reservations` | Create a reservation request. Body: `{ pharmacy_id, product_id, quantity, request_notes? }`. |
| GET | `/api/reservations/[id]` | Reservation detail (scoped by RLS). |
| POST | `/api/reservations/[id]/cancel` | Cancel a reservation. |

## Pharmacy staff (authenticated, membership required)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/pharmacy/inventory` | Upsert own inventory. Body: `{ pharmacy_id, product_id, availability_status, quantity?, price?, currency? }`. |
| PATCH | `/api/pharmacy/inventory/[id]` | Update an inventory record. |
| POST | `/api/pharmacy/reservations/[id]/confirm` | Confirm a reservation. |
| POST | `/api/pharmacy/reservations/[id]/reject` | Reject a reservation. |

## Admin (authenticated, role = admin)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/pharmacies` | Create a pharmacy. |
| PATCH | `/api/admin/pharmacies/[id]` | Update/verify a pharmacy (`verification_status`, `is_active`, business info). |
| POST | `/api/admin/products` | Create a product (with active ingredients). |

## Error codes

| Code | HTTP | Meaning |
|------|------|---------|
| `unauthenticated` | 401 | Missing/invalid session |
| `forbidden` | 403 | Not authorized |
| `not_found` | 404 | Resource not found (also returned for unauthorized private resources) |
| `validation` | 422 | Invalid input (with `fields`) |
| `conflict` | 409 | Invalid state transition |
| `rate_limited` | 429 | Too many requests |
| `internal` | 500 | Unexpected error (details never leaked) |

Rate limiting applies to auth, search, and reservation creation.
