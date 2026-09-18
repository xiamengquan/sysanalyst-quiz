-- 用户刷题/案例进度（JSONB 快照，每用户一行）
-- 在 Supabase Dashboard → SQL Editor 执行本文件。
-- 题库正文不上云，仅存进度。

create table if not exists public.user_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  quiz jsonb not null default '{}'::jsonb,
  case_drafts jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.user_progress is '刷题站云端进度：quiz=QuizPersist，case_drafts=案例草稿';
comment on column public.user_progress.quiz is '对应 IndexedDB key sysanalyst_quiz_v4';
comment on column public.user_progress.case_drafts is '对应 IndexedDB key sysanalyst_case_v1';

alter table public.user_progress enable row level security;

drop policy if exists "own_select" on public.user_progress;
drop policy if exists "own_insert" on public.user_progress;
drop policy if exists "own_update" on public.user_progress;

create policy "own_select" on public.user_progress
  for select using (auth.uid() = user_id);

create policy "own_insert" on public.user_progress
  for insert with check (auth.uid() = user_id);

create policy "own_update" on public.user_progress
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
