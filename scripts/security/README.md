# RLS（Row Level Security）検証テスト

未成年のコンディション・健康情報を扱うため、ロール別のアクセス制御が意図通りに機能しているかを
実際のログイン・クエリを通じて検証するスクリプトです。ステージング環境（本番と同じRLS設定の
Supabaseプロジェクト）での実行を推奨します。**本番プロジェクトに対しては実行しないでください**
（テストユーザーとはいえ、実データと同じスクールに紛れ込むため）。

## 実行手順

```bash
# 1. テストユーザー・テストデータを作成
npm run test:rls:seed

# 2. RLSポリシーの検証を実行
npm run test:rls

# 3. 終わったらテストユーザー・データを削除
npm run test:rls:cleanup
```

## 検証している内容

| # | 検証内容 |
|---|---|
| 1 | 選手は自分のDaily Logを閲覧できる |
| 2 | 選手は**他の選手**のDaily Logを閲覧できない |
| 3 | 紐付けのない保護者は、他人の子どものDaily Logを閲覧できない |
| 4 | 紐付けのある保護者は、自分の子どものDaily Log（痛みの部位等の詳細含む）を閲覧できる |
| 5 | 選手・保護者は`coach_notes`の`internal`メモを閲覧できない |
| 6 | 選手・保護者は`coach_notes`の`shared_with_family`メモは閲覧できる |
| 7 | コーチ（staff）は`internal`/`shared_with_family`いずれも閲覧できる |
| 8 | 選手・保護者は`published`の月次レポートのみ閲覧でき、`draft`は閲覧できない |
| 9 | コーチは`draft`状態のレポートも閲覧できる |
| 10 | 選手は他選手のDaily Logを更新できない（UPDATE時もRLSが効くこと） |
| 11 | 選手は自分の`players`レコードを直接更新できない（プロフィール改ざん防止） |

いずれかが失敗した場合、スクリプトは失敗したテスト名とともに終了コード1で終了します。
CI（GitHub Actions等）に組み込み、マイグレーション変更時に自動実行することを推奨します。

## 前提

- `.env`に`SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`が設定されていること
- `supabase/config.toml`で`enable_signup = false`にしているため、テストユーザーは
  `seed-test-users.ts`内で`auth.admin.createUser`（service_role権限）を使って直接作成している
