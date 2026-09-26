-- 製品紹介サイトの「お問い合わせ」フォームから送信された内容を保存するテーブル。
-- 学校(schools)には紐付かない、サービス全体向けの問い合わせのため、既存の
-- is_staff()/current_school_id() を使ったRLSパターンとは別枠として扱う。
-- 未認証の公開フォームからの新規投稿のみを許可し、閲覧・更新・削除はどのロール
-- にも許可しない（閲覧はSupabaseダッシュボードのテーブルエディタから行う想定）。
create table if not exists public.contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organization_name text not null,
  email text not null,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.contact_inquiries enable row level security;

create policy "anyone_can_submit_contact_inquiry"
  on public.contact_inquiries
  for insert
  to anon, authenticated
  with check (true);
