// トップページ「操作デモ動画」セクションのテスト（npm run test:marketing）。
// 未ログインの訪問者としてトップページを開くだけで、ログイン・DB・個人情報は使わない。
import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const VIDEO = 'video[aria-label="t-logの操作デモ動画"]';
const WRAPPER = "[data-demo-video-wrapper]";
// スクリーンショットの保存先（未指定なら Playwright の出力先）
const SHOT_DIR = process.env.SHOT_DIR;

async function openTop(page: Page) {
  await page.goto("/");
  await expect(page.locator("#demo")).toBeVisible();
}

function isPaused(page: Page) {
  return page.locator(VIDEO).evaluate((v: HTMLVideoElement) => v.paused);
}

async function scrollToVideo(page: Page) {
  await page.locator(VIDEO).evaluate((v) => v.scrollIntoView({ block: "center" }));
}

async function scrollToTop(page: Page) {
  await page.evaluate(() => window.scrollTo(0, 0));
}

test("FEATURES → DEMO → FOR EVERYONE の順に並び、横スクロールが出ず、読み込み前から16:9の高さがある", async ({ page }, testInfo) => {
  const videoRequests: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/videos/tlog-demo.mp4")) videoRequests.push(req.url());
  });

  await openTop(page);

  // セクションの並び
  const order = await page.evaluate(() => {
    const demo = document.getElementById("demo")!;
    const sections = Array.from(document.querySelectorAll("section"));
    const i = sections.indexOf(demo as HTMLElement);
    return [sections[i - 1]?.id, demo.id, sections[i + 1]?.id];
  });
  expect(order).toEqual(["features", "demo", "roles"]);

  // 文言
  const demo = page.locator("#demo");
  await expect(demo.getByText("DEMO", { exact: true })).toBeVisible();
  await expect(demo.getByRole("heading", { level: 2 })).toHaveText("実際の操作を、40秒で。");
  await expect(demo.getByText("選手の毎日の記録から、コーチのダッシュボード、月次レポートまで。")).toBeVisible();
  await expect(demo.getByText("※ 画面はデモ用アカウントのデータを使用したイメージです")).toBeVisible();

  // 横スクロールが出ない
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  // 動画は読み込まれる前から 16:9 の高さを確保している（最大 960px、中央寄せ）
  const video = page.locator(VIDEO);
  const attrs = await video.evaluate((v: HTMLVideoElement) => ({
    preload: v.getAttribute("preload"),
    poster: v.getAttribute("poster"),
    width: v.getAttribute("width"),
    height: v.getAttribute("height"),
    muted: v.muted,
    loop: v.loop,
    playsInline: v.playsInline,
    readyState: v.readyState,
  }));
  expect(attrs).toEqual({
    preload: "none",
    poster: "/videos/tlog-demo-poster.jpg",
    width: "1920",
    height: "1080",
    muted: true,
    loop: true,
    playsInline: true,
    readyState: 0,
  });
  const box = (await video.boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(960);
  expect(Math.abs(box.height - (box.width * 9) / 16)).toBeLessThanOrEqual(1);
  const viewportWidth = page.viewportSize()!.width;
  const wrapperBox = (await page.locator(WRAPPER).boundingBox())!;
  expect(Math.abs(wrapperBox.x - (viewportWidth - wrapperBox.width) / 2)).toBeLessThanOrEqual(1);

  // 画面に入るまで動画本体は取りに行かない
  expect(videoRequests).toEqual([]);

  // 追従ヘッダーが（FEATURES を過ぎた先でも）画面上端に残る
  await page.locator("#roles").scrollIntoViewIfNeeded();
  const headerTop = await page.locator("header").first().evaluate((h) => h.getBoundingClientRect().top);
  expect(headerTop).toBe(0);

  // スクリーンショット（ページ全体と、FEATURES〜FOR EVERYONE の範囲）
  await scrollToTop(page);
  await page.evaluate(() => document.fonts.ready);
  const dir = SHOT_DIR ?? testInfo.outputDir;
  const name = testInfo.project.name;
  await page.screenshot({ path: path.join(dir, `${name}-full.png`), fullPage: true });
  const features = (await page.locator("#features").boundingBox())!;
  const roles = (await page.locator("#roles").boundingBox())!;
  const scrollY = await page.evaluate(() => window.scrollY);
  await page.screenshot({
    path: path.join(dir, `${name}-features-demo-roles.png`),
    fullPage: true,
    clip: { x: 0, y: features.y + scrollY, width: viewportWidth, height: roles.y + Math.min(roles.height, 700) - features.y },
  });
});

