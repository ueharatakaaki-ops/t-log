// 送信経過（client_submit_logs）とリンクの診断（auth_link_events）が記録されることの確認。
// フラグ（CLIENT_LOG_ENABLED 等）が有効なサーバーに対してだけ意味があるため、E2E_LOGGING=1 のときだけ実行する:
//   E2E_LOGGING=1 E2E_BASE_URL=https://... npx playwright test tests/e2e/logging.spec.ts --project=chromium
// デモスクールの「デモ 花子」（ダミー）だけを使う。確認に使った行は service role で削除する
// （本人のセッションには削除権限がないため）。
import { randomBytes } from "node:crypto";
import { test, expect as baseExpect } from "@playwright/test";
import "../../scripts/demo/env";
import { adminClient } from "../../scripts/demo/common";
import { demoSessionCookies } from "./demo-auth";
import { countDailyLogs, deleteDailyLog, demoPlayer } from "./demo-db";
import { todayInJst } from "../../lib/date";
import { DEFAULT_UA, withMarker } from "./test-marker";

const expect = baseExpect.configure({ timeout: 20_000 });
const today = todayInJst();

test.skip(process.env.E2E_LOGGING !== "1", "フラグが有効なサーバーに対して、E2E_LOGGING=1 のときだけ実行する");

// client_submit_logs の列（入力内容の列が無いことを、列の一覧そのもので確認する）
const SUBMIT_LOG_COLUMNS = [
  "attempts",
  "created_at",
  "http_status",
  "id",
  "kind",
  "log_date",
  "online",
  "outcome",
  "school_id",
  "trigger",
  "user_agent",
  "user_id",
];

async function pollRows<T>(fetchRows: () => Promise<T[]>, want: number): Promise<T[]> {
  for (let i = 0; i < 20; i++) {
    const rows = await fetchRows();
    if (rows.length >= want) return rows;
    await new Promise((r) => setTimeout(r, 500));
  }
  return fetchRows();
}

test("再試行で成功した日次ログ送信が、client_submit_logs に1行（入力内容なし）で記録される", async ({ browser, baseURL }) => {
  const player = await demoPlayer("hanako");
  // 直前のテストの送信記録（keepalive で遅れて届くことがある）と区別するため、このテストだけの目印を UA に付ける
  const userAgent = withMarker(`${DEFAULT_UA} ${randomBytes(6).toString("hex")}`);
  const context = await browser.newContext({ baseURL, userAgent });
  const page = await context.newPage();
  const createdIds: number[] = [];
  await deleteDailyLog(player, today);
  try {
    const cookies = await demoSessionCookies("hanako");
    const { hostname } = new URL(baseURL!);
    await context.addCookies(cookies.map((c) => ({ ...c, domain: hostname, path: "/" })));

    // 最初の POST は応答しない（切れた接続で止まった状態）。2回目は本物のサーバーへ通す
    let routed = 0;
    await page.route("**/api/daily-log", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      routed++;
      if (routed === 1) return;
      await route.continue();
    });
    const logResponse = page.waitForResponse(
      (r) => new URL(r.url()).pathname === "/api/client-log" && r.request().method() === "POST",
      { timeout: 60_000 }
    );

    await page.goto(`/daily-log?date=${today}`);
    await expect(page.getByRole("heading", { name: "Daily Log" })).toBeVisible();
    const scale = (label: string, value: string) =>
      page
        .locator("div", { has: page.locator(":scope > div > span", { hasText: new RegExp(`^${label}$`) }) })
        .getByRole("button", { name: value, exact: true });
    await scale("睡眠時間", "7").click();
    await scale("今日の疲労度", "3").click();
    await page.getByRole("button", { name: "なし", exact: true }).click();
    await page.getByRole("button", { name: "してない", exact: true }).click();
    await scale("今日の自己採点", "7").click();
    await page.getByRole("button", { name: /記録する/ }).click();
    await expect(page.getByText("今日の記録を送信しました")).toBeVisible({ timeout: 40_000 });
    expect((await logResponse).status()).toBe(204);
    expect(await countDailyLogs(player, today)).toBe(1);

    const rows = await pollRows(async () => {
      const { data, error } = await adminClient
        .from("client_submit_logs")
        .select("*")
        .eq("user_id", player.playerId)
        .eq("user_agent", userAgent);
      if (error) throw new Error(error.message);
      return data ?? [];
    }, 1);
    createdIds.push(...rows.map((r) => r.id as number));

    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(Object.keys(row).sort()).toEqual(SUBMIT_LOG_COLUMNS);
    expect(row.school_id).toBe(player.schoolId);
    expect(row.kind).toBe("daily_log");
    expect(row.outcome).toBe("ok");
    expect(row.http_status).toBe(200);
    expect(row.trigger).toBe("button");
    expect(row.log_date).toBe(today);
    const attempts = row.attempts as { n: number; ms: number; result: string }[];
    expect(attempts.map((a) => a.result)).toEqual(["timeout", "ok"]);
  } finally {
    await context.close();
    if (createdIds.length > 0) {
      const { error } = await adminClient.from("client_submit_logs").delete().in("id", createdIds);
      if (error) throw new Error(`client_submit_logs の削除に失敗: ${error.message}`);
    }
    await deleteDailyLog(player, today);
  }
});

test("アプリ内ブラウザの UA で /auth/confirm を開くと、auth_link_events に1行記録される", async ({ browser, baseURL }) => {
  // 他の閲覧と区別できるよう、テストごとに一意の目印を UA の末尾に付ける（docomo 判定はそのまま効く）
  const marker = `t-log-e2e-${randomBytes(6).toString("hex")}`;
  const userAgent = `Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) docomo01 ${marker}`;
  // 実在しないトークン（ボタンは押さないので、検証は行われない）
  const fakeHash = randomBytes(28).toString("hex");
  const createdIds: number[] = [];
  const ctx = await browser.newContext({ baseURL, userAgent });
  try {
    const page = await ctx.newPage();
    const logResponse = page.waitForResponse(
      (r) => new URL(r.url()).pathname === "/api/auth-log" && r.request().method() === "POST"
    );
    await page.goto(`/auth/confirm?token_hash=${fakeHash}&type=invite`);
    await expect(page.getByText("アプリ内のブラウザで開いています")).toBeVisible();
    expect((await logResponse).status()).toBe(204);

    const rows = await pollRows(async () => {
      const { data, error } = await adminClient.from("auth_link_events").select("*").eq("user_agent", userAgent);
      if (error) throw new Error(error.message);
      return data ?? [];
    }, 1);
    createdIds.push(...rows.map((r) => r.id as number));

    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.event).toBe("confirm_view");
    expect(row.in_app_browser).toBe("docomo");
    expect(row.hash_length).toBe(56);
    expect(row.hash_format_ok).toBe(true);
    expect(row.has_next).toBe(false);
    // トークン・URL は保存されていない
    expect(JSON.stringify(row)).not.toContain(fakeHash);
  } finally {
    await ctx.close();
    if (createdIds.length > 0) {
      const { error } = await adminClient.from("auth_link_events").delete().in("id", createdIds);
      if (error) throw new Error(`auth_link_events の削除に失敗: ${error.message}`);
    }
  }
});
