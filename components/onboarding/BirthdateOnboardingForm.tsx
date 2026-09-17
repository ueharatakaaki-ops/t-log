"use client";

import { useState, useTransition } from "react";
import { setOwnBirthdate } from "@/app/onboarding/birthdate/actions";

export function BirthdateOnboardingForm() {
  const [birthdate, setBirthdate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const res = await setOwnBirthdate({ birthdate });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // ログイン画面・パスワード設定画面と同じ理由で、Cookie同期を確実にするため
      // フルページ遷移にする
      window.location.href = "/daily-log";
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="mb-2 block text-base font-semibold text-[#0F2537]">
          生年月日 <span className="text-rose-500">*</span>
        </span>
        <input
          type="date"
          value={birthdate}
          onChange={(e) => setBirthdate(e.target.value)}
          className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-base text-[#0F2537] outline-none focus:border-[#0F2537]"
        />
        <p className="mt-2 text-xs text-slate-400">
          学年（小学◯年・中学◯年・高校◯年）はここで入力した生年月日から自動計算されます。一度保存すると、変更したい場合はスクール管理者に連絡してください。
        </p>
      </div>

      {error && <p className="rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</p>}

      <button
        type="button"
        disabled={!birthdate || isPending}
        onClick={handleSubmit}
        className="h-12 rounded-xl bg-[#0F2537] text-base font-bold text-white disabled:bg-slate-200 disabled:text-slate-400"
      >
        {isPending ? "保存中..." : "保存してはじめる"}
      </button>
    </div>
  );
}
