create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_closet_items_updated_at on public.closet_items;
create trigger set_closet_items_updated_at
before update on public.closet_items
for each row execute function public.set_updated_at();

drop trigger if exists set_purchase_candidate_items_updated_at on public.purchase_candidate_items;
create trigger set_purchase_candidate_items_updated_at
before update on public.purchase_candidate_items
for each row execute function public.set_updated_at();

drop trigger if exists set_outfits_updated_at on public.outfits;
create trigger set_outfits_updated_at
before update on public.outfits
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.closet_items enable row level security;
alter table public.purchase_candidate_items enable row level security;
alter table public.outfits enable row level security;
alter table public.outfit_items enable row level security;
alter table public.item_processing_runs enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
for select
using (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists closet_items_select_own on public.closet_items;
create policy closet_items_select_own on public.closet_items
for select
using (auth.uid() = user_id);

drop policy if exists closet_items_insert_own on public.closet_items;
create policy closet_items_insert_own on public.closet_items
for insert
with check (auth.uid() = user_id);

drop policy if exists closet_items_update_own on public.closet_items;
create policy closet_items_update_own on public.closet_items
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists closet_items_delete_own on public.closet_items;
create policy closet_items_delete_own on public.closet_items
for delete
using (auth.uid() = user_id);

drop policy if exists purchase_candidate_items_select_own on public.purchase_candidate_items;
create policy purchase_candidate_items_select_own on public.purchase_candidate_items
for select
using (auth.uid() = user_id);

drop policy if exists purchase_candidate_items_insert_own on public.purchase_candidate_items;
create policy purchase_candidate_items_insert_own on public.purchase_candidate_items
for insert
with check (auth.uid() = user_id);

drop policy if exists purchase_candidate_items_update_own on public.purchase_candidate_items;
create policy purchase_candidate_items_update_own on public.purchase_candidate_items
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists purchase_candidate_items_delete_own on public.purchase_candidate_items;
create policy purchase_candidate_items_delete_own on public.purchase_candidate_items
for delete
using (auth.uid() = user_id);

drop policy if exists outfits_select_own on public.outfits;
create policy outfits_select_own on public.outfits
for select
using (auth.uid() = user_id);

drop policy if exists outfits_insert_own on public.outfits;
create policy outfits_insert_own on public.outfits
for insert
with check (auth.uid() = user_id);

drop policy if exists outfits_update_own on public.outfits;
create policy outfits_update_own on public.outfits
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists outfits_delete_own on public.outfits;
create policy outfits_delete_own on public.outfits
for delete
using (auth.uid() = user_id);

drop policy if exists outfit_items_select_own on public.outfit_items;
create policy outfit_items_select_own on public.outfit_items
for select
using (
    exists (
        select 1
        from public.outfits o
        where o.id = outfit_items.outfit_id
          and o.user_id = auth.uid()
    )
);

drop policy if exists outfit_items_insert_own on public.outfit_items;
create policy outfit_items_insert_own on public.outfit_items
for insert
with check (
    exists (
        select 1
        from public.outfits o
        where o.id = outfit_items.outfit_id
          and o.user_id = auth.uid()
    )
);

drop policy if exists outfit_items_update_own on public.outfit_items;
create policy outfit_items_update_own on public.outfit_items
for update
using (
    exists (
        select 1
        from public.outfits o
        where o.id = outfit_items.outfit_id
          and o.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1
        from public.outfits o
        where o.id = outfit_items.outfit_id
          and o.user_id = auth.uid()
    )
);

drop policy if exists outfit_items_delete_own on public.outfit_items;
create policy outfit_items_delete_own on public.outfit_items
for delete
using (
    exists (
        select 1
        from public.outfits o
        where o.id = outfit_items.outfit_id
          and o.user_id = auth.uid()
    )
);

drop policy if exists item_processing_runs_select_own on public.item_processing_runs;
create policy item_processing_runs_select_own on public.item_processing_runs
for select
using (auth.uid() = user_id);

drop policy if exists item_processing_runs_insert_own on public.item_processing_runs;
create policy item_processing_runs_insert_own on public.item_processing_runs
for insert
with check (auth.uid() = user_id);

drop policy if exists item_processing_runs_update_own on public.item_processing_runs;
create policy item_processing_runs_update_own on public.item_processing_runs
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists idx_closet_items_user_status_category_type
    on public.closet_items (user_id, status, category, item_type);

create index if not exists idx_closet_items_user_color_warmth
    on public.closet_items (user_id, primary_color, warmth_level);

create index if not exists idx_closet_items_user_active_not_deleted
    on public.closet_items (user_id, created_at desc)
    where is_deleted = false;

create index if not exists idx_closet_items_season_tags_gin
    on public.closet_items using gin (season_tags);

create index if not exists idx_closet_items_ai_season_tags_gin
    on public.closet_items using gin (ai_season_tags);

create index if not exists idx_purchase_candidate_items_user_status_category
    on public.purchase_candidate_items (user_id, status, category);

create index if not exists idx_purchase_candidate_items_user_active_not_deleted
    on public.purchase_candidate_items (user_id, created_at desc)
    where is_deleted = false;

create index if not exists idx_purchase_candidate_items_season_tags_gin
    on public.purchase_candidate_items using gin (season_tags);

create index if not exists idx_outfits_user_created_at
    on public.outfits (user_id, created_at desc);

create unique index if not exists idx_outfit_items_unique_slot_per_outfit
    on public.outfit_items (outfit_id, slot);

create index if not exists idx_item_processing_runs_target_created_at
    on public.item_processing_runs (target_kind, created_at desc);

create index if not exists idx_item_processing_runs_closet_item_created_at
    on public.item_processing_runs (closet_item_id, created_at desc)
    where closet_item_id is not null;

create index if not exists idx_item_processing_runs_candidate_item_created_at
    on public.item_processing_runs (candidate_item_id, created_at desc)
    where candidate_item_id is not null;
