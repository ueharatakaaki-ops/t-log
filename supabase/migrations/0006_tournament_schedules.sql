-- ============================================================
-- t-log: 大会スケジュール（出場予定）機能
-- ============================================================

create table tournament_schedules (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  school_id uuid not null references schools(id),
  tournament_name text not null,
  start_date date not null,
  end_date date,
  venue text,
  surface text check (surface in ('omni', 'clay', 'hard', 'indoor')),
  created_at timestamptz not null default now()
);

create index idx_tournament_schedules_player on tournament_schedules(player_id, start_date);
create index idx_tournament_schedules_school on tournament_schedules(school_id, start_date);

alter table tournament_schedules enable row level security;

create policy tournament_schedules_select on tournament_schedules for select
  using (
    school_id = current_school_id()
    and (player_id = auth.uid() or is_staff() or is_my_child(player_id))
  );

create policy tournament_schedules_insert_self on tournament_schedules for insert
  with check (school_id = current_school_id() and player_id = auth.uid());

create policy tournament_schedules_update_self on tournament_schedules for update
  using (school_id = current_school_id() and player_id = auth.uid());

create policy tournament_schedules_delete_self on tournament_schedules for delete
  using (school_id = current_school_id() and player_id = auth.uid());

create policy tournament_schedules_manage_staff on tournament_schedules for all
  using (school_id = current_school_id() and is_staff())
  with check (school_id = current_school_id() and is_staff());

-- Match Logをスケジュールから紐付けて投稿できるように、参照列を追加
alter table match_logs
  add column tournament_schedule_id uuid references tournament_schedules(id) on delete set null;

-- SNSカードで使う「コーチからのひとことコメント」欄
alter table match_logs
  add column coach_comment text;
