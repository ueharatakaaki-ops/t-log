// ログアウトの範囲（この端末だけ）と、送信経過の記録（既定は無効）のブラウザテスト。
// デモスクールの「デモ 花子」（ダミー）だけを使う。ログインのたびに別のセッションを作るため、
// 「別の端末」は別のセッション Cookie を持つブラウザコンテキストで表す。
import { test, expect as baseExpect, type BrowserContext } from "@playwright/test";
import { demoSessionCookies } from "./demo-auth";
import { deleteDailyLog, demoPlayer } from "./demo-db";
import { todayInJst } from "../../lib/date";

const expect = baseExpect.configure({ timeout: 20_000 });
const today = todayInJst();

async function loggedInContext(context: BrowserContext, baseURL: string) {
  const cookies = await demoSessionCookies("hanako");
  const { hostname } = new URL(baseURL);
  await context.addCookies(cookies.map((c) => ({ ...c, domain: hostname, path: "/" })));
}

test("ログアウトはこの端末だけ。同じアカウントの別の端末はログインしたまま", async ({ browser, baseURL }) => {
  const deviceA = await browser.newContext({ baseURL });
  const deviceB = await browser.newContext({ baseURL });
  await loggedInContext(deviceA, baseURL!);
  await loggedInContext(deviceB, baseURL!);

  const a = await deviceA.newPage();
  await a.goto("/daily-log");
  await expect(a.getByRole("heading", { name: "Daily Log" })).toBeVisible();
  await a.getByRole("button", { name: "ログアウト" }).click();
  await a.waitForURL((url) => !url.pathname.startsWith("/daily-log"));
  await a.goto("/daily-log", { waitUntil: "commit" });
  await expect(a).toHaveURL(/\/login/);

  const b = await deviceB.newPage();
  await b.goto("/daily-log");
  await expect(b).toHaveURL(/\/daily-log/);
  await expect(b.getByRole("heading", { name: "Daily Log" })).toBeVisible();

  await deviceA.close();
  await deviceB.close();
});

test("ログアウトの通信が失敗したら、案内を出して押し直せる（固まらない）", async ({ page, context, baseURL }) => {
  await loggedInContext(context, baseURL!);
  await page.goto("/daily-log");
  await expect(page.getByRole("heading", { name: "Daily Log" })).toBeVisible();

  await page.route("**/auth/v1/logout*", (route) => route.abort("internetdisconnected"));
  await page.getByRole("button", { name: "ログアウト" }).click();
  await expect(page.getByText("ログアウトできませんでした。通信を確認して、もう一度押してください")).toBeVisible();
  await expect(page.getByRole("button", { name: "ログアウト" })).toBeEnabled();

  await page.unroute("**/auth/v1/logout*");
  await page.getByRole("button", { name: "ログアウト" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/daily-log"));
  await page.goto("/daily-log", { waitUntil: "commit" });
  await expect(page).toHaveURL(/\/login/);
});

test("送信経過の記録は、フラグ未設定なら送られず、API も何も保存しない", async ({ page, context, baseURL, request }) => {
  const player = await demoPlayer("hanako");
  await deleteDailyLog(player, today);
  try {
    await loggedInContext(context, baseURL!);
    const logPosts: string[] = [];
    page.on("request", (req) => {
      if (new URL(req.url()).pathname === "/api/client-log") logPosts.push(req.method());
    });

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
    await expect(page.getByText("今日の記録を送信しました")).toBeVisible();
    expect(logPosts).toEqual([]);

    // 未ログインで直接送っても、フラグ未設定なら何もせず 204
    const res = await request.post("/api/client-log", {
      data: { kind: "daily_log", outcome: "ok", attempts: [], trigger: "button" },
    });
    expect(res.status()).toBe(204);
  } finally {
    await deleteDailyLog(player, today);
  }
});
