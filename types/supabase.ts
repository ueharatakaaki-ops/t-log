/**
 * プレースホルダー型定義。
 *
 * 実際の型は、マイグレーション適用後に以下のコマンドで生成し、このファイルを置き換えること:
 *   npm run supabase:types
 *   (= supabase gen types typescript --local > types/supabase.ts)
 *
 * それまでの間、`Database`型は`any`ベースの緩い型とし、
 * テーブル名・カラム名の厳密なチェックは行われない（ビルドを通すためのつなぎ）。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
