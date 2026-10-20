// E2Eテストの後片付け: テストのブラウザ（UA に目印あり）が作ったログ記録の行だけを削除する。
// client_submit_logs はデモスクールの行に限る。テーブルが無い環境（マイグレーション適用前）では何もしない。
import "../../scripts/demo/env";
import { adminClient, findDemoSchool } from "../../scripts/demo/common";
import { E2E_UA_MARKER } from "./test-marker";

export default async function globalTeardown() {
  const pattern = `%${E2E_UA_MARKER}%`;

  const { count: authEvents, error: authError } = await adminClient
    .from("auth_link_events")
    .delete({ count: "exact" })
    .like("user_agent", pattern);
  if (authError && authError.code !== "PGRST205") throw new Error(`auth_link_events の削除に失敗: ${authError.message}`);

  const school = await findDemoSchool();
  let submitLogs = 0;
  if (school) {
    const { count, error } = await adminClient
      .from("client_submit_logs")
      .delete({ count: "exact" })
      .eq("school_id", school.id)
      .like("user_agent", pattern);
    if (error && error.code !== "PGRST205") throw new Error(`client_submit_logs の削除に失敗: ${error.message}`);
    submitLogs = count ?? 0;
  }

  if ((authEvents ?? 0) + submitLogs > 0) {
    console.log(`[teardown] テストのログ記録を削除: auth_link_events ${authEvents ?? 0} 行, client_submit_logs ${submitLogs} 行`);
  }
}
