-- ============================================================
-- t-log: 初期スキーマ定義
-- Phase 1 - DB構築
-- 設計方針: school_id を全テーブルに含め、将来のマルチテナント化に
-- テーブル追加・大規模改修なしで対応できるようにする。
-- ============================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid() 用

-- ------------------------------------------------------------
-- テナント（スクール）
-- ------------------------------------------------------------
create table schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,                    -- 例: "NLTC"
  slug text not null unique,             -- 例: "nltc"
  brand_colors jsonb default '{
    "primary": "#0f172a",
    "accent": "#10b981",
    "background": "#f1f5f9",
    "alert": "#f43f5e"
  }'::jsonb,
  plan text not null default 'internal', -- 将来の料金プラン。今は使わない
  created_at timestamptz not null default now()
);

comment on table schools is 'テナント。将来の他校SaaS展開に備えたスクール単位のデータ分離の起点。';

-- 初期データ: NLTC を1校のみ登録
insert into schools (name, slug) values ('NLTC', 'nltc');

-- ------------------------------------------------------------
-- 認証共通ユーザー（Supabase Authと1:1）
-- ------------------------------------------------------------
create type app_role as enum ('system_admin', 'school_admin', 'coach', 'player', 'parent');

create table app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references schools(id),
  role app_role not null,
  display_name text not null,
  created_at timestamptz not null default now()
);

comment on table app_users is '認証共通テーブル。ロール別の詳細プロフィールは players/coaches/parents に分離する。';

create index idx_app_users_school on app_users(school_id);

-- ------------------------------------------------------------
-- 選手プロフィール
-- ------------------------------------------------------------
create table players (
  id uuid primary key references app_users(id) on delete cascade,
  school_id uuid not null references schools(id),
  legacy_name text,                      -- 旧Googleスプレッドシート上の表記（移行トレース用）
  full_name text not null,
  birthdate date,
  grade text,                            -- 例: "高2"
  category text,                         -- 例: U12 / U14 / U15 / U18（初期はCHECK制約で固定、将来マスタ化）
  joined_at date,
  status text not null default 'active' check (status in ('active', 'graduated', 'withdrawn')),
  created_at timestamptz not null default now(),
  constraint chk_players_category check (
    category is null or category in ('U12', 'U14', 'U15', 'U18')
  )
);

create index idx_players_school on players(school_id);
create index idx_players_status on players(school_id, status);

-- ------------------------------------------------------------
-- コーチ / 保護者プロフィール
-- ------------------------------------------------------------
create table coaches (
  id uuid primary key references app_users(id) on delete cascade,
  school_id uuid not null references schools(id),
  title text                             -- 例: "ヘッドコーチ"
);

create table parents (
  id uuid primary key references app_users(id) on delete cascade,
  school_id uuid not null references schools(id)
);

-- 保護者 ⇔ 選手（多対多）
create table parent_player_links (
  parent_id uuid not null references parents(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  primary key (parent_id, player_id)
);

-- コーチ ⇔ 担当選手（多対多）。初期運用は全コーチが全選手を閲覧可能だが、
-- 将来の担当制導入に備えてテーブルは先に用意する。
create table coach_player_links (
  coach_id uuid not null references coaches(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  primary key (coach_id, player_id)
);

-- ------------------------------------------------------------
-- Daily Log（日次コンディション記録）
-- ------------------------------------------------------------
create table daily_logs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  school_id uuid not null references schools(id),
  log_date date not null,
  sleep_hours numeric(3,1),
  fatigue_level smallint check (fatigue_level between 1 and 10),
  has_pain boolean not null default false,
  pain_locations text[] default '{}',    -- 例: ['肘','肩']
  self_score smallint check (self_score between 1 and 10),
  notes text,
  coach_message text,
  source text not null default 'app' check (source in ('app', 'migrated')),
  created_at timestamptz not null default now(),
  unique (player_id, log_date)
);

create index idx_daily_logs_player_date on daily_logs(player_id, log_date desc);
create index idx_daily_logs_school_date on daily_logs(school_id, log_date desc);
-- アラート集計（疲労度8以上・痛みあり）を高速化するための部分インデックス
create index idx_daily_logs_alert on daily_logs(school_id, log_date) where has_pain = true or fatigue_level >= 8;

-- ------------------------------------------------------------
-- Match Log（試合結果）
-- ------------------------------------------------------------
create table match_logs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  school_id uuid not null references schools(id),
  match_date date not null,
  tournament_name text not null,
  tournament_grade text,
  round text,
  opponent_name text,
  opponent_club text,
  result text check (result in ('win', 'lose')),
  score text,
  surface text check (surface in ('omni', 'clay', 'hard', 'indoor')),
  good_points text,
  bad_next_points text,
  source text not null default 'app' check (source in ('app', 'migrated')),
  created_at timestamptz not null default now()
);

create index idx_match_logs_player_date on match_logs(player_id, match_date desc);

-- ------------------------------------------------------------
-- Goal Log（月次目標）
-- ------------------------------------------------------------
create table goal_logs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  school_id uuid not null references schools(id),
  target_month date not null,            -- 月初日で正規化（例: 2026-07-01）
  technical_goal text,
  physical_goal text,
  action_plan text,
  coach_feedback text,
  source text not null default 'app' check (source in ('app', 'migrated')),
  created_at timestamptz not null default now(),
  unique (player_id, target_month)
);

-- ------------------------------------------------------------
-- コーチメモ
-- ------------------------------------------------------------
create table coach_notes (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  coach_id uuid not null references coaches(id),
  school_id uuid not null references schools(id),
  content text not null,
  visibility text not null default 'internal' check (visibility in ('internal', 'shared_with_family')),
  created_at timestamptz not null default now()
);

create index idx_coach_notes_player on coach_notes(player_id, created_at desc);

-- ------------------------------------------------------------
-- 月次レポート
-- ------------------------------------------------------------
create table monthly_reports (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  school_id uuid not null references schools(id),
  target_month date not null,
  status text not null default 'draft' check (status in ('draft', 'reviewed', 'published')),
  summary_stats jsonb,                   -- 自動集計スナップショット（平均睡眠・平均疲労・入力日数・試合数など）
  connect_text text,
  agreed_theme text,
  agreed_notes text,
  pdf_path text,                         -- Supabase Storage 上のパス（署名付きURLは配信時に生成）
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (player_id, target_month)
);

-- ------------------------------------------------------------
-- 移行トレーサビリティ
-- ------------------------------------------------------------
create table migration_name_map (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  raw_name text not null,                -- スプレッドシート上の表記（表記揺れ含む）
  resolved_player_id uuid references players(id),
  confidence text not null default 'manual' check (confidence in ('auto', 'manual')),
  created_at timestamptz not null default now()
);

create table migration_duplicates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  source_table text not null,            -- 'daily_logs' 等
  raw_data jsonb not null,               -- 採用されなかった側の生データを保持
  reason text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 監査ログ（最小限: センシティブデータの閲覧・編集を記録）
-- ------------------------------------------------------------
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id),
  actor_id uuid not null references app_users(id),
  action text not null,                  -- 'view' / 'create' / 'update' / 'delete'
  target_table text not null,
  target_id uuid,
  created_at timestamptz not null default now()
);

create index idx_audit_logs_school_time on audit_logs(school_id, created_at desc);
