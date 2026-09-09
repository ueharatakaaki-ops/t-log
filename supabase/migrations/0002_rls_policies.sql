-- ============================================================
-- t-log: RLS（Row Level Security）ポリシー
-- Phase 1 - 権限分離
--
-- 方針:
--  - 全テーブルで school_id が current_school_id() と一致することを必須にする
--  - 選手は自分のデータのみ、コーチ/管理者は school 内の全選手データ、
--    保護者は紐づく子どものデータのみアクセス可能
--  - 「読める(select)」と「書ける(insert/update)」の範囲を別々に定義する
-- ============================================================

-- ------------------------------------------------------------
-- ヘルパー関数
-- ------------------------------------------------------------

-- 現在ログイン中ユーザーの school_id を取得
create or replace function current_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select school_id from app_users where id = auth.uid();
$$;

-- 現在ログイン中ユーザーのロールを取得
create or replace function current_role_name()
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from app_users where id = auth.uid();
$$;

-- 指定した player_id が、現在ログイン中の保護者の子どもかどうか
create or replace function is_my_child(target_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from parent_player_links
    where parent_id = auth.uid() and player_id = target_player_id
  );
$$;

-- 管理者・コーチ（school内の全選手データにアクセス可能なロール）かどうか
create or replace function is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select current_role_name() in ('school_admin', 'coach', 'system_admin');
$$;

-- ------------------------------------------------------------
-- RLS 有効化
-- ------------------------------------------------------------
alter table schools enable row level security;
alter table app_users enable row level security;
alter table players enable row level security;
alter table coaches enable row level security;
alter table parents enable row level security;
alter table parent_player_links enable row level security;
alter table coach_player_links enable row level security;
alter table daily_logs enable row level security;
alter table match_logs enable row level security;
alter table goal_logs enable row level security;
alter table coach_notes enable row level security;
alter table monthly_reports enable row level security;
alter table migration_name_map enable row level security;
alter table migration_duplicates enable row level security;
alter table audit_logs enable row level security;

-- ------------------------------------------------------------
-- schools: 自分の所属スクールのみ閲覧可。書き込みは system_admin のみ（アプリからは通常操作しない）
-- ------------------------------------------------------------
create policy schools_select on schools for select
  using (id = current_school_id());

-- ------------------------------------------------------------
-- app_users: 同じスクール内のユーザー情報は staff が閲覧可。本人は自分の分だけ閲覧可。
-- ------------------------------------------------------------
create policy app_users_select_self on app_users for select
  using (id = auth.uid());

create policy app_users_select_staff on app_users for select
  using (school_id = current_school_id() and is_staff());

-- ------------------------------------------------------------
-- players: 本人 / staff / 紐づく保護者 が閲覧可
-- ------------------------------------------------------------
create policy players_select on players for select
  using (
    school_id = current_school_id()
    and (
      id = auth.uid()
      or is_staff()
      or is_my_child(id)
    )
  );

create policy players_update_staff on players for update
  using (school_id = current_school_id() and is_staff());

-- ------------------------------------------------------------
-- coaches / parents: staff は閲覧可。本人は自分の分のみ
-- ------------------------------------------------------------
create policy coaches_select on coaches for select
  using (school_id = current_school_id() and (id = auth.uid() or is_staff()));

create policy parents_select on parents for select
  using (school_id = current_school_id() and (id = auth.uid() or is_staff()));

-- ------------------------------------------------------------
-- parent_player_links / coach_player_links: staff のみ管理。
-- 保護者・コーチは自分に関する行のみ閲覧可
-- ------------------------------------------------------------
create policy parent_links_select on parent_player_links for select
  using (
    parent_id = auth.uid()
    or exists (select 1 from app_users u where u.id = auth.uid() and is_staff() and u.school_id = current_school_id())
  );

create policy parent_links_manage_staff on parent_player_links for all
  using (exists (select 1 from app_users u where u.id = auth.uid() and is_staff()))
  with check (exists (select 1 from app_users u where u.id = auth.uid() and is_staff()));

create policy coach_links_select on coach_player_links for select
  using (
    coach_id = auth.uid()
    or exists (select 1 from app_users u where u.id = auth.uid() and is_staff() and u.school_id = current_school_id())
  );

create policy coach_links_manage_staff on coach_player_links for all
  using (exists (select 1 from app_users u where u.id = auth.uid() and is_staff()))
  with check (exists (select 1 from app_users u where u.id = auth.uid() and is_staff()));

