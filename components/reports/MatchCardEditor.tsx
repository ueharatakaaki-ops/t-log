"use client";

import { useState, useTransition } from "react";
import { MatchShareCard } from "@/components/reports/MatchShareCard";
import { updateMatchCoachComment } from "@/app/(coach)/matches/[id]/card/actions";
import type { MatchCardDetail } from "@/lib/queries/match-detail";

export function MatchCardEditor({ match }: { match: MatchCardDetail }) {
  const [coachComment, setCoachComment] = useState(match.coachComment ?? "");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleSave() {
    setMessage(null);
    startTransition(async () => {
      const res = await updateMatchCoachComment(match.id, coachComment);
      setMessage(res.ok ? "保存しました" : res.error);
    });
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="flex justify-center lg:sticky lg:top-6">
        <MatchShareCard match={{ ...match, coachComment }} />
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <div>
          <span className="mb-2 block text-sm font-semibold text-[#0F2537]">コーチからのひとこと</span>
          <textarea
            value={coachComment}
            onChange={(e) => setCoachComment(e.target.value)}
            rows={4}
            maxLength={200}
            placeholder="SNSカードに載せる短いコメント（200文字以内）"
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-[#0F2537]"
          />
        </div>

        <button
          type="button"
          disabled={isPending}
          onClick={handleSave}
          className="h-11 rounded-xl bg-[#0F2537] text-sm font-semibold text-white disabled:opacity-50"
        >
          {isPending ? "保存中..." : "コメントを保存"}
        </button>

        {message && <p className="text-sm text-slate-600">{message}</p>}

        <p className="text-xs text-slate-400">
          カードを画像として使うには、この画面のスクリーンショットを撮ってご利用ください（正方形なのでInstagram投稿にそのまま使えます）。
        </p>
      </div>
    </div>
  );
}
