create extension if not exists pgcrypto;

create type public.edition_status as enum ('draft', 'approved', 'published', 'failed');
create type public.story_kind as enum ('reporting', 'analysis', 'opinion');

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  display_order smallint not null unique,
  retrieval_prompt text,
  is_active boolean not null default true
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text not null unique,
  credibility_score numeric(5,2),
  is_primary_source boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.editions (
  id uuid primary key default gen_random_uuid(),
  edition_date date not null unique,
  edition_number integer generated always as identity unique,
  coverage_starts_at timestamptz not null,
  coverage_ends_at timestamptz not null,
  status public.edition_status not null default 'draft',
  generated_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz,
  approved_by text,
  failure_reason text,
  created_at timestamptz not null default now(),
  constraint valid_coverage_window check (coverage_ends_at > coverage_starts_at),
  constraint publication_state check (
    (status <> 'published') or (approved_at is not null and published_at is not null)
  )
);

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id),
  source_id uuid not null references public.sources(id),
  headline text not null,
  summary text not null,
  canonical_url text not null unique,
  source_headline text,
  published_at timestamptz not null,
  kind public.story_kind not null default 'reporting',
  importance_score numeric(5,2),
  interestingness_score numeric(5,2),
  relevance_score numeric(5,2),
  newness_score numeric(5,2),
  source_quality_score numeric(5,2),
  momentum_score numeric(5,2),
  weighted_score numeric(5,2),
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.edition_story_placements (
  edition_id uuid not null references public.editions(id) on delete cascade,
  story_id uuid not null references public.stories(id),
  section_slug text not null,
  rank smallint not null check (rank > 0),
  primary key (edition_id, section_slug, rank),
  unique (edition_id, story_id, section_slug)
);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  topic_type text,
  created_at timestamptz not null default now()
);

