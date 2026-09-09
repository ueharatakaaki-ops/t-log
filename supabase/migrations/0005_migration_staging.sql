-- ============================================================
-- t-log: 既存5〜8月データ移行用ステージングテーブル
-- Phase0レビュー STEP4準拠。
-- CSVの生データをそのまま（型変換前）投入し、クレンジング・名寄せ・
-- 変換はSQL/スクリプト側で行う。本番テーブルには直接書き込まない。
-- ============================================================

create table staging_daily_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  raw_timestamp text,       -- 元の「タイムスタンプ」列（欠損多数のため text のまま保持）
  raw_date text not null,   -- "2026/7/11" 等
  raw_player_name text not null, -- 表記揺れを含む生の氏名文字列
  raw_sleep_hours text,
  raw_fatigue_level text,
  raw_has_pain text,        -- "なし" / "あり"
  raw_pain_locations text,  -- "肘、膝" のような区切り文字列
  raw_self_score text,
  raw_notes text,
  raw_coach_message text,
  source_file text,         -- 取り込み元CSVファイル名（トレーサビリティ用）
  source_row_number int,    -- CSV内の行番号（デバッグ用）
  imported_at timestamptz not null default now()
);

create table staging_match_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  raw_player_name text not null,
  raw_match_date text not null,
  raw_tournament_name text,
  raw_tournament_grade text,
  raw_round text,
  raw_opponent_name text,
  raw_opponent_club text,
  raw_result text,          -- "勝ち" / "負け"
  raw_score text,
  raw_surface text,         -- "オムニ" 等（日本語表記のまま保持し、変換時にEnumへマップする）
  raw_good_points text,
  raw_bad_next_points text,
  source_file text,
  source_row_number int,
  imported_at timestamptz not null default now()
);

create table staging_goal_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  raw_player_name text not null,
  raw_target_month text not null, -- "2026年3月" 等、表記が揺れうる
  raw_technical_goal text,
  raw_physical_goal text,
  raw_action_plan text,
  source_file text,
  source_row_number int,
  imported_at timestamptz not null default now()
);

-- 移行作業専用テーブルのため、RLSは有効にしつつ staff（実質的には移行作業を行う
-- system_admin/school_admin）のみアクセス可能にする。通常運用のアプリ経路からは使わない。
alter table staging_daily_logs enable row level security;
alter table staging_match_logs enable row level security;
alter table staging_goal_logs enable row level security;

create policy staging_daily_logs_staff on staging_daily_logs for all
  using (school_id = current_school_id() and is_staff())
  with check (school_id = current_school_id() and is_staff());

create policy staging_match_logs_staff on staging_match_logs for all
  using (school_id = current_school_id() and is_staff())
  with check (school_id = current_school_id() and is_staff());

create policy staging_goal_logs_staff on staging_goal_logs for all
  using (school_id = current_school_id() and is_staff())
  with check (school_id = current_school_id() and is_staff());

-- migration_name_map への upsert（school_id, raw_name をキーとした冪等な再実行）を
-- 可能にするため、0001では定義していなかったUNIQUE制約を追加する。
alter table migration_name_map
  add constraint uq_migration_name_map_school_raw_name unique (school_id, raw_name);
