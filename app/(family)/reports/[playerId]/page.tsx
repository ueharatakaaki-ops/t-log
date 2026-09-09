import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFamily } from "@/lib/auth/require-family";
import { getPublishedReports, getChildProfiles } from "@/lib/queries/family-reports";
import { PublishedReportList } from "@/components/family/PublishedReportList";

export default async function FamilyChildReportsPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const ctx = await requireFamily();
  const { playerId } = await params;

  // 本人以外・紐づいていない選手のIDが指定された場合は404にする
  // （実データへのアクセス可否は最終的にRLSが担保するが、UXとして早期に弾く）
  const allowed =
    (ctx.role === "player" && ctx.ownPlayerId === playerId) ||
    (ctx.role === "parent" && ctx.childPlayerIds.includes(playerId));

  if (!allowed) notFound();

  const [reports, children] = await Promise.all([
    getPublishedReports(playerId),
    ctx.role === "parent" ? getChildProfiles([playerId]) : Promise.resolve([]),
  ]);

  const title = ctx.role === "parent" ? `${children[0]?.fullName ?? ""} の月次レポート` : "月次レポート";

  return (
    <main className="min-h-screen bg-[#F4F6F8] px-4 pt-6 pb-10">
      {ctx.role === "parent" && (
        <Link href="/reports" className="mb-3 inline-block text-sm text-slate-400">
          ← お子様の選択に戻る
        </Link>
      )}
      <h1 className="mb-1 text-xl font-bold text-[#0F2537]">{title}</h1>
      <p className="mb-6 text-sm text-slate-500">これまでのバックナンバーを確認できます</p>
      <PublishedReportList reports={reports} />
    </main>
  );
}
