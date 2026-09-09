import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // NLTC公式ブランドカラー。画面側では現状 text-[#0F2537] のようにアービトラリ値で
        // 直接指定している箇所が大半だが、今後はこちらの名前付きトークンに寄せていく
        // （以前ここに入っていた navy: #0f172a / emerald: #10b981 は実際のブランドカラーと
        // 微妙にズレた値で、かつどこからも参照されていなかったため正しい値に修正した）。
        navy: "#0F2537", // メイン: ヘッダー・見出し・ナビゲーション
        accent: "#00A859", // アクセント: 操作ボタン・強調アイコン・ハイライト
        "surface-bg": "#F4F6F8", // サブ/背景: ベース背景・カード背景
      },
      fontFamily: {
        sans: ["Noto Sans JP", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
