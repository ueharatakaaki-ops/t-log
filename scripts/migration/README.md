# 既存5〜8月データ移行スクリプト

Phase0レビュー STEP4の方針（既存データを壊さず移行する）に沿った、4ステップの移行フローです。

## 事前準備

1. `.env.local` の環境変数に加えて、このスクリプト実行時のみ以下を設定してください（`service_role`キーのため、CIやアプリのビルド環境には置かないこと）:
   ```
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```
2. Googleスプレッドシートを、**変更不可のバックアップとして**CSVエクスポートし、`raw_backup/`配下に保存してください（このディレクトリはGit管理外にすることを推奨。`.gitignore`に追加済み）。
3. `npm install` 済みであること（`tsx`, `papaparse`, `string-similarity`等を使用）。

## 実行手順

### Step 1: ステージングテーブルへの取り込み

```bash
npm run migrate:load-staging -- --type=daily --file=raw_backup/daily_2026-05.csv
npm run migrate:load-staging -- --type=daily --file=raw_backup/daily_2026-06.csv
npm run migrate:load-staging -- --type=daily --file=raw_backup/daily_2026-07.csv
npm run migrate:load-staging -- --type=daily --file=raw_backup/daily_2026-08.csv
npm run migrate:load-staging -- --type=match --file=raw_backup/match_2026-05.csv
# ...月ごと・ログ種別ごとに繰り返す
npm run migrate:load-staging -- --type=goal  --file=raw_backup/goal_2026-05.csv
```

CSVパースで警告が出た場合（セル内改行によるMatch Logの列崩れなど）は、該当行を`raw_backup`のCSV側で手動修正してから再実行してください。

### Step 2: 選手名の名寄せ

```bash
npm run migrate:build-name-map -- --mode=suggest
```

`scripts/migration/name-map-review.json` が生成されます。完全一致した氏名は自動登録済みですが、それ以外（表記ゆれを含む可能性がある行）は必ず内容を確認してください。特に「赤本 大地」「赤本 大地門」のようなケースでは、`resolvedPlayerId`が正しい選手を指しているか目視で確認し、誤りがあれば修正してください。該当する選手がいない場合は`resolvedPlayerId`を`null`のままにしてください。

確認が終わったら反映します:

```bash
npm run migrate:build-name-map -- --mode=apply --file=scripts/migration/name-map-review.json
```

### Step 3: クレンジング・変換・本番投入

```bash
npm run migrate:transform-load -- --type=all
```

日付変換、数値の範囲チェック、部位の分割、ラウンド/サーフェス/勝敗の日本語→Enum変換、重複排除（同一選手・同一日付/月はタイムスタンプが新しい方を採用）を行い、`daily_logs`/`match_logs`/`goal_logs`へ`source='migrated'`として投入します。

未解決の氏名や解釈できない日付があった場合は`scripts/migration/transform-errors.json`に出力されるので、内容を確認し、必要であれば元CSVを修正してStep1からやり直してください。

### Step 4: 突合検証

```bash
npm run migrate:verify
```

ステージング件数・本番投入件数・重複退避件数に加え、選手別・月別の平均睡眠時間/平均疲労度を出力します。これをLooker Studioダッシュボード上の同一選手・同一月の値と目視で突き合わせ、一致することを確認してください。

一致が確認できたら、旧Googleフォームは止めずに1〜2週間並行入力し、差分がないことを確認したうえで完全移行としてください（Phase0レビュー STEP4参照）。

## 再実行について

- Step1〜3は冪等になるよう設計していますが、Step1（ステージング投入）は再実行すると重複して積まれるため、CSVを修正して再取り込みする場合は該当`source_file`のステージング行を先に削除してから実行してください。
- Step3（daily_logs/goal_logs）は`upsert`のため再実行しても安全です。`match_logs`は一意制約がないため、Step1からやり直す場合は本番の`match_logs`側で`source='migrated'`かつ該当期間のレコードを削除してから再実行してください。
