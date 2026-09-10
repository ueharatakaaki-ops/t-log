-- ============================================================
-- 選手の日誌コメントに対して、コーチが「いいね」できるようにする
-- 追加のRLSポリシーは不要（0002_rls_policies.sql の daily_logs_update_staff
-- で school 内の staff は既に daily_logs を更新できるため）。
-- ============================================================

alter table daily_logs
  add column liked_by_coach_id uuid references coaches(id),
  add column liked_by_coach_at timestamptz;
