-- B2 social-safety storage. Mutation capabilities remain narrow: direct
-- clients cannot forge friendship acceptance or encouragement delivery.

create type public.friendship_status as enum ('pending', 'accepted', 'declined', 'removed');
create type public.report_category as enum ('harassment', 'spam', 'privacy', 'unsafe_content', 'other');
create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');
create type public.encouragement_delivery_status as enum ('created', 'delivered', 'read', 'failed');

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status public.friendship_status not null default 'pending',
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_distinct_participants check (requester_id <> addressee_id),
  constraint friendships_response_consistent check (
    (status = 'pending' and responded_at is null)
    or (status <> 'pending' and responded_at is not null)
  )
);

create unique index friendships_unordered_pair_unique
  on public.friendships (
    least(requester_id, addressee_id),
    greatest(requester_id, addressee_id)
  )
  where status in ('pending', 'accepted');
create index friendships_requester_status_idx
  on public.friendships (requester_id, status, updated_at desc);
create index friendships_addressee_status_idx
  on public.friendships (addressee_id, status, updated_at desc);

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_distinct_participants check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id, blocker_id);

create table public.encouragements (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  preset_key text not null,
  delivery_status public.encouragement_delivery_status not null default 'created',
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint encouragements_distinct_participants check (sender_id <> recipient_id),
  constraint encouragements_preset_key_valid check (preset_key ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  constraint encouragements_delivery_timestamps_valid check (
    (delivered_at is null or delivered_at >= created_at)
    and (read_at is null or (delivered_at is not null and read_at >= delivered_at))
  )
);

create index encouragements_pair_cooldown_idx
  on public.encouragements (sender_id, recipient_id, created_at desc);
create index encouragements_recipient_inbox_idx
  on public.encouragements (recipient_id, created_at desc);
create index encouragements_sender_daily_idx
  on public.encouragements (sender_id, created_at desc);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_profile_id uuid references public.profiles(id) on delete cascade,
  target_encouragement_id uuid references public.encouragements(id) on delete cascade,
  category public.report_category not null,
  details text,
  status public.report_status not null default 'open',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reports_exactly_one_target check (
    num_nonnulls(target_profile_id, target_encouragement_id) = 1
  ),
  constraint reports_not_self_target check (
    target_profile_id is null or target_profile_id <> reporter_id
  ),
  constraint reports_details_valid check (
    details is null or char_length(btrim(details)) between 1 and 1000
  ),
  constraint reports_review_consistent check (
    (status = 'open' and reviewed_at is null and reviewed_by is null)
    or status <> 'open'
  )
);

create index reports_moderation_queue_idx
  on public.reports (status, created_at)
  where status in ('open', 'reviewing');
create index reports_reporter_idx
  on public.reports (reporter_id, created_at desc);

create trigger friendships_set_updated_at
before update on public.friendships
for each row execute function public.set_updated_at();

create trigger reports_set_updated_at
before update on public.reports
for each row execute function public.set_updated_at();

alter table public.friendships enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.encouragements enable row level security;

create policy "friendship participants read their relationships"
on public.friendships
for select
to authenticated
using (
  requester_id = (select public.current_profile_id())
  or addressee_id = (select public.current_profile_id())
);

create policy "blockers read their outgoing blocks"
on public.blocks
for select
to authenticated
using (blocker_id = (select public.current_profile_id()));

create policy "participants create their own blocks"
on public.blocks
for insert
to authenticated
with check (
  blocker_id = (select public.current_profile_id())
  and blocked_id <> (select public.current_profile_id())
);

create policy "participants remove their own blocks"
on public.blocks
for delete
to authenticated
using (blocker_id = (select public.current_profile_id()));

create policy "encouragement participants read their messages"
on public.encouragements
for select
to authenticated
using (
  sender_id = (select public.current_profile_id())
  or recipient_id = (select public.current_profile_id())
);

-- Reports are write-only to participants. There is deliberately no SELECT
-- policy: report contents and moderation state are service-role private.
create policy "participants submit reports as themselves"
on public.reports
for insert
to authenticated
with check (reporter_id = (select public.current_profile_id()));

revoke all on table public.friendships from anon, authenticated;
revoke all on table public.blocks from anon, authenticated;
revoke all on table public.reports from anon, authenticated;
revoke all on table public.encouragements from anon, authenticated;
grant select on table public.friendships to authenticated;
grant select, insert, delete on table public.blocks to authenticated;
grant insert on table public.reports to authenticated;
grant select on table public.encouragements to authenticated;

grant usage on type public.friendship_status to authenticated;
grant usage on type public.report_category to authenticated;
grant usage on type public.report_status to authenticated;
grant usage on type public.encouragement_delivery_status to authenticated;
