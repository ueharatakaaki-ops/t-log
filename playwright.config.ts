// ブラウザでの再現テスト（tests/e2e/*.spec.ts）。
// デモスクール（slug: demo）のダミーアカウント・ダミーデータだけを使う。本番の選手データには触れない。
//
// 使い方:
//   npm run build
//   npm run test:e2e            … next start（ポート3200）を起動してテストする
//   E2E_BASE_URL=http://localhost:3100 npm run test:e2e   … 起動済みのサーバーに対してテストする
import { defineConfig, devices } from "@playwright/test";
import { withMarker } from "./tests/e2e/test-marker";

const PORT = 3200;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "*.spec.ts",
  // 同じデモ選手の同じ日付の行を使うため、並列にしない
  workers: 1,
  fullyParallel: false,
  timeout: 120_000,
  reporter: "list",
  // .gitignore 済みの場所に出力する（リポジトリに test-results/ を作らない）
  outputDir: "node_modules/.cache/playwright-results",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  // テストが作ったログ記録の行（UA に目印あり）を最後に削除する
  globalTeardown: "./tests/e2e/global-teardown.ts",
  projects: [
    { name: "chromium", use: { ...devices["Pixel 7"], userAgent: withMarker(devices["Pixel 7"].userAgent) } },
    { name: "webkit", use: { ...devices["iPhone SE"], userAgent: withMarker(devices["iPhone SE"].userAgent) } },
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
