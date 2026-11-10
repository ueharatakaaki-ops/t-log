import { DemoVideo } from "@/components/marketing/DemoVideo";

// 製品紹介サイトの「操作デモ動画」セクション（FEATURES と FOR EVERYONE の間）。
// 見出し・余白・色は lib/marketing/homepage-content.ts の既存セクションと同じ値を使う。
// このファイル自体はクライアントコンポーネントにしない（動画部分だけ DemoVideo に切り出す）。
export function DemoSection() {
  return (
    <section id="demo" style={{ padding: "96px 24px", background: "#FFFFFF" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <span style={{ display: "block", textAlign: "center", color: "#00A859", fontSize: 14, fontWeight: 700 }}>
          DEMO
        </span>
        <h2 style={{ fontSize: 30, fontWeight: 900, textAlign: "center", color: "#0F2537", marginTop: 10 }}>
          実際の操作を、40秒で。
        </h2>
        <p
          style={{
            fontSize: 15,
            lineHeight: 1.9,
            color: "#64748B",
            textAlign: "center",
            maxWidth: 640,
            margin: "16px auto 0",
          }}
        >
          選手の毎日の記録から、コーチのダッシュボード、月次レポートまで。実際の画面で流れをご覧ください。
        </p>
        <DemoVideo
          src="/videos/tlog-demo.mp4"
          poster="/videos/tlog-demo-poster.jpg"
          label="t-logの操作デモ動画"
        />
        <p style={{ textAlign: "center", fontSize: 11, color: "#94A3B8", marginTop: 14 }}>
          ※ 画面はデモ用アカウントのデータを使用したイメージです
        </p>
      </div>
    </section>
  );
}
