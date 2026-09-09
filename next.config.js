/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // PDF生成でPuppeteer/Chromiumをサーバーレス関数にバンドルするための設定
  // (Next.js 15ではexperimental配下ではなくトップレベルのキーになった)
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
};

module.exports = nextConfig;
