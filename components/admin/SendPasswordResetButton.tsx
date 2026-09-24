"use client";

import { useState, useTransition } from "react";
import { sendPasswordResetLink } from "@/app/(admin)/admin/users/actions";

/**
 * 既存ユーザーがパスワードを忘れた場合に、パスワード再設定メールを送るボタン。
 * どのロールのユーザーにも表示する（選手・保護者・コーチ・スクール管理者、誰でも
 * パスワードを忘れる可能性があるため）。
 */
export function SendPasswordResetButton({ userId, displayName }: { userId: string; displayName: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function handleClick() {
    setMessage(null);
    startTransition(async () => {
      const res = await sendPasswordResetLink(userId);
      setMessage(
        res.ok
          ? { ok: true, text: "パスワード再設定メールを送信しました" }
          : { ok: false, text: res.error }
      );
    });
  }

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4">
      <p className="mb-1 text-sm font-semibold text-[#0F2537]">パスワードを忘れた場合</p>
      <p className="mb-3 text-xs text-slate-500">
        {displayName}さん宛に、これまで通り使っていたアカウントのままパスワードだけを再設定できるメールを送ります（新しいアカウントは作られません）。
      </p>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="h-11 w-full rounded-xl bg-[#0F2537] text-sm font-semibold text-white disabled:opacity-50"
      >
        {isPending ? "送信中..." : "パスワード再設定メールを送る"}
      </button>
      {message && (
        <p className={`mt-2 text-sm font-medium ${message.ok ? "text-emerald-700" : "text-rose-600"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
