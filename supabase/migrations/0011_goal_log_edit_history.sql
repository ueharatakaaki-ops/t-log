-- 目標（Goal Log）の本文（技術目標・フィジカル目標・アクションプラン）を選手が
-- 後から書き換えた場合に、「いつ・何が変わったか」をコーチが確認できるようにする。
-- Daily Logと同様、対象月が始まってからの後出し修正は禁止する方針とし
-- （lib/date.ts の isGoalLogEditable を参照）、まだ対象月が始まる前の修正のみ許可した上で、
-- 修正する度に「修正前の内容」をこのテーブルに1行残す。

create table goal_log_edits (
  id uuid primary key default gen_random_uuid(),
  goal_log_id uuid not null references goal_logs(id) on delete cascade,
  player_id uuid not null references players(id),
  school_id uuid not null references schools(id),
  target_month date not null,
  previous_technical_goal text,
  previous_physical_goal text,
  previous_action_plan text,
  edited_at timestamptz not null default now()
);

create index idx_goal_log_edits_goal on goal_log_edits(goal_log_id, edited_at desc);

alter table goal_log_edits enable row level security;

-- 選手本人が自分の目標を修正した際に、修正前の内容を保存する（app/(player)/goal-log/actions.ts から）
create policy goal_log_edits_insert_self on goal_log_edits for insert
  with check (school_id = current_school_id() and player_id = auth.uid());

-- 選手本人と、スタッフ（コーチ・スクール管理者）が閲覧できる。保護者には見せない
-- （目標本文自体を保護者には非表示にしている方針 [0010] と揃える）。
create policy goal_log_edits_select on goal_log_edits for select
  using (school_id = current_school_id() and (player_id = auth.uid() or is_staff()));
