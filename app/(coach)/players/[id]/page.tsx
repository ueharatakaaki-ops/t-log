import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/require-staff";
import { getPlayerDetail } from "@/lib/queries/player-detail";
import { DailyTrendChart } from "@/components/coach/DailyTrendChart";
import { DailyNotesList } from "@/components/coach/DailyNotesList";
import { MatchHistoryList } from "@/components/coach/MatchHistoryList";
import { GoalSummaryCard } from "@/components/coach/GoalSummaryCard";
import { CoachNotesPanel } from "@/components/coach/CoachNotesPanel";
import { PhysicalMeasurementHistoryList } from "@/components/physical/PhysicalMeasurementHistoryList";

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const detail = await getPlayerDetail(id);

  if (!detail) notFound();

  const { profile, dailyTrend, matches, goal, goalHistory, physicalMeasurements, coachNotes } = detail;

  return (
    <main className="min-h-screen bg-[#F4F6F8] px-4 pt-6 pb-12">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#0F2537]">{profile.fullName}</h1>
        <p className="text-sm text-slate-500">
          {profile.category ?? "-"} {profile.grade ? `／ ${profile.grade}` : ""}
          {profile.status !== "active" && (
            <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs">
              {profile.status === "graduated" ? "卒業" : "退会"}
            </span>
          )}
        </p>
      </div>

      <Section title="コンディション推移（直近30日）">
        <DailyTrendChart points={dailyTrend} />
      </Section>

      <Section title="選手のコメント（日誌より）">
        <DailyNotesList playerId={profile.id} points={dailyTrend} />
      </Section>

      <Section title="今月の目標">
        <GoalSummaryCard goal={goal} history={goalHistory} />
      </Section>

      <Section title="試合履歴">
        <MatchHistoryList matches={matches} showShareLink />
      </Section>

      <Section title="身体データ">
        <PhysicalMeasurementHistoryList measurements={physicalMeasurements} />
      </Section>

      <Section title="コーチメモ">
        <CoachNotesPanel playerId={profile.id} notes={coachNotes} />
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-bold text-slate-700">{title}</h2>
      {children}
    </section>
  );
}
