# Edge API Contracts (Phase 1 Stub)

Base path is the `extractions` Edge Function URL. Methods route by suffix.

## POST `/extractions`
Creates an extraction run for either closet item registration or candidate item registration.

Request body:
- `target_kind`: `"closet"` or `"candidate"` (required)
- `tap_x`: number in range `[0, 1]` (required)
- `tap_y`: number in range `[0, 1]` (required)
- `image_path_hint`: string path/name from client picker (optional metadata only)
- `client_request_id`: idempotency key string (optional, recommended)

Response body:
- `extraction_id`: uuid-like string
- `status`: `"succeeded"` for stub
- `assets`:
- `original_path`
- `cutout_path`
- `preview_path`
- `suggestions`:
- `category`, `item_type`, `season_tags`, `warmth_level`, `primary_color`
- `confidence`:
- `category`, `item_type`, `season`, `warmth`, `color`
- `model_versions`:
- `segmentation`
- `tagging`

## POST `/extractions/{id}/retry`
Re-runs extraction on the same logical item with new tap coordinates.

Request body:
- `tap_x`: number in range `[0, 1]` (required)
- `tap_y`: number in range `[0, 1]` (required)

Response body:
- Same shape as POST `/extractions`
- New `preview_path` and `cutout_path` mock values include retry suffix

## PATCH `/items/{id}/confirm-tags`
Confirms or edits tags after extraction.

Request body:
- `category`: `"top" | "bottom" | "outer" | "shoes" | "bag"` (required)
- `item_type`: string (required)
- `season_tags`: string[] (required, can be empty)
- `warmth_level`: `1..5` or `null` (optional)
- `primary_color`: string or `null` (optional)

Response body:
- `item_id`
- `status`: `"active"`
- `confirmed_fields` object echoing normalized values
- `sources` object with all confirmed fields set to `"user"`

## Error Shape
All endpoints return:
- `error.code` (machine-readable)
- `error.message` (human-readable)
- `error.request_id` (trace id for logs)
