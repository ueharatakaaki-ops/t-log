-- 製品紹介サイトの「お問い合わせ」フォームから送信された内容を保存するテーブル。
-- 学校(schools)には紐付かない、サービス全体向けの問い合わせのため、既存の
-- is_staff()/current_school_id() を使ったRLSパターンとは別枠として扱う。
-- 未認証の公開フォームからの新規投稿のみを許可し、閲覧・更新・削除はどのロール
-- にも許可しない（閲覧はSupabaseダッシュボードのテーブルエディタから行う想定）。
-- anonのinsertはAPIを経由せずPostgRESTから直接も可能なため、zod
-- （lib/validations/contact.ts）と同じ上限をCHECK制約でDB側にも強制する。
create table if not exists public.contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  organization_name text not null check (char_length(organization_name) between 1 and 200),
  email text not null check (char_length(email) <= 320 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  message text not null check (char_length(message) between 1 and 4000),
  created_at timestamptz not null default now()
);

alter table public.contact_inquiries enable row level security;

create policy "anyone_can_submit_contact_inquiry"
  on public.contact_inquiries
  for insert
  to anon, authenticated
  with check (true);
