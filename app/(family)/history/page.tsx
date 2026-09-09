import Link from "next/link";
import { requireFamily } from "@/lib/auth/require-family";
import { getChildProfiles } from "@/lib/queries/family-reports";
import { getPlayerDetail } from "@/lib/queries/player-detail";
import { HistoryView } from "@/components/family/HistoryView";

export default async function FamilyHistoryPage() {
  const ctx = await requireFamily();

  if (ctx.role === "player") {
    const detail = await getPlayerDetail(ctx.ownPlayerId);
    if (!detail) return null;
    return (
      <main className="min-h-screen bg-[#F4F6F8] px-4 pt-6 pb-10">
        <h1 className="mb-1 text-xl font-bold text-[#0F2537]">過去ログ</h1>
        <p className="mb-6 text-sm text-slate-500">これまでの記録を確認できます</p>
        <HistoryView detail={detail} />
      </main>
    );
  }

  const children = await getChildProfiles(ctx.childPlayerIds);

  if (children.length === 0) {
    return (
      <main className="min-h-screen bg-[#F4F6F8] px-4 pt-6">
        <h1 className="mb-1 text-xl font-bold text-[#0F2537]">過去ログ</h1>
        <p className="text-sm text-slate-500">お子様の登録が見つかりませんでした。</p>
      </main>
    );
  }

  if (children.length === 1) {
    const detail = await getPlayerDetail(children[0].id);
    if (!detail) return null;
    return (
      <main className="min-h-screen bg-[#F4F6F8] px-4 pt-6 pb-10">
        <h1 className="mb-1 text-xl font-bold text-[#0F2537]">{children[0].fullName} の過去ログ</h1>
        <p className="mb-6 text-sm text-slate-500">これまでの記録を確認できます</p>
        <HistoryView detail={detail} />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F4F6F8] px-4 pt-6 pb-10">
      <h1 className="mb-1 text-xl font-bold text-[#0F2537]">過去ログ</h1>
      <p className="mb-6 text-sm text-slate-500">お子様を選択してください</p>
      <div className="flex flex-col gap-2">
        {children.map((child) => (
          <Link
            key={child.id}
            href={`/history/${child.id}`}
            className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-4 active:bg-[#F4F6F8]"
          >
            <div>
              <p className="font-semibold text-[#0F2537]">{child.fullName}</p>
              <p className="text-xs text-slate-400">{child.category ?? "-"}</p>
            </div>
            <span className="text-slate-300">›</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
