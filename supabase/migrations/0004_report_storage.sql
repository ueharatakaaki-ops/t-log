-- ============================================================
-- t-log: 月次レポートPDF格納用 Storage バケット
-- ファイルパス規約: {school_id}/{player_id}/{target_month}.pdf
-- ============================================================

insert into storage.buckets (id, name, public)
values ('monthly-reports', 'monthly-reports', false)
on conflict (id) do nothing;

-- パスの先頭セグメント（school_id）が自分の所属スクールと一致する場合のみ許可
create policy "monthly_reports_storage_select_staff"
on storage.objects for select
using (
  bucket_id = 'monthly-reports'
  and is_staff()
  and (storage.foldername(name))[1] = current_school_id()::text
);

-- 選手・保護者は自分（の子ども）のパスに含まれる published レポートのみ閲覧可。
-- ただしファイルパスだけでは published かどうか判別できないため、
-- 実際の配信はアプリ側で monthly_reports.status = 'published' を確認した上で
-- 署名付きURLを発行する運用とする（Storageの直接公開は行わない）。
create policy "monthly_reports_storage_select_family"
on storage.objects for select
using (
  bucket_id = 'monthly-reports'
  and (
    (storage.foldername(name))[2] = auth.uid()::text
    or is_my_child((storage.foldername(name))[2]::uuid)
  )
);

-- アップロードはstaffのみ（実際にはservice_role経由のPDF生成処理から書き込む）
create policy "monthly_reports_storage_insert_staff"
on storage.objects for insert
with check (
  bucket_id = 'monthly-reports'
  and is_staff()
  and (storage.foldername(name))[1] = current_school_id()::text
);
