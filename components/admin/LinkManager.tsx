"use client";

import { useState, useTransition } from "react";

type Option = { id: string; label: string };
type LinkRow = { personId: string; personName: string; playerId: string; playerName: string };

type LinkManagerProps = {
  title: string;
  personLabel: string; // "保護者" | "コーチ"
  personOptions: Option[];
  playerOptions: Option[];
  links: LinkRow[];
  onAdd: (personId: string, playerId: string) => Promise<{ ok: boolean; error?: string }>;
  onRemove: (personId: string, playerId: string) => Promise<{ ok: boolean; error?: string }>;
};

export function LinkManager({
  title,
  personLabel,
  personOptions,
  playerOptions,
  links,
  onAdd,
  onRemove,
}: LinkManagerProps) {
  const [personId, setPersonId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    if (!personId || !playerId) return;
    setError(null);
    startTransition(async () => {
      const res = await onAdd(personId, playerId);
      if (!res.ok) setError(res.error ?? "登録に失敗しました");
    });
  }

  function handleRemove(pId: string, plId: string) {
    startTransition(async () => {
      await onRemove(pId, plId);
    });
  }

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-bold text-slate-700">{title}</h2>

      <div className="mb-4 flex flex-col gap-2 rounded-xl border border-slate-100 bg-white p-3 sm:flex-row sm:items-center">
        <select
          value={personId}
          onChange={(e) => setPersonId(e.target.value)}
          className="h-11 flex-1 rounded-lg border border-slate-200 px-2 text-sm"
        >
          <option value="">{personLabel}を選択</option>
          {personOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={playerId}
          onChange={(e) => setPlayerId(e.target.value)}
          className="h-11 flex-1 rounded-lg border border-slate-200 px-2 text-sm"
        >
          <option value="">選手を選択</option>
          {playerOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!personId || !playerId || isPending}
          onClick={handleAdd}
          className="h-11 rounded-lg bg-[#0F2537] px-4 text-sm font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400"
        >
          紐付ける
        </button>
      </div>

      {error && <p className="mb-2 text-sm text-rose-600">{error}</p>}

      <div className="flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white">
        {links.length === 0 && <p className="p-3 text-sm text-slate-400">まだ紐付けがありません</p>}
        {links.map((l) => (
          <div key={`${l.personId}-${l.playerId}`} className="flex items-center justify-between p-3 text-sm">
            <span>
              {l.personName} ↔ {l.playerName}
            </span>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleRemove(l.personId, l.playerId)}
              className="text-xs font-semibold text-rose-600"
            >
              解除
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
