"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePlayerBirthdate } from "@/app/(admin)/admin/users/[id]/actions";
import type { AdminUserDetail } from "@/lib/queries/admin-users";

export function EditPlayerBirthdateForm({ user }: { user: AdminUserDetail }) {
  const router = useRouter();
  const [birthdate, setBirthdate] = useState(user.birthdate ?? "");

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const res = await updatePlayerBirthdate({ userId: user.id, birthdate });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {!user.birthdate && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
          この選手はまだ生年月日を入力していません（初回ログイン時に本人が入力する画面が表示されます）。
        </p>
      )}

      <div>
        <span className="mb-2 block text-base font-semibold text-[#0F2537]">生年月日</span>
        <input
          type="date"
          value={birthdate}
          onChange={(e) => setBirthdate(e.target.value)}
          className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-base text-[#0F2537] outline-none focus:border-[#0F2537]"
        />
        <p className="mt-1 text-xs text-slate-400">
          学年（小学◯年・中学◯年・高校◯年）は生年月日から自動計算されます。通常は選手本人が入力しますが、誤りがあった場合はここから訂正できます。
        </p>
      </div>

      {error && <p className="rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</p>}
      {saved && !error && <p className="text-sm font-semibold text-[#00A859]">保存しました</p>}

      <button
        type="button"
        disabled={!birthdate || isPending}
        onClick={handleSubmit}
        className="h-12 rounded-xl bg-[#0F2537] text-base font-bold text-white disabled:bg-slate-200 disabled:text-slate-400"
      >
        {isPending ? "保存中..." : "保存する"}
      </button>
    </div>
  );
}
