-- ============================================================
-- t-log: 月次レポート項目の追加
-- Phase 0レビュー STEP8「コーチ確認・編集」項目のうち、
-- technical_evaluation（技術評価）と mental_evaluation（メンタル評価）が
-- 0001での定義に含まれていなかったため追加する。
-- ============================================================

alter table monthly_reports
  add column technical_evaluation text,
  add column mental_evaluation text;

comment on column monthly_reports.technical_evaluation is '2ページ目左カラム: 技術・戦術面の記録（コーチが日誌から抽出して記入）';
comment on column monthly_reports.mental_evaluation is '2ページ目右カラム: メンタル・取り組み姿勢の記録（コーチが記入）';
