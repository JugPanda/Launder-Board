-- B6: all social reads and writes flow through current-participant RPCs.
alter type public.report_category add value if not exists 'unwanted';

create table public.encouragement_mutes (
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (recipient_id, sender_id),
  check (recipient_id <> sender_id)
);
alter table public.encouragement_mutes enable row level security;
revoke all on table public.encouragement_mutes from anon, authenticated;
create unique index reports_one_per_encouragement_reporter
  on public.reports (reporter_id, target_encouragement_id)
  where target_encouragement_id is not null;

create or replace function public.social_list_friends()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := public.current_profile_id(); v_result jsonb;
begin
  if v_actor is null then raise exception 'active_profile_required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', f.id, 'requesterId', f.requester_id, 'addresseeId', f.addressee_id,
    'status', f.status, 'createdAt', f.created_at, 'updatedAt', f.updated_at,
    'counterparty', jsonb_build_object('id', p.id, 'displayName', p.display_name)
  ) order by f.updated_at desc), '[]'::jsonb) into v_result
  from public.friendships f
  join public.profiles p on p.id = case when f.requester_id=v_actor then f.addressee_id else f.requester_id end
  where (f.requester_id=v_actor or f.addressee_id=v_actor)
    and f.status in ('pending','accepted') and p.active and p.deleted_at is null;
  return v_result;
end $$;

