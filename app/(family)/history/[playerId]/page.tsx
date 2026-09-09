import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFamily } from "@/lib/auth/require-family";
import { getPlayerDetail } from "@/lib/queries/player-detail";
import { HistoryView } from "@/components/family/HistoryView";

export default async function FamilyChildHistoryPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const ctx = await requireFamily();
  const { playerId } = await params;

  const allowed =
    (ctx.role === "player" && ctx.ownPlayerId === playerId) ||
    (ctx.role === "parent" && ctx.childPlayerIds.includes(playerId));

  if (!allowed) notFound();

  const detail = await getPlayerDetail(playerId);
  if (!detail) notFound();

  return (
    <main className="min-h-screen bg-[#F4F6F8] px-4 pt-6 pb-10">
      {ctx.role === "parent" && (
        <Link href="/history" className="mb-3 inline-block text-sm text-slate-400">
          ← お子様の選択に戻る
        </Link>
      )}
      <h1 className="mb-1 text-xl font-bold text-[#0F2537]">{detail.profile.fullName} の過去ログ</h1>
      <p className="mb-6 text-sm text-slate-500">これまでの記録を確認できます</p>
      <HistoryView detail={detail} />
    </main>
  );
}
