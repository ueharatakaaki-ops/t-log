import { requireSystemAdmin } from "@/lib/auth/require-admin";
import { getSchoolsOverview } from "@/lib/queries/system-admin";

export default async function AdminSchoolsPage() {
  await requireSystemAdmin();
  const schools = await getSchoolsOverview();

  const grandTotal = schools.reduce((sum, s) => sum + s.counts.total, 0);
  const grandTotalPlayers = schools.reduce((sum, s) => sum + s.counts.player, 0);

  return (
    <main className="min-h-screen bg-[#F4F6F8] px-4 pt-6 pb-10">
      <h1 className="mb-1 text-xl font-bold text-[#0F2537]">スクール一覧</h1>
      <p className="mb-4 text-sm text-slate-500">
        全{schools.length}スクール ／ 登録者合計 {grandTotal}名（うち選手 {grandTotalPlayers}名）
      </p>

      <div className="flex flex-col gap-3">
        {schools.map((s) => (
          <div key={s.id} className="rounded-xl border border-slate-100 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-bold text-[#0F2537]">{s.name}</p>
                <p className="text-xs text-slate-400">
                  {s.slug} ／ {new Date(s.createdAt).toLocaleDateString("ja-JP")}〜
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {s.plan}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              <CountCell label="選手" value={s.counts.player} />
              <CountCell label="コーチ" value={s.counts.coach} />
              <CountCell label="保護者" value={s.counts.parent} />
              <CountCell label="管理者" value={s.counts.schoolAdmin} />
            </div>

            <p className="mt-3 text-right text-xs font-semibold text-slate-500">合計 {s.counts.total}名</p>
          </div>
        ))}

        {schools.length === 0 && <p className="p-4 text-sm text-slate-400">スクールが登録されていません</p>}
      </div>
    </main>
  );
}

function CountCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-[#F4F6F8] py-2">
      <p className="text-lg font-bold text-[#0F2537]">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
