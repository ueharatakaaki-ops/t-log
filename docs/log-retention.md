# 記録テーブルの保持期間（90日）

診断用の記録テーブルは、**90日より古い行を削除する**運用とする。自動では実行しない。
必要なときに、Supabase ダッシュボードの **SQL Editor** で手作業で実行する。

| テーブル | 中身 | マイグレーション |
| --- | --- | --- |
| `client_submit_logs` | 日次ログ送信の経過（結果・各試行・きっかけ。入力内容は含まない） | `0014_client_submit_logs.sql` |
| `auth_link_events` | 招待・再設定リンク／コード入力の診断（メール・token_hash・URL・IP は含まない） | `0015_auth_link_events.sql` |

どちらも `created_at`（timestamptz）に索引があるため、日付での絞り込みは速い。

## 手順

### 1. 削除される件数を先に確認する（何も変更しない）

```sql
select
  (select count(*) from public.client_submit_logs where created_at < now() - interval '90 days') as client_submit_logs_to_delete,
  (select count(*) from public.auth_link_events  where created_at < now() - interval '90 days') as auth_link_events_to_delete;
```

### 2. 削除する（1回のトランザクションで、両方まとめて）

```sql
begin;

delete from public.client_submit_logs where created_at < now() - interval '90 days';
delete from public.auth_link_events  where created_at < now() - interval '90 days';

commit;
```

SQL Editor は各 `delete` の件数を表示する。手順1の件数と一致することを確認する。
途中で止めたい場合は `commit;` の代わりに `rollback;` を実行すれば、何も削除されない。

### 3. 残っている最も古い行を確認する（任意）

```sql
select
  (select min(created_at) from public.client_submit_logs) as client_submit_logs_oldest,
  (select min(created_at) from public.auth_link_events)  as auth_link_events_oldest;
```

どちらも、実行日から90日以内（または行が無ければ null）になっていればよい。

## 注意

- 対象は上の2テーブルだけ。`daily_logs` などの記録本体や `audit_logs` には触れない。
- `now()` はデータベースの時刻（UTC）基準。90日の境界は、日本時間とは最大9時間ずれるが、保持期間の運用上は問題ない。
- E2E テストが本番で作った行（UA に `t-log-e2e` を含む）は、テスト終了時に自動で削除される（`tests/e2e/global-teardown.ts`）。
  この手順で消す必要はない。
