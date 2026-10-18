/**
 * デモ用スクリプトの環境変数読み込み。
 * このリポジトリでは接続情報を .env.local に置いているため、.env.local → .env の順に読む
 * （dotenv は既に設定済みの値を上書きしないため、先に読んだ .env.local が優先される）。
 * scripts/migration/client.ts は読み込み時に環境変数を参照するため、必ずそれより先に import すること。
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();
