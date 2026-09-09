# t-log — Phase 1: DB・認証

Phase 0の設計レビューに基づく、DBスキーマ・RLS・認証基盤の初期実装です。

## セットアップ手順

1. Supabaseプロジェクトを新規作成（ダッシュボード or `supabase init`）
2. `.env.example` を `.env.local` にコピーし、Project Settings > API の値を設定
3. マイグレーションを適用
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   # またはローカル開発の場合
   supabase start
   supabase migration up
   ```
4. `npm install` → `npm run supabase:types` でTypeScript型を生成（`types/supabase.ts`）
5. `npm run dev` で起動

## このPhaseで実装した内容

- `supabase/migrations/0001_init_schema.sql`: 全テーブルのDDL（schools/app_users/players/coaches/parents/daily_logs/match_logs/goal_logs/coach_notes/monthly_reports/移行系テーブル/audit_logs）
- `supabase/migrations/0002_rls_policies.sql`: ロール別のRow Level Securityポリシー
- `lib/supabase/client.ts` / `server.ts`: Next.js App Router用のSupabaseクライアント（クライアント/サーバー/管理者用の3種類）
- `middleware.ts`: 未ログイン時のリダイレクト処理
- `supabase/config.toml`: セルフサインアップ無効化（**招待制**。選手・保護者アカウントはスタッフが作成する運用を前提）

## ユーザー作成フロー（招待制）の設計メモ

`enable_signup = false` にしているため、選手・コーチ・保護者は以下の流れで作成する想定です（Phase 2以降で管理画面から実装）:

1. school_admin が管理画面から「選手を招待」を実行（メールアドレス or 電話番号を入力）
2. `supabase.auth.admin.inviteUserByEmail()` 等（service_role権限、サーバーサイドのみ）で招待
3. 招待メール内リンクからパスワード設定
4. サインアップ完了と同時に `app_users` + `players`（or `coaches`/`parents`）へのレコード作成をサーバー側で実行（`auth.users` へのINSERTトリガーではなく、招待APIを呼ぶ管理画面側の処理で明示的に行う方針。理由: ロール・school_id・選手プロフィール情報を同時に確定させる必要があり、DBトリガーだけでは情報が不足するため）

## NLTC側の決定事項（2026年9月確認済み）

| 項目 | 決定内容 | 影響箇所 |
|---|---|---|
| 認証方式 | Supabase Auth（メール/電話）。LINEは通知・導線用に別途連携 | `middleware.ts`, 招待フロー |
| コーチの担当制 | 導入しない。全コーチが全選手を閲覧・フォロー可（`coach_player_links`はテーブルのみ用意し、将来の担当制導入時に条件追加） | `0002_rls_policies.sql` の `is_staff()` |
| 保護者への健康情報開示範囲 | **全データ閲覧可**（睡眠・疲労度・痛みの部位を含む生データ）。月次レポートでも同内容を開示している実績に合わせる | `daily_logs_select` 等のRLS（実装済み・変更不要） |
| コーチメモの公開範囲 | `visibility`フラグで制御、デフォルト`internal` | `coach_notes` テーブル・RLS |
| 選手規模 | 初期10〜20名。将来SaaS化で数百〜数千名規模を想定（インデックス設計は既にこの規模を見込んだ内容） | - |
| 退会・卒業選手のデータ | `status`（active/graduated/withdrawn）で管理し、一定期間ログ・PDFを保持 | `players.status` |

## 月次PDFレポート機能について

- `supabase/migrations/0003_monthly_report_evaluations.sql`: `technical_evaluation`/`mental_evaluation`列を追加
- `supabase/migrations/0004_report_storage.sql`: PDF格納用Storageバケット`monthly-reports`とRLSを追加
- `/reports/manage` : 対象月ごとの選手別レポート状況一覧。未生成なら「下書き生成」ボタンで自動集計を実行
- `/reports/manage/[id]` : コーチが技術評価・メンタル評価・CONNECT・合意形成メモを入力し、「公開してPDF発行」でPDF生成
  - ※選手・保護者向けの一覧は`/reports`にあるため、コーチ用の管理画面は`/reports/manage`配下に分けている（同じ`/reports`パスに2つのpage.tsxが解決されるとNext.jsのビルドが失敗するため）
- PDF生成は Puppeteer（本番はサーバーレス向けに`@sparticuz/chromium`+`puppeteer-core`、ローカル開発は`puppeteer`）を使用。`lib/pdf/report-template.ts`のHTMLテンプレートをChart.js込みでレンダリングしPDF化する
- 生成されたPDFはSupabase Storageの`monthly-reports`バケットに`{school_id}/{player_id}/{target_month}.pdf`の形式で保存し、閲覧は毎回**署名付きURL（10分間有効）**を発行する方式（直接公開URLにはしない）
- `published`ステータスになったレポートは自動再生成・上書きされない（過去に発行した内容の再現性を保証するため）

### 未実装・要検討

- レポート生成のバッチ化（現在はコーチが手動で「下書き生成」を押す運用。将来的には月初にVercel Cronで全選手分を自動生成する案あり）
- Puppeteer関連パッケージ（`puppeteer-core`, `@sparticuz/chromium`, 開発用`puppeteer`）は`npm install`が必要

## 選手・保護者向けレポート閲覧画面

- `/reports`（選手ロール）: 自分のバックナンバー一覧をそのまま表示
- `/reports`（保護者ロール）: 子どもが1人ならそのままバックナンバーを表示、複数いる場合は選択画面を挟んで`/reports/[playerId]`へ
- `lib/auth/require-family.ts`: 選手/保護者専用ページの認可チェック（`parent_player_links`から閲覧可能な子どもを解決）
- 一覧はタップのたびに`getSignedReportUrl`（`lib/reports/get-signed-report-url.ts`、コーチ画面と共通）で新しい署名付きURLを発行してから開く方式にし、URLの使い回し・共有をしても10分で失効するようにしています
- `published`ステータスのレポートのみが表示対象（`draft`/`reviewed`中の内容は選手・保護者には一切見えない）

## 既存5〜8月データの移行

`scripts/migration/README.md` を参照してください。ステージング投入→選手名の名寄せ（人間の確認必須）→クレンジング・変換・本番投入→Looker Studioとの突合検証、の4ステップです。

## 管理者機能: 招待フロー・紐付け管理

- `/admin/users`: スクール内のユーザー一覧、`/admin/users/invite`から選手・コーチ・保護者・スクール管理者を招待
  - 招待は`supabase.auth.admin.inviteUserByEmail`でメール送信し、同時に`app_users`＋ロール別プロフィール（`players`/`coaches`/`parents`）を作成する
  - `school_admin`ロールの発行は`system_admin`のみ許可（権限昇格の防止）
  - アカウント作成の成否に関わらず`audit_logs`に記録（`lib/audit/log.ts`）
- `/admin/links`: 保護者⇔選手（`parent_player_links`）、コーチ⇔担当選手（`coach_player_links`）の紐付け管理
  - コーチの担当制は現運用では未使用（全コーチが全選手を閲覧可）だが、将来の担当制導入に備えて画面自体は用意している
- いずれも`lib/auth/require-admin.ts`で`school_admin`/`system_admin`のみに制限（`coach`ロールはアクセス不可）

## セキュリティ検証: RLSテスト

`scripts/security/README.md` を参照してください。選手・保護者・コーチそれぞれでログインし、
「他人のデータが見えないこと」「`coach_notes`のinternalメモが遮断されていること」
「`draft`レポートが選手・保護者から見えないこと」等をRLSレベルで検証する統合テストです。

## 通し動作確認の前に実施した静的レビュー・修正

`npm install`を実際に実行できる環境がなかったため、代わりにビルドが通る状態かを静的にレビューし、以下の不備を修正しました。

| 問題 | 内容 | 対応 |
|---|---|---|
| **URL衝突（ビルドエラーになる不具合）** | `app/(coach)/reports/`と`app/(family)/reports/`が両方とも`/reports`に解決されていた（route groupはURLに影響しないため） | コーチ用のレポート管理画面を`/reports/manage`・`/reports/manage/[id]`に移動 |
| `tsconfig.json`がなかった | 全体で使っている`@/`パスエイリアスが解決できない | 追加（`@/* → ./*`） |
| `app/layout.tsx`がなかった | App Routerのルートレイアウトは必須 | 追加 |
| `/login`ページの実体がなかった | `middleware.ts`が参照しているのに存在しなかった | ログイン画面・招待リンク受け皿（`/auth/callback`）・初回パスワード設定画面（`/auth/set-password`）を追加 |
| Tailwind設定一式がなかった | `tailwind.config.ts`/`postcss.config.js`/`app/globals.css`がなく、これまでのTailwindクラスが効かない状態だった | 追加 |
| `types/supabase.ts`が存在しないのに参照されていた | `supabase gen types`実行前は型エラーになる | `Database = any`のプレースホルダーを追加（生成後に置き換えてください） |
| `lib/supabase/server.ts`で動的`require`を使用 | Next.jsのビルド環境と相性が悪い書き方だった | 静的importに変更 |
| `next.config.js`のキー名がNext.js 15と不一致 | `experimental.serverComponentsExternalPackages`はNext 14までの書き方 | トップレベルの`serverExternalPackages`に修正 |

このほか、全`@/`importが実在するファイル・exportを指しているかをスクリプトで機械的に検証済みです（named exportの検証も含む）。

## 私（Claude）が実行できなかったこと・お願いしたいこと

このサンドボックス環境にはネットワーク接続がなく、実在のSupabaseプロジェクトも用意されていないため、以下は**実際にお手元の環境で実行して結果を教えてください**:

1. `npm install`（上記の静的レビューで依存パッケージの構文・importは確認済みですが、実際のインストール・型解決はご確認をお願いします）
2. `supabase link` → `supabase db push`（マイグレーション0001〜0005が順番に当たるか）
3. `npm run dev` でローカル起動し、`next build`が通ること
4. `npm run test:rls:seed && npm run test:rls`（実際のRLSポリシーに対する検証）
5. 各ロールでの実画面確認（招待→パスワード設定→ログイン→該当ロールの画面遷移）

エラーが出た場合は、エラーメッセージをそのまま共有していただければ、続けて調査・修正します。
