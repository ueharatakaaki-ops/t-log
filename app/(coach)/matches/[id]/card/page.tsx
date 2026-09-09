import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/require-staff";
import { getMatchCardDetail } from "@/lib/queries/match-detail";
import { MatchCardEditor } from "@/components/reports/MatchCardEditor";

export default async function MatchCardPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const match = await getMatchCardDetail(id);
  if (!match) notFound();

  return (
    <main className="min-h-screen bg-[#F4F6F8] px-4 pt-6 pb-10">
      <h1 className="mb-1 text-xl font-bold text-[#0F2537]">SNS用カード</h1>
      <p className="mb-6 text-sm text-slate-500">
        {match.playerName} — {match.tournamentName}
      </p>
      <MatchCardEditor match={match} />
    </main>
  );
}
