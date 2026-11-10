// 製品紹介サイト（トップページ "/"）のブラウザテスト（tests/marketing/*.spec.ts）。
// ログインもDBも使わない（未ログインの訪問者として表示するだけ）ので、tests/e2e とは設定を分け、
// DBの後片付け（globalTeardown）を持たない。
//
// デモ動画は H.264 のため、コーデックを含まない Playwright 同梱の Chromium ではなく、
// インストール済みの Google Chrome（channel: "chrome"）で動かす。
//
// 使い方:
//   npm run build
//   npm run test:marketing      … next start（ポート3201）を起動してテストする
//   E2E_BASE_URL=http://localhost:3300 npm run test:marketing   … 起動済みのサーバーに対してテストする
import { defineConfig, devices } from "@playwright/test";

const PORT = 3201;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/marketing",
  testMatch: "*.spec.ts",
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  reporter: "list",
  outputDir: "node_modules/.cache/playwright-marketing-results",
  use: {
    baseURL,
    channel: "chrome",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop-1280", use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1280, height: 800 } } },
    {
      name: "mobile-375",
      use: { ...devices["iPhone SE"], defaultBrowserType: "chromium", channel: "chrome", viewport: { width: 375, height: 667 } },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        url: `${baseURL}/login`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
