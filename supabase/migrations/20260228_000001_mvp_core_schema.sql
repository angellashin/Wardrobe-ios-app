create extension if not exists pgcrypto;

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    gender text null check (gender in ('woman', 'man', 'non_binary', 'prefer_not_to_say')),
    height_range text null check (height_range in ('under_155', '155_164', '165_174', '175_plus')),
    preferred_styles text[] not null default '{}',
    main_situations text[] not null default '{}',
    onboarding_completed_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (cardinality(preferred_styles) <= 3),
    check (cardinality(main_situations) <= 2)
);

create table if not exists public.closet_items (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
    original_image_path text not null,
    cutout_image_path text null,
    preview_image_path text null,
    category text null check (category in ('top', 'bottom', 'outer', 'shoes', 'bag')),
    item_type text null,
    season_tags text[] not null default '{}',
    warmth_level smallint null check (warmth_level between 1 and 5),
    primary_color text null,
    ai_category text null check (ai_category in ('top', 'bottom', 'outer', 'shoes', 'bag')),
    ai_item_type text null,
    ai_season_tags text[] not null default '{}',
    ai_warmth_level smallint null check (ai_warmth_level between 1 and 5),
    ai_primary_color text null,
    ai_confidence_category numeric(4,3) null check (ai_confidence_category between 0 and 1),
    ai_confidence_item_type numeric(4,3) null check (ai_confidence_item_type between 0 and 1),
    ai_confidence_season numeric(4,3) null check (ai_confidence_season between 0 and 1),
    ai_confidence_warmth numeric(4,3) null check (ai_confidence_warmth between 0 and 1),
    ai_confidence_color numeric(4,3) null check (ai_confidence_color between 0 and 1),
    category_source text not null default 'ai' check (category_source in ('ai', 'user')),
    item_type_source text not null default 'ai' check (item_type_source in ('ai', 'user')),
    season_source text not null default 'ai' check (season_source in ('ai', 'user')),
    warmth_source text not null default 'ai' check (warmth_source in ('ai', 'user')),
    color_source text not null default 'ai' check (color_source in ('ai', 'user')),
    segmentation_model_version text null,
    tagging_model_version text null,
    last_processed_at timestamptz null,
    is_deleted boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.purchase_candidate_items (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
    original_image_path text not null,
    cutout_image_path text null,
    preview_image_path text null,
    category text null check (category in ('top', 'bottom', 'outer', 'shoes', 'bag')),
    item_type text null,
    season_tags text[] not null default '{}',
    warmth_level smallint null check (warmth_level between 1 and 5),
    primary_color text null,
    ai_category text null check (ai_category in ('top', 'bottom', 'outer', 'shoes', 'bag')),
    ai_item_type text null,
    ai_season_tags text[] not null default '{}',
    ai_warmth_level smallint null check (ai_warmth_level between 1 and 5),
    ai_primary_color text null,
    ai_confidence_category numeric(4,3) null check (ai_confidence_category between 0 and 1),
    ai_confidence_item_type numeric(4,3) null check (ai_confidence_item_type between 0 and 1),
    ai_confidence_season numeric(4,3) null check (ai_confidence_season between 0 and 1),
    ai_confidence_warmth numeric(4,3) null check (ai_confidence_warmth between 0 and 1),
    ai_confidence_color numeric(4,3) null check (ai_confidence_color between 0 and 1),
    category_source text not null default 'ai' check (category_source in ('ai', 'user')),
    item_type_source text not null default 'ai' check (item_type_source in ('ai', 'user')),
    season_source text not null default 'ai' check (season_source in ('ai', 'user')),
    warmth_source text not null default 'ai' check (warmth_source in ('ai', 'user')),
    color_source text not null default 'ai' check (color_source in ('ai', 'user')),
    segmentation_model_version text null,
    tagging_model_version text null,
    last_processed_at timestamptz null,
    is_deleted boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.outfits (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text null,
    context text not null default 'general' check (context in ('general', 'candidate_check')),
    candidate_item_id uuid null references public.purchase_candidate_items(id) on delete set null,
    preview_image_path text null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.outfit_items (
    id uuid primary key default gen_random_uuid(),
    outfit_id uuid not null references public.outfits(id) on delete cascade,
    slot text not null check (slot in ('top', 'bottom', 'outer', 'shoes', 'bag')),
    source_kind text not null check (source_kind in ('closet', 'candidate')),
    closet_item_id uuid null references public.closet_items(id) on delete cascade,
    candidate_item_id uuid null references public.purchase_candidate_items(id) on delete cascade,
    created_at timestamptz not null default now(),
    check (
        (closet_item_id is not null and candidate_item_id is null)
        or
        (closet_item_id is null and candidate_item_id is not null)
    )
);

create table if not exists public.item_processing_runs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    target_kind text not null check (target_kind in ('closet', 'candidate')),
    closet_item_id uuid null references public.closet_items(id) on delete cascade,
    candidate_item_id uuid null references public.purchase_candidate_items(id) on delete cascade,
    run_type text not null check (run_type in ('segmentation', 'retag')),
    status text not null check (status in ('queued', 'succeeded', 'failed')),
    error_code text null,
    tap_x numeric(7,6) null check (tap_x between 0 and 1),
    tap_y numeric(7,6) null check (tap_y between 0 and 1),
    latency_ms integer null check (latency_ms >= 0),
    segmentation_model_version text null,
    tagging_model_version text null,
    request_idempotency_key text null,
    created_at timestamptz not null default now(),
    check (
        (target_kind = 'closet' and closet_item_id is not null and candidate_item_id is null)
        or
        (target_kind = 'candidate' and candidate_item_id is not null and closet_item_id is null)
    )
);
