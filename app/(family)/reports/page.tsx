import Link from "next/link";
import { requireFamily } from "@/lib/auth/require-family";
import { getPublishedReports, getChildProfiles } from "@/lib/queries/family-reports";
import { PublishedReportList } from "@/components/family/PublishedReportList";

export default async function FamilyReportsPage() {
  const ctx = await requireFamily();

  if (ctx.role === "player") {
    const reports = await getPublishedReports(ctx.ownPlayerId);
    return (
      <main className="min-h-screen bg-[#F4F6F8] px-4 pt-6 pb-10">
        <h1 className="mb-1 text-xl font-bold text-[#0F2537]">月次レポート</h1>
        <p className="mb-6 text-sm text-slate-500">これまでのバックナンバーを確認できます</p>
        <PublishedReportList reports={reports} />
      </main>
    );
  }

  // 保護者: 子どもが1人ならそのまま一覧を表示、複数いる場合は選択画面を出す
  const children = await getChildProfiles(ctx.childPlayerIds);

  if (children.length === 0) {
    return (
      <main className="min-h-screen bg-[#F4F6F8] px-4 pt-6">
        <h1 className="mb-1 text-xl font-bold text-[#0F2537]">月次レポート</h1>
        <p className="text-sm text-slate-500">お子様の登録が見つかりませんでした。スクールにお問い合わせください。</p>
      </main>
    );
  }

  if (children.length === 1) {
    const reports = await getPublishedReports(children[0].id);
    return (
      <main className="min-h-screen bg-[#F4F6F8] px-4 pt-6 pb-10">
        <h1 className="mb-1 text-xl font-bold text-[#0F2537]">{children[0].fullName} の月次レポート</h1>
        <p className="mb-6 text-sm text-slate-500">これまでのバックナンバーを確認できます</p>
        <PublishedReportList reports={reports} />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F4F6F8] px-4 pt-6 pb-10">
      <h1 className="mb-1 text-xl font-bold text-[#0F2537]">月次レポート</h1>
      <p className="mb-6 text-sm text-slate-500">お子様を選択してください</p>
      <div className="flex flex-col gap-2">
        {children.map((child) => (
          <Link
            key={child.id}
            href={`/reports/${child.id}`}
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