create table public.story_topics (
  story_id uuid not null references public.stories(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  primary key (story_id, topic_id)
);

create index stories_published_at_idx on public.stories (published_at desc);
create index stories_category_id_idx on public.stories (category_id);
create index stories_source_id_idx on public.stories (source_id);
create index placements_story_idx on public.edition_story_placements (story_id);
create index story_topics_topic_idx on public.story_topics (topic_id, story_id);
create index editions_published_idx on public.editions (edition_date desc) where status = 'published';
create index editions_approved_by_idx on public.editions (approved_by) where approved_by is not null;

insert into public.categories (slug, name, display_order) values
  ('usa', 'USA', 1),
  ('california', 'California', 2),
  ('world', 'World', 3),
  ('tech-ai', 'Tech + AI', 4),
  ('science-planet', 'Science + Planet', 5),
  ('health-wellness', 'Health + Wellness', 6),
  ('money-economy', 'Money + Economy', 7),
  ('politics-policy', 'Politics + Policy', 8),
  ('jobs-work', 'Jobs + Work', 9),
  ('sports', 'Sports', 10),
  ('internet-trends', 'Internet + Trends', 11),
  ('gaming', 'Gaming', 12),
  ('life-society', 'Life + Society', 13),
  ('pop-culture', 'Pop Culture', 14),
  ('other-notable', 'Other Notable', 15);

create view public.published_edition_stories
with (security_invoker = true) as
select
  e.id as edition_id,
  e.edition_date,
  s.id,
  s.headline,
  s.summary,
  s.canonical_url,
  s.published_at,
  src.name as source_name,
  p.section_slug,
  c.display_order as section_order,
  p.rank,
  coalesce(
    jsonb_agg(jsonb_build_object('name', t.name, 'slug', t.slug))
      filter (where t.id is not null),
    '[]'::jsonb
  ) as topics
from public.editions e
join public.edition_story_placements p on p.edition_id = e.id
join public.stories s on s.id = p.story_id
join public.sources src on src.id = s.source_id
left join public.categories c on c.id = s.category_id
left join public.story_topics st on st.story_id = s.id
left join public.topics t on t.id = st.topic_id
where e.status = 'published'
group by e.id, s.id, src.name, p.section_slug, p.rank, c.display_order;

create view public.published_topic_stories
with (security_invoker = true) as
select
  e.id as edition_id,
  e.edition_date,
  s.id as story_id,
  s.headline,
  s.summary,
  s.canonical_url,
  s.published_at,
  src.name as source_name,
  p.section_slug,
  c.display_order as section_order,
  p.rank,
  t.name as topic_name,
  t.slug as topic_slug
from public.editions e
join public.edition_story_placements p on p.edition_id = e.id
join public.stories s on s.id = p.story_id
join public.sources src on src.id = s.source_id
join public.categories c on c.id = s.category_id
join public.story_topics st on st.story_id = s.id
join public.topics t on t.id = st.topic_id
where e.status = 'published';

create view public.published_topics
with (security_invoker = true) as
select
  t.name,
  t.slug,
  count(distinct st.story_id)::integer as story_count,
  max(e.edition_date) as latest_edition_date
from public.topics t
join public.story_topics st on st.topic_id = t.id
join public.edition_story_placements p on p.story_id = st.story_id
join public.editions e on e.id = p.edition_id and e.status = 'published'
group by t.id, t.name, t.slug;

alter table public.categories enable row level security;
alter table public.sources enable row level security;
alter table public.editions enable row level security;
alter table public.stories enable row level security;
alter table public.edition_story_placements enable row level security;
alter table public.topics enable row level security;
alter table public.story_topics enable row level security;

create policy "published editions are public" on public.editions
  for select to anon, authenticated using (status = 'published');
create policy "active categories are public" on public.categories
  for select to anon, authenticated using (is_active);
create policy "published sources are public" on public.sources
  for select to anon, authenticated using (exists (
    select 1 from public.stories s
    join public.edition_story_placements p on p.story_id = s.id
    join public.editions e on e.id = p.edition_id
    where s.source_id = sources.id and e.status = 'published'
  ));
create policy "published stories are public" on public.stories
  for select to anon, authenticated using (exists (
    select 1 from public.edition_story_placements p
    join public.editions e on e.id = p.edition_id
    where p.story_id = stories.id and e.status = 'published'
  ));
create policy "published placements are public" on public.edition_story_placements
  for select to anon, authenticated using (exists (
    select 1 from public.editions e
    where e.id = edition_story_placements.edition_id and e.status = 'published'
  ));
create policy "published topics are public" on public.topics
  for select to anon, authenticated using (exists (
    select 1 from public.story_topics st
    join public.edition_story_placements p on p.story_id = st.story_id
    join public.editions e on e.id = p.edition_id
    where st.topic_id = topics.id and e.status = 'published'
  ));
create policy "published story topics are public" on public.story_topics
  for select to anon, authenticated using (exists (
    select 1 from public.edition_story_placements p
    join public.editions e on e.id = p.edition_id
    where p.story_id = story_topics.story_id and e.status = 'published'
  ));

grant usage on schema public to anon, authenticated;
grant select on public.editions, public.categories, public.sources, public.stories,
  public.edition_story_placements, public.topics, public.story_topics,
  public.published_edition_stories, public.published_topic_stories,
  public.published_topics to anon, authenticated;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.enforce_edition_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'published' and new is distinct from old then
    raise exception 'Published editions are immutable';
  end if;

  if old.status = 'draft' and new.status not in ('draft', 'approved', 'failed') then
    raise exception 'A draft must be approved before publication';
  end if;

  if old.status = 'approved' and new.status not in ('approved', 'published', 'failed') then
    raise exception 'Invalid edition status transition';
  end if;

  if new.status = 'approved' and (new.approved_at is null or new.approved_by is null) then
    raise exception 'Approval requires an approver and timestamp';
  end if;

  return new;
end;
$$;

create trigger editions_transition_guard
before update on public.editions
for each row execute function private.enforce_edition_transition();