-- ------------------------------------------------------------
-- daily_logs: 本人は自分のログをCRUD（当日分のみ更新を想定、アプリ側で制御）
--             staff は school 内の全選手ログをSELECT
--             保護者は紐づく子どものログをSELECT
--             ※ 保護者に「痛みの部位」等の詳細を見せるかは運用側の意思決定待ち。
--               ここでは一旦フルアクセスを許可し、要確認事項として README に明記する。
-- ------------------------------------------------------------
create policy daily_logs_select on daily_logs for select
  using (
    school_id = current_school_id()
    and (player_id = auth.uid() or is_staff() or is_my_child(player_id))
  );

create policy daily_logs_insert_self on daily_logs for insert
  with check (school_id = current_school_id() and player_id = auth.uid());

create policy daily_logs_update_self on daily_logs for update
  using (school_id = current_school_id() and player_id = auth.uid());

create policy daily_logs_update_staff on daily_logs for update
  using (school_id = current_school_id() and is_staff());

-- ------------------------------------------------------------
-- match_logs / goal_logs: daily_logs と同じパターン
-- ------------------------------------------------------------
create policy match_logs_select on match_logs for select
  using (school_id = current_school_id() and (player_id = auth.uid() or is_staff() or is_my_child(player_id)));

create policy match_logs_insert_self on match_logs for insert
  with check (school_id = current_school_id() and player_id = auth.uid());

create policy match_logs_update_self on match_logs for update
  using (school_id = current_school_id() and player_id = auth.uid());

create policy match_logs_update_staff on match_logs for update
  using (school_id = current_school_id() and is_staff());

create policy goal_logs_select on goal_logs for select
  using (school_id = current_school_id() and (player_id = auth.uid() or is_staff() or is_my_child(player_id)));

create policy goal_logs_insert_self on goal_logs for insert
  with check (school_id = current_school_id() and player_id = auth.uid());

create policy goal_logs_update_self on goal_logs for update
  using (school_id = current_school_id() and player_id = auth.uid());

create policy goal_logs_update_staff on goal_logs for update
  using (school_id = current_school_id() and is_staff());

-- ------------------------------------------------------------
-- coach_notes: staff のみ作成・編集可。
--   visibility = 'internal'   → staff のみ閲覧可
--   visibility = 'shared_with_family' → 本人選手・紐づく保護者も閲覧可
-- ------------------------------------------------------------
create policy coach_notes_select_staff on coach_notes for select
  using (school_id = current_school_id() and is_staff());

create policy coach_notes_select_family on coach_notes for select
  using (
    school_id = current_school_id()
    and visibility = 'shared_with_family'
    and (player_id = auth.uid() or is_my_child(player_id))
  );

create policy coach_notes_insert_staff on coach_notes for insert
  with check (school_id = current_school_id() and is_staff() and coach_id = auth.uid());

create policy coach_notes_update_staff on coach_notes for update
  using (school_id = current_school_id() and is_staff() and coach_id = auth.uid());

-- ------------------------------------------------------------
-- monthly_reports: draft/reviewed は staff のみ閲覧。published は本人・保護者も閲覧可
-- ------------------------------------------------------------
create policy monthly_reports_select_staff on monthly_reports for select
  using (school_id = current_school_id() and is_staff());

create policy monthly_reports_select_family on monthly_reports for select
  using (
    school_id = current_school_id()
    and status = 'published'
    and (player_id = auth.uid() or is_my_child(player_id))
  );

create policy monthly_reports_manage_staff on monthly_reports for all
  using (school_id = current_school_id() and is_staff())
  with check (school_id = current_school_id() and is_staff());

-- ------------------------------------------------------------
-- 移行系テーブル・監査ログ: staff（school_admin/system_admin想定）のみアクセス可
-- ------------------------------------------------------------
create policy migration_name_map_staff on migration_name_map for all
  using (school_id = current_school_id() and is_staff())
  with check (school_id = current_school_id() and is_staff());

create policy migration_duplicates_staff on migration_duplicates for all
  using (school_id = current_school_id() and is_staff())
  with check (school_id = current_school_id() and is_staff());

create policy audit_logs_select_staff on audit_logs for select
  using (school_id = current_school_id() and is_staff());

create policy audit_logs_insert_all on audit_logs for insert
  with check (school_id = current_school_id());
