-- ============================================================
-- parent_player_links / coach_player_links の school 越境を防ぐ
--
-- 発覚の経緯:
-- 0002で定義した parent_links_manage_staff / coach_links_manage_staff
-- （for all ポリシー）は「操作者がstaffかどうか」だけを見ており、
-- parent_id / coach_id / player_id が操作者自身の school に属するかを
-- 一切確認していなかった。0002冒頭のコメントで謳っている方針
-- 「全テーブルで school_id が current_school_id() と一致することを必須にする」
-- を、この2テーブルだけ満たせていなかった。
--
-- 影響は二重にある:
--  1) with check が緩いため、あるスクールの school_admin/コーチが
--     admin/links の addParentLink/addCoachLink サーバーアクションに
--     直接POSTすることで、他校の選手IDと（自校か他校かを問わず）
--     任意の保護者IDを紐付けられてしまう。parent_player_links は
--     is_my_child() 経由で daily_logs（痛みの部位等の未成年の
--     健康情報を含む）へのアクセス可否に直結するため、この紐付けを
--     悪用されると他校の未成年の健康情報を閲覧できてしまう。
--  2) using（select/update/delete時の可視範囲）も同様にschool不問のため、
--     "for all" ポリシーはselectにも適用され、parent_links_select等の
--     school限定ポリシーとOR結合される結果、staffロールというだけで
--     全校のparent_player_links/coach_player_links行（＝どの保護者が
--     どの選手の親か、といった突合情報）を横断的に閲覧できてしまっていた。
--
-- 対応: parent_id/coach_id と player_id のいずれもが操作者の
-- current_school_id() に属することを using / with check の両方で必須にする。
-- （parents/coaches/players はいずれも school_id 列を持つため、
--   それぞれと突き合わせて確認する）
--
-- 追記（1回目の修正で見落としていた点）:
-- 上記の"manage_staff"（for all）を直しただけでは不十分だった。0002には
-- 別に parent_links_select / coach_links_select という select専用ポリシーが
-- あり、Postgresの permissive policy は同じコマンド（select）に対して
-- OR結合されるため、こちらが school 不問のままだと staff は依然として
-- 全校のリンク行を select できてしまう。
-- しかも parent_links_select / coach_links_select 内の
-- 「u.school_id = current_school_id()」は、どちらも auth.uid() の
-- app_usersを見ているだけで実質同じ値同士の比較になり、常に真になる
-- （＝何のフィルタにもなっていない）トートロジーだった。
-- この2つのselectポリシーも、manage_staffと同じ基準で選手のschoolを
-- 確認するよう修正する。
-- ============================================================

drop policy if exists parent_links_select on parent_player_links;
create policy parent_links_select on parent_player_links for select
  using (
    parent_id = auth.uid()
    or (
      exists (select 1 from app_users u where u.id = auth.uid() and is_staff() and u.school_id = current_school_id())
      and exists (select 1 from players p where p.id = player_id and p.school_id = current_school_id())
    )
  );

drop policy if exists coach_links_select on coach_player_links;
create policy coach_links_select on coach_player_links for select
  using (
    coach_id = auth.uid()
    or (
      exists (select 1 from app_users u where u.id = auth.uid() and is_staff() and u.school_id = current_school_id())
      and exists (select 1 from players p where p.id = player_id and p.school_id = current_school_id())
    )
  );

drop policy if exists parent_links_manage_staff on parent_player_links;
create policy parent_links_manage_staff on parent_player_links for all
  using (
    exists (select 1 from app_users u where u.id = auth.uid() and is_staff() and u.school_id = current_school_id())
    and exists (select 1 from parents pa where pa.id = parent_id and pa.school_id = current_school_id())
    and exists (select 1 from players p where p.id = player_id and p.school_id = current_school_id())
  )
  with check (
    exists (select 1 from app_users u where u.id = auth.uid() and is_staff() and u.school_id = current_school_id())
    and exists (select 1 from parents pa where pa.id = parent_id and pa.school_id = current_school_id())
    and exists (select 1 from players p where p.id = player_id and p.school_id = current_school_id())
  );

drop policy if exists coach_links_manage_staff on coach_player_links;
create policy coach_links_manage_staff on coach_player_links for all
  using (
    exists (select 1 from app_users u where u.id = auth.uid() and is_staff() and u.school_id = current_school_id())
    and exists (select 1 from coaches c where c.id = coach_id and c.school_id = current_school_id())
    and exists (select 1 from players p where p.id = player_id and p.school_id = current_school_id())
  )
  with check (
    exists (select 1 from app_users u where u.id = auth.uid() and is_staff() and u.school_id = current_school_id())
    and exists (select 1 from coaches c where c.id = coach_id and c.school_id = current_school_id())
    and exists (select 1 from players p where p.id = player_id and p.school_id = current_school_id())
  );
