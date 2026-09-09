"use client";

import { useState, useTransition } from "react";
import { addCoachNote } from "@/app/(coach)/players/[id]/actions";
import type { CoachNoteRow } from "@/lib/queries/player-detail";

export function CoachNotesPanel({ playerId, notes }: { playerId: string; notes: CoachNoteRow[] }) {
  const [content, setContent] = useState("");
  // デフォルトは internal。選手・保護者に見せる場合は明示的に切り替える
  const [visibility, setVisibility] = useState<"internal" | "shared_with_family">("internal");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (!content.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await addCoachNote({ playerId, content, visibility });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setContent("");
      setVisibility("internal");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-slate-100 bg-white p-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="指導内容・気づきをメモする"
          className="w-full resize-none text-sm text-[#0F2537] outline-none"
        />
        <div className="mt-2 flex items-center justify-between">
          <div className="flex gap-2">
            <VisibilityToggle
              label="内部メモ"
              active={visibility === "internal"}
              onClick={() => setVisibility("internal")}
            />
            <VisibilityToggle
              label="選手・保護者に共有"
              active={visibility === "shared_with_family"}
              onClick={() => setVisibility("shared_with_family")}
              activeClassName="bg-[#00A859] text-white"
            />
          </div>
          <button
            type="button"
            disabled={!content.trim() || isPending}
            onClick={handleSubmit}
            className="h-9 rounded-lg bg-[#0F2537] px-4 text-sm font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400"
          >
            {isPending ? "追加中..." : "追加"}
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      </div>

      <div className="flex flex-col gap-2">
        {notes.length === 0 && <p className="text-sm text-slate-400">メモはまだありません</p>}
        {notes.map((note) => (
          <div key={note.id} className="rounded-xl border border-slate-100 bg-white p-3">
            <div className="mb-1 flex items-center justify-between">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  note.visibility === "shared_with_family"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {note.visibility === "shared_with_family" ? "共有済み" : "内部メモ"}
              </span>
              <span className="text-xs text-slate-400">
                {new Date(note.createdAt).toLocaleDateString("ja-JP")}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-slate-800">{note.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function VisibilityToggle({
  label,
  active,
  onClick,
  activeClassName = "bg-[#0F2537] text-white",
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  activeClassName?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 rounded-full px-3 text-xs font-semibold ${
        active ? activeClassName : "bg-slate-100 text-slate-500"
      }`}
    >
      {label}
    </button>
  );
}
