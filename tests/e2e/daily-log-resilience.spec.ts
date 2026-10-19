// Daily Log 送信の「固まらない・自動で再試行して保存される」動作のブラウザテスト。
// デモスクールの「デモ 花子」（ダミー）の今日の Daily Log だけを使い、各テストの前後で削除する
// （デモの初期状態「花子は今日未入力」に戻す）。メモ欄は空のまま送る（個人情報を入れない）。
import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { demoSessionCookies, type SimpleCookie } from "./demo-auth";
import { countDailyLogs, deleteDailyLog, demoPlayer } from "./demo-db";
import { todayInJst } from "../../lib/date";

const RETRY_TEXT = "通信が不安定です。再試行しています(2/3)";
const GAVE_UP_TEXT = "送信できませんでした。入力した内容は残っています。";
const SUCCESS_TEXT = "今日の記録を送信しました";

let player: { schoolId: string; playerId: string };
let cookies: SimpleCookie[];
const today = todayInJst();

test.beforeAll(async () => {
  player = await demoPlayer("hanako");
  cookies = await demoSessionCookies("hanako");
});

test.beforeEach(async ({ context, baseURL }) => {
  await deleteDailyLog(player, today);
  const { hostname } = new URL(baseURL!);
  await context.addCookies(cookies.map((c) => ({ ...c, domain: hostname, path: "/" })));
});

test.afterAll(async () => {
  await deleteDailyLog(player, today);
});

// ラベルの付いた入力欄（睡眠時間・疲労度・自己採点）の中のボタン
function scaleButton(page: Page, label: string, value: string) {
  return page
    .locator("div", { has: page.locator(":scope > div > span", { hasText: new RegExp(`^${label}$`) }) })
    .getByRole("button", { name: value, exact: true });
}

async function openAndFill(page: Page) {
  await page.goto(`/daily-log?date=${today}`);
  await expect(page.getByRole("heading", { name: "Daily Log" })).toBeVisible();
  await scaleButton(page, "睡眠時間", "7").click();
  await scaleButton(page, "今日の疲労度", "3").click();
  await page.getByRole("button", { name: "なし", exact: true }).click();
  await page.getByRole("button", { name: "してない", exact: true }).click();
  await scaleButton(page, "今日の自己採点", "7").click();
}

function submitButton(page: Page) {
  return page.getByRole("button", { name: /記録する|送信中/ });
}

function countPosts(page: Page) {
  const counter = { n: 0 };
  page.on("request", (req) => {
    if (req.method() === "POST" && new URL(req.url()).pathname === "/api/daily-log") counter.n++;
  });
  return counter;
}

async function hasDraft(page: Page) {
  return page.evaluate((key) => window.localStorage.getItem(key) !== null, `t-log:daily-log-draft:${today}`);
}

async function simulateHiddenThenVisible(page: Page) {
  await page.evaluate(() => {
    const set = (state: string) => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
      Object.defineProperty(document, "hidden", { configurable: true, get: () => state === "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    };
    set("hidden");
    set("visible");
  });
}

test("最初の POST が応答しなくても、自動で再試行して保存される", async ({ page }) => {
  const posts = countPosts(page);
  let routed = 0;
  await page.route("**/api/daily-log", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    routed++;
    if (routed === 1) return; // 応答しない（fulfill も continue もしない）＝切れた接続で止まった状態
    // 「再試行しています」の表示を確認できるよう、少し遅らせてから本物のサーバーへ通す
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });

  await openAndFill(page);
  await submitButton(page).click();

  await expect(page.getByRole("button", { name: "送信中…" })).toBeVisible();
  await expect(page.getByText(RETRY_TEXT)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(SUCCESS_TEXT)).toBeVisible({ timeout: 20_000 });

  expect(posts.n).toBe(2);
  expect(await countDailyLogs(player, today)).toBe(1);
  expect(await hasDraft(page)).toBe(false);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("オフラインで送信すると失敗表示になり、オンライン復帰で自動再送されて保存される", async ({ page, context }) => {
  await openAndFill(page);
  await context.setOffline(true);
  await submitButton(page).click();

  await expect(page.getByText(GAVE_UP_TEXT)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "記録する" })).toBeEnabled();
  expect(await hasDraft(page)).toBe(true);
  expect(await countDailyLogs(player, today)).toBe(0);

  await context.setOffline(false);
  await expect(page.getByText(SUCCESS_TEXT)).toBeVisible({ timeout: 30_000 });
  expect(await countDailyLogs(player, today)).toBe(1);
});

test("送信に失敗した後、画面を隠して戻すと自動再送されて保存される", async ({ page }) => {
  await page.route("**/api/daily-log", (route) =>
    route.request().method() === "POST" ? route.abort("failed") : route.continue()
  );
  await openAndFill(page);
  await submitButton(page).click();
  await expect(page.getByText(GAVE_UP_TEXT)).toBeVisible({ timeout: 20_000 });
  expect(await countDailyLogs(player, today)).toBe(0);

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await simulateHiddenThenVisible(page);
  await expect(page.getByText(SUCCESS_TEXT)).toBeVisible({ timeout: 30_000 });
  expect(await countDailyLogs(player, today)).toBe(1);
});

test("ボタンを素早く2回押しても、送信は1回だけで daily_logs は1行のまま", async ({ page }) => {
  const posts = countPosts(page);
  await openAndFill(page);
  // 画面の再描画（ボタンの無効化）より前に2回押す
  await submitButton(page).evaluate((el: HTMLElement) => {
    el.click();
    el.click();
  });
  await expect(page.getByText(SUCCESS_TEXT)).toBeVisible({ timeout: 20_000 });
  // 成功後に画面を隠して戻しても再送しない
  await simulateHiddenThenVisible(page);
  await page.waitForTimeout(1_500);

  expect(posts.n).toBe(1);
  expect(await countDailyLogs(player, today)).toBe(1);
});

test("ログインが切れていたら、再ログインの案内を出し、入力内容は残す", async ({ page, context }) => {
  await openAndFill(page);
  await (context as BrowserContext).clearCookies();
  await submitButton(page).click();

  await expect(page.getByText("ログインが切れました。再ログインしてください")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: "ログイン画面へ" })).toHaveAttribute("href", "/login");
  expect(await hasDraft(page)).toBe(true);
  expect(await countDailyLogs(player, today)).toBe(0);
});
