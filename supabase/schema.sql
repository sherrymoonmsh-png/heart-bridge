-- Mind Bridge MVP schema

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  name text not null default '新用户',
  streak_days int not null default 1,
  logs_count int not null default 0,
  groups_count int not null default 0,
  harvest_count int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.users add column if not exists role text not null default 'user';
alter table public.users add column if not exists avatar_url text not null default '';
alter table public.users add column if not exists bio text not null default '';

-- Mirrors auth user; admin flag for app permissions (e.g. official zone publish).
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  is_admin boolean not null default false,
  display_name text,
  username text,
  updated_at timestamptz not null default now()
);
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists avatar_url text not null default '';
alter table public.profiles add column if not exists bio text not null default '';

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  "desc" text not null default '',
  created_at timestamptz not null default now()
);
alter table public.groups add column if not exists creator_phone text not null default '';
alter table public.groups add column if not exists creator_name text not null default '匿名用户';
alter table public.groups add column if not exists status text not null default 'pending';
alter table public.groups add column if not exists rejection_reason text not null default '';

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  author_name text not null,
  author_phone text not null,
  like_count int not null default 0,
  favorite_count int not null default 0,
  comment_count int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.posts add column if not exists favorite_count int not null default 0;

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  content text not null,
  author_name text not null,
  author_phone text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_phone text not null,
  created_at timestamptz not null default now(),
  unique(post_id, user_phone)
);

create table if not exists public.post_favorites (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_phone text not null,
  created_at timestamptz not null default now(),
  unique(post_id, user_phone)
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  summary text,
  location text not null,
  start_at timestamptz not null,
  like_count int not null default 0,
  favorite_count int not null default 0,
  created_at timestamptz not null default now(),
  kind text not null default 'event',
  author_id uuid references auth.users(id) on delete set null,
  category text
);
alter table public.activities add column if not exists kind text not null default 'event';
alter table public.activities add column if not exists author_id uuid references auth.users(id) on delete set null;
alter table public.activities add column if not exists category text;
alter table public.activities add column if not exists summary text;
alter table public.activities drop column if exists creator_phone;
alter table public.activities drop column if exists creator_name;

create table if not exists public.activity_likes (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_phone text not null,
  created_at timestamptz not null default now(),
  unique(activity_id, user_phone)
);

create table if not exists public.activity_favorites (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_phone text not null,
  created_at timestamptz not null default now(),
  unique(activity_id, user_phone)
);

create table if not exists public.diaries (
  id uuid primary key default gen_random_uuid(),
  user_phone text not null,
  mood text not null default '平静',
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.diaries add column if not exists user_id uuid references auth.users(id) on delete cascade;
create index if not exists diaries_user_id_idx on public.diaries(user_id);

alter table public.users enable row level security;
alter table public.groups enable row level security;
alter table public.posts enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_favorites enable row level security;
alter table public.activities enable row level security;
alter table public.activity_likes enable row level security;
alter table public.activity_favorites enable row level security;
alter table public.diaries enable row level security;
alter table public.profiles enable row level security;

drop policy if exists users_all on public.users;
create policy users_all on public.users for all to anon, authenticated using (true) with check (true);

drop policy if exists groups_all on public.groups;
create policy groups_all on public.groups for all to anon, authenticated using (true) with check (true);

drop policy if exists posts_all on public.posts;
create policy posts_all on public.posts for all to anon, authenticated using (true) with check (true);

drop policy if exists post_comments_all on public.post_comments;
create policy post_comments_all on public.post_comments for all to anon, authenticated using (true) with check (true);

drop policy if exists post_likes_all on public.post_likes;
create policy post_likes_all on public.post_likes for all to anon, authenticated using (true) with check (true);

drop policy if exists post_favorites_all on public.post_favorites;
create policy post_favorites_all on public.post_favorites for all to anon, authenticated using (true) with check (true);

drop policy if exists activities_all on public.activities;
create policy activities_all on public.activities for all to anon, authenticated using (true) with check (true);

drop policy if exists activity_likes_all on public.activity_likes;
create policy activity_likes_all on public.activity_likes for all to anon, authenticated using (true) with check (true);

drop policy if exists activity_favorites_all on public.activity_favorites;
create policy activity_favorites_all on public.activity_favorites for all to anon, authenticated using (true) with check (true);

drop policy if exists diaries_owner_all on public.diaries;
create policy diaries_owner_all on public.diaries
for all to authenticated
using (
  auth.uid() = user_id
  or (
    user_id is null
    and user_phone is not distinct from (auth.jwt() ->> 'email')::text
  )
)
with check (
  auth.uid() = user_id
  or (
    user_id is null
    and user_phone is not distinct from (auth.jwt() ->> 'email')::text
  )
);

drop policy if exists profiles_all on public.profiles;
create policy profiles_all on public.profiles for all to anon, authenticated using (true) with check (true);

-- demo seed (optional)
insert into public.groups (title, "desc")
values
  ('职场压力减压站', '分享职场情绪与压力，互助成长。'),
  ('失恋互助夜谈会', '表达情绪与困扰，重建内心安全感。'),
  ('自我关怀养成营', '每日一个练习，慢慢修复自己。')
on conflict do nothing;
update public.groups set status = 'approved' where status is distinct from 'approved' and creator_phone = '';

insert into public.activities (title, content, summary, location, start_at, kind, category, like_count, favorite_count)
values
  ('线下减压交流会', '邀请心理咨询师分享减压技巧并开放问答。', '邀请心理咨询师分享减压技巧并开放问答。', '上海静安', now() + interval '3 day', 'event', null, 0, 0),
  ('如何识别压力信号', '从睡眠、饮食与情绪变化识别压力早期迹象。', '从睡眠、饮食与情绪变化识别压力早期迹象。', '线上', now(), 'article', '心理科普', 0, 0),
  ('5分钟呼吸练习', '简单可执行的呼吸节律练习，帮助快速稳定情绪。', '简单可执行的呼吸节律练习，帮助快速稳定情绪。', '线上', now(), 'article', '心理科普', 0, 0),
  ('建立自我关怀清单', '通过小步骤建立稳定、可持续的自我照顾习惯。', '通过小步骤建立稳定、可持续的自我照顾习惯。', '线上', now(), 'article', '心理科普', 0, 0)
on conflict do nothing;
