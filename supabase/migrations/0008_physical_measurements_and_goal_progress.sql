-- 選手のパーソナルデータ（身長・体重・視力・握力などの身体測定値、および利き手・
-- ラケット・シューズ・ガットなどの用具情報）を記録するテーブル。
-- 身長・体重・握力などは成長期のジュニア選手だと時間とともに変化していく値のため、
-- players テーブルへ単純に「現在値」の列を足すのではなく、daily_logs と同じように
-- 日付つきで記録が積み重なっていく形にする（あとから成長の推移を追えるようにするため）。
-- 用具情報（利き手・ラケット・シューズ・ガット）は測定日ごとに変化するものではないが、
-- 画面をひとつにまとめたいため同じテーブルに含め、入力時は前回値を引き継いで表示する想定。
create table physical_measurements (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  school_id uuid not null references schools(id),
  measured_date date not null,
  height_cm numeric(5, 1),
  weight_kg numeric(5, 1),
  eyesight_left numeric(3, 1),
  eyesight_right numeric(3, 1),
  grip_strength_left numeric(5, 1),
  grip_strength_right numeric(5, 1),
  dominant_hand text check (dominant_hand in ('right', 'left')),
  racket text,
  shoes text,
  strings text,
  source text not null default 'app' check (source in ('app', 'migrated')),
  created_at timestamptz not null default now(),
  unique (player_id, measured_date)
);

create index idx_physical_measurements_player_date on physical_measurements(player_id, measured_date desc);

alter table physical_measurements enable row level security;

-- daily_logs / match_logs / goal_logs と同じパターン：
-- 本人が自分の記録をCRUD、staffはschool内の全選手をSELECT、保護者は紐づく子どもをSELECT
create policy physical_measurements_select on physical_measurements for select
  using (
    school_id = current_school_id()
    and (player_id = auth.uid() or is_staff() or is_my_child(player_id))
  );

create policy physical_measurements_insert_self on physical_measurements for insert
  with check (school_id = current_school_id() and player_id = auth.uid());

create policy physical_measurements_update_self on physical_measurements for update
  using (school_id = current_school_id() and player_id = auth.uid());

create policy physical_measurements_update_staff on physical_measurements for update
  using (school_id = current_school_id() and is_staff());

-- 目標（goal_logs）の進捗％。選手が自分でいつでもタップして更新できる想定
-- （コーチの確認は挟まない運用でよいと確認済みのため、承認フロー等は設けない）。
alter table goal_logs
  add column progress_percent smallint check (progress_percent between 0 and 100);
