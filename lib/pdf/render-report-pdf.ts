import { buildMonthlyReportHtml, type MatchCardData } from "@/lib/pdf/report-template";
import type { MonthlyReportDetail } from "@/lib/queries/monthly-report-detail";
import type { Browser } from "puppeteer-core";

/**
 * サーバーレス環境（Vercel）ではフルサイズのChromiumを同梱できないため、
 * @sparticuz/chromium（軽量ビルド）+ puppeteer-core を使う。
 * ローカル開発では通常の puppeteer にフォールバックする。
 *
 * package.json には以下を追加すること:
 *   "puppeteer-core": "^23.0.0",
 *   "@sparticuz/chromium": "^123.0.0"（本番）
 *   "puppeteer": "^23.0.0"（開発時のみ, devDependencies）
 *
 * 戻り値の型は必ず puppeteer-core の Browser 型に統一している。
 * puppeteer と puppeteer-core は実行時にはほぼ同じAPIだが型定義パッケージが別なため、
 * 条件分岐の両方の戻り値をそのまま返すと「puppeteerのBrowser | puppeteer-coreのBrowser」
 * という合体型になり、page.waitForFunction() 等のオーバーロード解決に失敗して
 * 「This expression is not callable」という型エラーになる。
 * 型を一方に寄せることで、以降のコードは常に単一の型として扱える。
 */
async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL) {
    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteer = await import("puppeteer-core");
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.launch({ headless: true });
  return browser as unknown as Browser;
}

export async function renderMonthlyReportPdf(
  report: MonthlyReportDetail,
  matches: MatchCardData[]
): Promise<Buffer> {
  const html = buildMonthlyReportHtml(report, matches);

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    // Chart.jsのアニメーション完了を待ってからPDF化する（グラフが空のまま出力されるのを防ぐ）。
    // 文字列でpageFunctionを渡す書き方はpuppeteer-coreの型定義とオーバーロードが
    // かみ合わずビルドエラーになることがあるため、関数を渡す書き方にしている。
    await page
      .waitForFunction(() => (window as unknown as { __chartReady__?: boolean }).__chartReady__ === true, {
        timeout: 5000,
      })
      .catch(() => {
        // タイムアウトしても致命的ではないため、グラフなしでPDF化を続行する
      });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