test("画面に入ると再生され、外れると止まる", async ({ page }) => {
  await openTop(page);
  expect(await isPaused(page)).toBe(true);

  await scrollToVideo(page);
  await expect.poll(() => isPaused(page)).toBe(false);
  await expect(page.locator(WRAPPER)).toHaveAttribute("aria-label", "t-logの操作デモ動画を一時停止");

  await scrollToTop(page);
  await expect.poll(() => isPaused(page)).toBe(true);

  // 手動で止めていなければ、再び画面に入ると再生される
  await scrollToVideo(page);
  await expect.poll(() => isPaused(page)).toBe(false);
});

test("クリック／タップで切り替わり、手動で止めたら再び画面に入っても再生しない", async ({ page }, testInfo) => {
  await openTop(page);
  await scrollToVideo(page);
  await expect.poll(() => isPaused(page)).toBe(false);

  const wrapper = page.locator(WRAPPER);
  await expect(wrapper).toHaveAttribute("role", "button");
  const press = () => (testInfo.project.use.hasTouch ? wrapper.tap() : wrapper.click());

  await press();
  await expect.poll(() => isPaused(page)).toBe(true);
  await expect(wrapper).toHaveAttribute("aria-label", "t-logの操作デモ動画を再生");

  // 一度外して戻っても、勝手に再生しない
  await scrollToTop(page);
  await page.waitForTimeout(500);
  await scrollToVideo(page);
  await page.waitForTimeout(1000);
  expect(await isPaused(page)).toBe(true);

  await press();
  await expect.poll(() => isPaused(page)).toBe(false);
});

test("キーボード（Enter／Space）で切り替わる", async ({ page }) => {
  await openTop(page);
  await scrollToVideo(page);
  await expect.poll(() => isPaused(page)).toBe(false);

  const wrapper = page.locator(WRAPPER);
  await expect(wrapper).toHaveAttribute("tabindex", "0");
  await wrapper.focus();

  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.keyboard.press("Space");
  await expect.poll(() => isPaused(page)).toBe(true);
  // Space でページがスクロールしない
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);

  await page.keyboard.press("Enter");
  await expect.poll(() => isPaused(page)).toBe(false);
});

test("動きを減らす設定では自動再生せず、標準の controls を出し、独自のボタンにしない", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openTop(page);
  await scrollToVideo(page);
  await page.waitForTimeout(1500);

  const video = page.locator(VIDEO);
  expect(await isPaused(page)).toBe(true);
  expect(await video.evaluate((v: HTMLVideoElement) => v.controls)).toBe(true);
  const wrapper = page.locator(WRAPPER);
  await expect(wrapper).not.toHaveAttribute("role", /.*/);
  await expect(wrapper).not.toHaveAttribute("tabindex", /.*/);
  await expect(wrapper).not.toHaveAttribute("aria-label", /.*/);
});

test("再生中に動きを減らす設定へ変わると止まり、controls が出る（matchMedia の change を監視）", async ({ page }) => {
  await openTop(page);
  await scrollToVideo(page);
  await expect.poll(() => isPaused(page)).toBe(false);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => isPaused(page)).toBe(true);
  await expect.poll(() => page.locator(VIDEO).evaluate((v: HTMLVideoElement) => v.controls)).toBe(true);
  await expect(page.locator(WRAPPER)).not.toHaveAttribute("role", /.*/);

  // 戻すと、独自のボタンに戻り controls が消える
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(() => page.locator(VIDEO).evaluate((v: HTMLVideoElement) => v.controls)).toBe(false);
  await expect(page.locator(WRAPPER)).toHaveAttribute("role", "button");
});
