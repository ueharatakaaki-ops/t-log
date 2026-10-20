// E2Eテストのブラウザが送る UA の末尾に付ける目印。
// 本番でテストを実行すると、ログ記録（client_submit_logs・auth_link_events）にもテストの行ができるため、
// 実際の利用者の行と区別して、テスト後に目印の付いた行だけを削除できるようにする（global-teardown.ts）。
export const E2E_UA_MARKER = "t-log-e2e";

export function withMarker(userAgent: string): string {
  return `${userAgent} ${E2E_UA_MARKER}`;
}

/** browser.newContext() で作る「別の端末」用の UA（プロジェクトの設定は引き継がれないため、明示する） */
export const DEFAULT_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
