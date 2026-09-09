import { requireAdmin } from "@/lib/auth/require-admin";
import { getLinkManagementData } from "@/lib/queries/admin-links";
import { LinkManager } from "@/components/admin/LinkManager";
import { addParentLink, removeParentLink, addCoachLink, removeCoachLink } from "./actions";

export default async function AdminLinksPage() {
  const admin = await requireAdmin();
  const { simplePlayers, simpleParents, simpleCoaches, parentLinkRows, coachLinkRows } =
    await getLinkManagementData(admin.schoolId);

  const playerOptions = simplePlayers.map((p) => ({ id: p.id, label: p.fullName }));

  return (
    <main className="min-h-screen bg-[#F4F6F8] px-4 pt-6 pb-10">
      <h1 className="mb-6 text-xl font-bold text-[#0F2537]">紐付け管理</h1>

      <LinkManager
        title="保護者 ⇔ 選手"
        personLabel="保護者"
        personOptions={simpleParents.map((p) => ({ id: p.id, label: p.displayName }))}
        playerOptions={playerOptions}
        links={parentLinkRows.map((l) => ({
          personId: l.parentId,
          personName: l.parentName,
          playerId: l.playerId,
          playerName: l.playerName,
        }))}
        onAdd={addParentLink}
        onRemove={removeParentLink}
      />

      <LinkManager
        title="コーチ ⇔ 担当選手"
        personLabel="コーチ"
        personOptions={simpleCoaches.map((c) => ({ id: c.id, label: c.displayName }))}
        playerOptions={playerOptions}
        links={coachLinkRows.map((l) => ({
          personId: l.coachId,
          personName: l.coachName,
          playerId: l.playerId,
          playerName: l.playerName,
        }))}
        onAdd={addCoachLink}
        onRemove={removeCoachLink}
      />

      <p className="text-xs text-slate-400">
        コーチの担当制は現在の運用では未使用です（全コーチが全選手を閲覧可能）。この画面は将来の担当制導入に備えたものです。
      </p>
    </main>
  );
}
