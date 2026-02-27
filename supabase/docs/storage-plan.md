# Storage Plan (MVP)

## Buckets
- `originals-private`: source uploads for closet and candidate items.
- `cutouts-private`: transparent PNG cutout outputs from segmentation.
- `previews-private`: processed previews and composed outfit board previews.

All buckets are private. Client access uses signed URLs from trusted backend surfaces.

## Path Convention
- `{user_id}/closet/{item_id}/v{version}/original.{ext}`
- `{user_id}/closet/{item_id}/v{version}/cutout.png`
- `{user_id}/closet/{item_id}/v{version}/preview.png`
- `{user_id}/candidate/{candidate_item_id}/v{version}/original.{ext}`
- `{user_id}/candidate/{candidate_item_id}/v{version}/cutout.png`
- `{user_id}/candidate/{candidate_item_id}/v{version}/preview.png`
- `{user_id}/outfits/{outfit_id}/v{version}/preview.png`

## Retention
- Keep original and derived files for MVP to support later reprocessing.
- Soft delete in DB first (`is_deleted = true` or archived status).
- A future cleanup job can remove storage objects for hard-deleted entities.

## Access Model
- DB row access is controlled via RLS (`auth.uid() = user_id`).
- Storage object keys are user namespaced.
- Signed URLs should be short-lived and generated server-side.
