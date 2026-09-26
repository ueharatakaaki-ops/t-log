import type { MetadataRoute } from "next";

// スマホのホーム画面に追加した際のアプリ名・アイコン・配色を定義する。
// 選手・保護者はほぼ全員スマホから使うため、ホーム画面アイコンが
// テニスモチーフになっていると見つけやすく・分かりやすくなる。
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "t-log",
    short_name: "t-log",
    description: "ジュニアスポーツアカデミー向け 選手管理アプリ「t-log」",
    start_url: "/",
    display: "standalone",
    background_color: "#F4F6F8",
    theme_color: "#0F2537",
    icons: [
      { src: "/logo.png", sizes: "180x180", type: "image/png" },
      { src: "/logo-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