create or replace function public.social_request_friend(p_addressee_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := public.current_profile_id(); v_friend public.friendships%rowtype; v_target public.profiles%rowtype; v_count int;
begin
  if v_actor is null then raise exception 'active_profile_required' using errcode='42501'; end if;
  if p_addressee_id=v_actor then return jsonb_build_object('kind','unavailable'); end if;
  select count(*) into v_count from (
    select p.id from public.profiles p where p.id in (v_actor,p_addressee_id)
      and p.active and p.deleted_at is null and p.onboarding_completed_at is not null
    order by p.id for update
  ) locked;
  if v_count<>2 then return jsonb_build_object('kind','unavailable'); end if;
  select * into v_target from public.profiles where id=p_addressee_id;
  if not v_target.directory_opt_in then return jsonb_build_object('kind','unavailable'); end if;
  if exists (select 1 from public.blocks b where (b.blocker_id=v_actor and b.blocked_id=p_addressee_id) or (b.blocker_id=p_addressee_id and b.blocked_id=v_actor))
    then return jsonb_build_object('kind','blocked'); end if;
  if exists (select 1 from public.friendships f where least(f.requester_id,f.addressee_id)=least(v_actor,p_addressee_id) and greatest(f.requester_id,f.addressee_id)=greatest(v_actor,p_addressee_id) and f.status in ('pending','accepted'))
    then return jsonb_build_object('kind','already_exists'); end if;
  insert into public.friendships(requester_id,addressee_id) values(v_actor,p_addressee_id) returning * into v_friend;
  return jsonb_build_object('kind','created','friendship',jsonb_build_object(
    'id',v_friend.id,'requesterId',v_friend.requester_id,'addresseeId',v_friend.addressee_id,
    'status',v_friend.status,'createdAt',v_friend.created_at,'updatedAt',v_friend.updated_at,
    'counterparty',jsonb_build_object('id',v_target.id,'displayName',v_target.display_name)));
end $$;

create or replace function public.social_transition_friend(p_friendship_id uuid, p_action text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := public.current_profile_id(); v_friend public.friendships%rowtype; v_other public.profiles%rowtype; v_count int;
begin
  if v_actor is null then raise exception 'active_profile_required' using errcode='42501'; end if;
  select * into v_friend from public.friendships where id=p_friendship_id for update;
  if not found then return jsonb_build_object('kind','not_found'); end if;
  select count(*) into v_count from (select p.id from public.profiles p where p.id in (v_friend.requester_id,v_friend.addressee_id) and p.active and p.deleted_at is null order by p.id for update) locked;
  if v_count<>2 or v_friend.addressee_id<>v_actor or v_friend.status<>'pending' or p_action not in ('accept','decline') then return jsonb_build_object('kind','not_allowed'); end if;
  if exists(select 1 from public.blocks b where (b.blocker_id=v_friend.requester_id and b.blocked_id=v_friend.addressee_id) or (b.blocker_id=v_friend.addressee_id and b.blocked_id=v_friend.requester_id)) then return jsonb_build_object('kind','not_allowed'); end if;
  update public.friendships set status=case p_action when 'accept' then 'accepted'::public.friendship_status else 'declined'::public.friendship_status end, responded_at=now() where id=p_friendship_id returning * into v_friend;
  select * into v_other from public.profiles where id=v_friend.requester_id;
  return jsonb_build_object('kind','updated','friendship',jsonb_build_object('id',v_friend.id,'requesterId',v_friend.requester_id,'addresseeId',v_friend.addressee_id,'status',v_friend.status,'createdAt',v_friend.created_at,'updatedAt',v_friend.updated_at,'counterparty',jsonb_build_object('id',v_other.id,'displayName',v_other.display_name)));
end $$;

create or replace function public.social_remove_friend(p_friendship_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := public.current_profile_id(); v_friend public.friendships%rowtype; v_count int;
begin
  if v_actor is null then raise exception 'active_profile_required' using errcode='42501'; end if;
  select * into v_friend from public.friendships where id=p_friendship_id for update;
  if not found then return jsonb_build_object('kind','not_found'); end if;
  select count(*) into v_count from (select p.id from public.profiles p where p.id in(v_friend.requester_id,v_friend.addressee_id) and p.active and p.deleted_at is null order by p.id for update) locked;
  if v_count<>2 or v_actor not in(v_friend.requester_id,v_friend.addressee_id) or v_friend.status<>'accepted' then return jsonb_build_object('kind','not_allowed'); end if;
  update public.friendships set status='removed',responded_at=now() where id=p_friendship_id;
  return jsonb_build_object('kind','removed');
end $$;

create or replace function public.social_set_block(p_blocked_id uuid, p_blocked boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := public.current_profile_id(); v_count int;
begin
  if v_actor is null then raise exception 'active_profile_required' using errcode='42501'; end if;
  if p_blocked_id=v_actor then return jsonb_build_object('kind','not_allowed'); end if;
  select count(*) into v_count from (select p.id from public.profiles p where p.id in(v_actor,p_blocked_id) and p.active and p.deleted_at is null order by p.id for update) locked;
  if v_count<>2 then return jsonb_build_object('kind','not_found'); end if;
  if p_blocked then
    insert into public.blocks(blocker_id,blocked_id) values(v_actor,p_blocked_id) on conflict do nothing;
    update public.friendships set status='removed',responded_at=now() where least(requester_id,addressee_id)=least(v_actor,p_blocked_id) and greatest(requester_id,addressee_id)=greatest(v_actor,p_blocked_id) and status in('pending','accepted');
  else delete from public.blocks where blocker_id=v_actor and blocked_id=p_blocked_id;
  end if;
  return jsonb_build_object('kind','updated');
end $$;

create or replace function public.social_list_received_encouragements()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := public.current_profile_id(); v_result jsonb;
begin
  if v_actor is null then raise exception 'active_profile_required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'senderId',e.sender_id,'recipientId',e.recipient_id,'presetKey',e.preset_key,'createdAt',e.created_at,'sender',jsonb_build_object('id',p.id,'displayName',p.display_name)) order by e.created_at desc),'[]'::jsonb) into v_result
  from public.encouragements e left join public.profiles p on p.id=e.sender_id and p.active and p.deleted_at is null where e.recipient_id=v_actor;
  return v_result;
end $$;

create or replace function public.social_list_due_candidates()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := public.current_profile_id(); v_hall uuid; v_result jsonb;
begin
  if v_actor is null then raise exception 'active_profile_required' using errcode='42501'; end if;
  select hall_id into v_hall from public.profiles where id=v_actor;
  select coalesce(jsonb_agg(jsonb_build_object(
    'participantId',p.id,'displayName',p.display_name,'acceptedFriend',exists(select 1 from public.friendships f where f.status='accepted' and least(f.requester_id,f.addressee_id)=least(v_actor,p.id) and greatest(f.requester_id,f.addressee_id)=greatest(v_actor,p.id)),
    'sameHall',p.hall_id=v_hall,'encouragementScope',p.encouragement_scope,'reminderEnabled',p.reminder_enabled,'reminderDays',p.reminder_days,
    'trackingState',case when p.activity_import_opt_in and p.tracking_started_at is not null and (p.paused_until is null or p.paused_until<=now()) then 'current' else 'stale' end,
    'dueAt',(select max(a.occurred_at)+(p.reminder_days||' days')::interval from public.laundry_activities a where a.profile_id=p.id and a.retracted_at is null),
    'blockedEitherDirection',exists(select 1 from public.blocks b where (b.blocker_id=v_actor and b.blocked_id=p.id) or (b.blocker_id=p.id and b.blocked_id=v_actor)),
    'mutedSender',exists(select 1 from public.encouragement_mutes m where m.recipient_id=p.id and m.sender_id=v_actor)
  ) order by p.id),'[]'::jsonb) into v_result
  from public.profiles p where p.id<>v_actor and p.active and p.deleted_at is null and p.activity_import_opt_in and p.tracking_started_at is not null and (p.paused_until is null or p.paused_until<=now())
    and (exists(select 1 from public.friendships f where f.status='accepted' and least(f.requester_id,f.addressee_id)=least(v_actor,p.id) and greatest(f.requester_id,f.addressee_id)=greatest(v_actor,p.id)) or (p.encouragement_scope='hall' and p.hall_id=v_hall));
  return v_result;
end $$;

create or replace function public.social_send_encouragement(p_recipient_id uuid, p_preset_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_sender_id uuid := public.current_profile_id(); v_sender_hall_id uuid; v_recipient public.profiles%rowtype; v_item public.encouragements%rowtype; v_count int; v_last timestamptz; v_oldest timestamptz; v_now timestamptz:=now();
begin
  if v_sender_id is null then raise exception 'active_profile_required' using errcode='42501'; end if;
  if p_recipient_id=v_sender_id or p_preset_key not in('laundry_quest','shared_load','hall_point') then return jsonb_build_object('kind','not_allowed'); end if;
  select count(*) into v_count from (select p.id from public.profiles p where p.id in(v_sender_id,p_recipient_id) and p.active and p.deleted_at is null and p.onboarding_completed_at is not null order by p.id for update) locked;
  if v_count<>2 then return jsonb_build_object('kind','not_allowed'); end if;
  select hall_id into v_sender_hall_id from public.profiles where id=v_sender_id;
  select * into v_recipient from public.profiles where id=p_recipient_id;
  if exists (select 1 from public.blocks b where (b.blocker_id = v_sender_id and b.blocked_id = p_recipient_id) or (b.blocker_id = p_recipient_id and b.blocked_id = v_sender_id)) then return jsonb_build_object('kind', 'blocked'); end if;
  if not v_recipient.activity_import_opt_in or not (v_recipient.tracking_started_at is not null) or not (v_recipient.paused_until is null or v_recipient.paused_until <= v_now) then return jsonb_build_object('kind','not_allowed'); end if;
  if not (exists(select 1 from public.friendships f where f.status = 'accepted' and least(f.requester_id,f.addressee_id)=least(v_sender_id,p_recipient_id) and greatest(f.requester_id,f.addressee_id)=greatest(v_sender_id,p_recipient_id)) or (v_recipient.encouragement_scope = 'hall' and v_recipient.hall_id = v_sender_hall_id)) then return jsonb_build_object('kind','not_allowed'); end if;
  if exists(select 1 from public.encouragement_mutes m where m.recipient_id=p_recipient_id and m.sender_id=v_sender_id) then return jsonb_build_object('kind','recipient_muted'); end if;
  select max(created_at) into v_last from public.encouragements where sender_id=v_sender_id and recipient_id=p_recipient_id;
  if v_last>v_now-interval '72 hours' then return jsonb_build_object('kind','pair_cooldown','availableAt',v_last+interval '72 hours'); end if;
  select count(*),min(created_at) into v_count,v_oldest from public.encouragements where sender_id=v_sender_id and created_at>v_now-interval '24 hours';
  if v_count >= 5 then return jsonb_build_object('kind','sender_daily_limit','availableAt',v_oldest+interval '24 hours'); end if;
  insert into public.encouragements(sender_id,recipient_id,preset_key) values(v_sender_id,p_recipient_id,p_preset_key) returning * into v_item;
  return jsonb_build_object('kind','sent','encouragement',jsonb_build_object('id',v_item.id,'senderId',v_item.sender_id,'recipientId',v_item.recipient_id,'presetKey',v_item.preset_key,'createdAt',v_item.created_at));
end $$;

create or replace function public.social_set_encouragement_mute(p_sender_id uuid, p_muted boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=public.current_profile_id(); v_count int;
begin
  if v_actor is null then raise exception 'active_profile_required' using errcode='42501'; end if;
  if p_sender_id=v_actor then return jsonb_build_object('kind','not_allowed'); end if;
  select count(*) into v_count from (select p.id from public.profiles p where p.id in(v_actor,p_sender_id) and p.active and p.deleted_at is null order by p.id for update) locked;
  if v_count<>2 then return jsonb_build_object('kind','not_found'); end if;
  if p_muted then insert into public.encouragement_mutes(recipient_id,sender_id) values(v_actor,p_sender_id) on conflict do nothing;
  else delete from public.encouragement_mutes where recipient_id=v_actor and sender_id=p_sender_id; end if;
  return jsonb_build_object('kind','updated');
end $$;

create or replace function public.social_report_encouragement(p_encouragement_id uuid, p_category public.report_category)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_reporter_id uuid:=public.current_profile_id();
begin
  if v_reporter_id is null then raise exception 'active_profile_required' using errcode='42501'; end if;
  perform 1 from public.encouragements where id=p_encouragement_id and recipient_id = v_reporter_id for update;
  if not found then return jsonb_build_object('kind','not_found'); end if;
  begin
    insert into public.reports(reporter_id,target_encouragement_id,category,details) values(v_reporter_id,p_encouragement_id,p_category,null);
  exception when unique_violation then return jsonb_build_object('kind','already_reported'); end;
  return jsonb_build_object('kind','reported');
end $$;

-- Remove every direct participant write path; only the commands below execute.
revoke insert, update, delete on public.friendships from authenticated;
revoke insert, update, delete on public.blocks from authenticated;
revoke insert, update, delete on public.encouragements from authenticated;
revoke insert, update, delete on public.reports from authenticated;

revoke all on function public.social_list_friends() from public, anon;
grant execute on function public.social_list_friends() to authenticated;
revoke all on function public.social_request_friend(uuid) from public, anon;
grant execute on function public.social_request_friend(uuid) to authenticated;
revoke all on function public.social_transition_friend(uuid,text) from public, anon;
grant execute on function public.social_transition_friend(uuid,text) to authenticated;
revoke all on function public.social_remove_friend(uuid) from public, anon;
grant execute on function public.social_remove_friend(uuid) to authenticated;
revoke all on function public.social_set_block(uuid,boolean) from public, anon;
grant execute on function public.social_set_block(uuid,boolean) to authenticated;
revoke all on function public.social_list_received_encouragements() from public, anon;
grant execute on function public.social_list_received_encouragements() to authenticated;
revoke all on function public.social_list_due_candidates() from public, anon;
grant execute on function public.social_list_due_candidates() to authenticated;
revoke all on function public.social_send_encouragement(uuid,text) from public, anon;
grant execute on function public.social_send_encouragement(uuid,text) to authenticated;
revoke all on function public.social_set_encouragement_mute(uuid,boolean) from public, anon;
grant execute on function public.social_set_encouragement_mute(uuid,boolean) to authenticated;
revoke all on function public.social_report_encouragement(uuid,public.report_category) from public, anon;
grant execute on function public.social_report_encouragement(uuid,public.report_category) to authenticated;
