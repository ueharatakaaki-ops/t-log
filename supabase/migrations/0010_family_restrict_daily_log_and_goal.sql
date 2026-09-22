-- 保護者アカウントから見える範囲を絞る対応。
-- うえはらさんの方針: 保護者はDaily Log（日々のコンディション記録）と
-- 月次目標（Goal Log）を一切閲覧できないようにする。選手本人とコーチ（staff）
-- のみ閲覧可能とする。試合記録・身体データ・公開済み月次レポート・
-- 家族共有設定のコーチメモは従来通り保護者も閲覧可能のまま変更しない。
--
-- 0002_rls_policies.sql で定義した daily_logs_select / goal_logs_select から
-- is_my_child(player_id) の条件のみを取り除く（本人・staffの条件は維持）。
-- drop + create で再定義する（再実行しても安全なようDROP POLICY IF EXISTSを使う）。

drop policy if exists daily_logs_select on daily_logs;
create policy daily_logs_select on daily_logs for select
  using (
    school_id = current_school_id()
    and (player_id = auth.uid() or is_staff())
  );

drop policy if exists goal_logs_select on goal_logs;
create policy goal_logs_select on goal_logs for select
  using (school_id = current_school_id() and (player_id = auth.uid() or is_staff()));
