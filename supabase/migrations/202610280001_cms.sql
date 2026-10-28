-- Kinetic Showcase: private working copies, explicit published snapshots, deny-by-default writes.
create table public.members(user_id uuid primary key references auth.users(id) on delete cascade,email text not null,role text not null check(role in ('owner','editor')),created_at timestamptz not null default now());
create table public.invitations(email text primary key,role text not null check(role in ('owner','editor')),invited_by uuid references auth.users(id),created_at timestamptz not null default now());
create table public.documents(id text primary key,kind text not null check(kind in ('project','page','settings')),data jsonb not null,version integer not null default 1,published boolean not null default false,archived boolean not null default false,updated_at timestamptz not null default now(),updated_by uuid references auth.users(id));
create unique index documents_slug on public.documents(kind,(data->>'slug')) where kind<>'settings';
create table public.published_documents(like public.documents including defaults including constraints);
alter table public.published_documents add primary key(id);
create unique index published_slug on public.published_documents(kind,(data->>'slug')) where kind<>'settings';
create table public.revisions(id uuid primary key default gen_random_uuid(),document_id text not null,data jsonb not null,version integer not null,created_at timestamptz not null default now(),actor text not null,action text not null);
create index revisions_document on public.revisions(document_id,created_at desc);
create table public.media(id uuid primary key default gen_random_uuid(),name text not null,path text not null unique,original_path text,variants jsonb not null default '{}'::jsonb,type text not null,size bigint not null check(size>=0 and size<=104857600),width integer not null default 0,height integer not null default 0,duration double precision not null default 0,alt text not null default '',caption text not null default '',folder text not null default 'Uploads',status text not null default 'Ready',created_at timestamptz not null default now());
create table public.inquiries(id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 2 and 100),email text not null check(length(email)<=254),project_type text not null check(length(project_type)<=100),budget text not null check(length(budget)<=100),message text not null check(length(message) between 20 and 5000),status text not null default 'new' check(status in ('new','read','archived','spam')),created_at timestamptz not null default now());
create table public.upload_sessions(id uuid primary key,owner uuid not null references auth.users(id),objects jsonb not null,metadata jsonb not null,expires_at timestamptz not null);
alter table public.upload_sessions enable row level security;
revoke all on public.upload_sessions from anon,authenticated;grant all on public.upload_sessions to service_role;
create table public.rate_limits(key text primary key,hits integer not null default 1,expires_at timestamptz not null);
alter table public.members enable row level security;
alter table public.invitations enable row level security;
alter table public.documents enable row level security;
alter table public.published_documents enable row level security;
alter table public.revisions enable row level security;
alter table public.media enable row level security;
alter table public.inquiries enable row level security;
alter table public.rate_limits enable row level security;
create function public.cms_role() returns text language sql stable security definer set search_path='' as $$select role from public.members where user_id=auth.uid()$$;
revoke all on function public.cms_role() from public;grant execute on function public.cms_role() to authenticated;
create policy member_read on public.members for select to authenticated using(user_id=auth.uid() or public.cms_role()='owner');
create policy invitation_read on public.invitations for select to authenticated using(public.cms_role()='owner');
create policy draft_read on public.documents for select to authenticated using(public.cms_role() in ('owner','editor'));
create policy published_read on public.published_documents for select to anon,authenticated using(true);
create policy revision_read on public.revisions for select to authenticated using(public.cms_role() in ('owner','editor'));
create policy media_read on public.media for select to authenticated using(public.cms_role() in ('owner','editor'));
create policy media_metadata on public.media for update to authenticated using(public.cms_role() in ('owner','editor')) with check(public.cms_role() in ('owner','editor'));
create policy inquiry_read on public.inquiries for select to authenticated using(public.cms_role() in ('owner','editor'));
create policy inquiry_status on public.inquiries for update to authenticated using(public.cms_role() in ('owner','editor')) with check(public.cms_role() in ('owner','editor'));
create policy inquiry_delete on public.inquiries for delete to authenticated using(public.cms_role() in ('owner','editor'));
revoke all on public.members,public.invitations,public.documents,public.published_documents,public.revisions,public.media,public.inquiries,public.rate_limits from anon,authenticated;
grant select on public.published_documents to anon,authenticated;
grant select on public.members,public.invitations,public.documents,public.revisions,public.media,public.inquiries to authenticated;
grant update(name,alt,caption,folder) on public.media to authenticated;
grant update(status),delete on public.inquiries to authenticated;
grant all on public.members,public.invitations,public.documents,public.published_documents,public.revisions,public.media,public.inquiries,public.rate_limits to service_role;
create function public.extract_media_ids(payload jsonb) returns setof uuid language sql immutable set search_path='' as $$select distinct (m[1])::uuid from regexp_matches(payload::text,'media:([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})','g') m$$;
revoke all on function public.extract_media_ids(jsonb) from public;
create function public.save_document(p_id text,p_kind text,p_data jsonb,p_version integer,p_publish boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare current_doc public.documents;result public.documents;access text;v_now timestamptz:=now();
begin
 access:=public.cms_role();if access is null then raise exception 'Not authorized';end if;
 if p_kind not in ('project','page','settings') then raise exception 'Invalid content kind';end if;
 if p_kind='settings' and (access<>'owner' or p_id<>'site-settings') then raise exception 'Owner access required for site settings';end if;
 if length(p_id)>100 or p_id is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>500000 then raise exception 'Invalid document';end if;
 if coalesce(length(trim(p_data->>'title')),0)=0 then raise exception 'Title is required';end if;
 if p_kind<>'settings' and (coalesce(p_data->>'slug','')!~'^[a-z0-9]+(-[a-z0-9]+)*$' or jsonb_typeof(p_data->'blocks') is distinct from 'array') then raise exception 'Invalid slug or blocks';end if;
 if p_kind='settings' and (jsonb_typeof(p_data->'sections') is distinct from 'array' or jsonb_typeof(p_data->'services') is distinct from 'array' or jsonb_typeof(p_data->'links') is distinct from 'array' or coalesce(p_data->>'accent','')!~'^#[a-fA-F0-9]{6}$' or coalesce(p_data->>'background','')!~'^#[a-fA-F0-9]{6}$') then raise exception 'Invalid settings';end if;
 select * into current_doc from public.documents where id=p_id for update;
 if found then
  if current_doc.kind<>p_kind then raise exception 'Cannot change content kind';end if;
  if current_doc.version<>p_version then raise exception 'This content changed in another session. Reload before saving.';end if;
  if current_doc.archived and p_publish then raise exception 'Restore archived content before publishing';end if;
 elsif p_version<>0 then raise exception 'Document no longer exists. Reload before saving.';
 end if;
 if exists(select 1 from public.extract_media_ids(p_data) ids where not exists(select 1 from public.media where id=ids)) then raise exception 'A referenced media asset no longer exists';end if;
 insert into public.documents(id,kind,data,version,published,archived,updated_at,updated_by) values(p_id,p_kind,p_data,coalesce(current_doc.version,0)+1,p_publish or coalesce(current_doc.published,false),coalesce(current_doc.archived,false),v_now,auth.uid()) on conflict(id) do update set data=excluded.data,version=excluded.version,published=excluded.published,updated_at=v_now,updated_by=auth.uid() returning * into result;
 if p_publish then insert into public.published_documents select result.* on conflict(id) do update set data=excluded.data,version=excluded.version,published=true,archived=false,updated_at=v_now,updated_by=auth.uid();end if;
 insert into public.revisions(document_id,data,version,actor,action) values(p_id,p_data,result.version,coalesce((select email from public.members where user_id=auth.uid()),auth.uid()::text),case when p_publish then 'published' else 'saved' end);
 return to_jsonb(result);
end;$$;
revoke all on function public.save_document(text,text,jsonb,integer,boolean) from public;grant execute on function public.save_document(text,text,jsonb,integer,boolean) to authenticated;
create function public.document_action(p_id text,p_action text) returns void language plpgsql security definer set search_path='' as $$declare d public.documents;begin
 if public.cms_role() is null then raise exception 'Not authorized';end if;
 select * into d from public.documents where id=p_id for update;if not found then raise exception 'Document not found';end if;
 if d.kind='settings' then raise exception 'Site settings cannot be archived or deleted';end if;
 if p_action not in ('unpublish','archive','restore','delete') then raise exception 'Invalid action';end if;
 if p_action<>'restore' then delete from public.published_documents where id=p_id;end if;
 if p_action='delete' then delete from public.documents where id=p_id;else update public.documents set archived=(p_action='archive'),published=case when p_action='restore' then published else false end,version=version+1,updated_at=now(),updated_by=auth.uid() where id=p_id;end if;
 insert into public.revisions(document_id,data,version,actor,action) values(p_id,d.data,d.version+1,auth.uid()::text,p_action);
end;$$;
revoke all on function public.document_action(text,text) from public;grant execute on function public.document_action(text,text) to authenticated;
-- A user's signed-in, verified auth email is matched server-side, never a browser claim.
create function public.claim_invitation() returns void language plpgsql security definer set search_path='' as $$declare v_email text;v_role text;begin
 select lower(email) into v_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if v_email is null then return;end if;
 select role into v_role from public.invitations where email=v_email for update;
 if v_role is not null then insert into public.members(user_id,email,role) values(auth.uid(),v_email,v_role) on conflict(user_id) do nothing;delete from public.invitations where email=v_email;end if;
end;$$;
revoke all on function public.claim_invitation() from public;grant execute on function public.claim_invitation() to authenticated;
-- All owner role changes serialize on one advisory lock, preserving at least one owner.
create function public.change_member_role(p_id uuid,p_role text) returns void language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(719643);
 if public.cms_role()<>'owner' or public.cms_role() is null then raise exception 'Owner access required';end if;
 if p_role not in ('owner','editor') then raise exception 'Invalid role';end if;
 if p_role='editor' and exists(select 1 from public.members where user_id=p_id and role='owner') and (select count(*) from public.members where role='owner')<=1 then raise exception 'The last owner cannot be demoted';end if;
 update public.members set role=p_role where user_id=p_id;
end;$$;
revoke all on function public.change_member_role(uuid,text) from public;grant execute on function public.change_member_role(uuid,text) to authenticated;
create function public.remove_member(p_id uuid) returns void language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(719643);
 if public.cms_role() is distinct from 'owner' then raise exception 'Owner access required';end if;
 if exists(select 1 from public.members where user_id=p_id and role='owner') and (select count(*) from public.members where role='owner')<=1 then raise exception 'The last owner cannot be removed';end if;
 delete from public.invitations where email in(select lower(email) from public.members where user_id=p_id);
 delete from public.members where user_id=p_id;
end;$$;
revoke all on function public.remove_member(uuid) from public;grant execute on function public.remove_member(uuid) to authenticated;
create function public.consume_rate_limit(p_key text) returns boolean language plpgsql security definer set search_path='' as $$declare n integer;begin
 insert into public.rate_limits(key,hits,expires_at) values(p_key,1,now()+interval '1 hour') on conflict(key) do update set hits=case when public.rate_limits.expires_at<now() then 1 else public.rate_limits.hits+1 end,expires_at=case when public.rate_limits.expires_at<now() then now()+interval '1 hour' else public.rate_limits.expires_at end returning hits into n;
 delete from public.rate_limits where expires_at<now()-interval '1 day';return n<=5;
end;$$;
revoke all on function public.consume_rate_limit(text) from public,anon,authenticated;grant execute on function public.consume_rate_limit(text) to service_role;
create function public.public_media_paths(p_ids uuid[]) returns table(id uuid,path text) language sql security definer set search_path='' as $$select m.id,m.path from public.media m where m.id=any(p_ids) and exists(select 1 from public.published_documents d where m.id in(select public.extract_media_ids(d.data)))$$;
revoke all on function public.public_media_paths(uuid[]) from public,anon,authenticated;grant execute on function public.public_media_paths(uuid[]) to service_role;
create function public.media_in_use(p_id uuid) returns boolean language sql security definer set search_path='' as $$select exists(select 1 from public.documents d where p_id in(select public.extract_media_ids(d.data))) or exists(select 1 from public.published_documents d where p_id in(select public.extract_media_ids(d.data)))$$;
revoke all on function public.media_in_use(uuid) from public,anon,authenticated;grant execute on function public.media_in_use(uuid) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('portfolio-private','portfolio-private',false,104857600,array['image/jpeg','image/png','image/webp','image/avif','video/mp4','video/webm','application/pdf','text/vtt']);
-- No browser write policies on storage: validated function uploads use the service role.
-- Private signed URLs are issued only for current published references or authorized staff.
