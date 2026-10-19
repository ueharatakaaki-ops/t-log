"use client";

import { useState, useTransition } from "react";
import { generateAccessLink, resendInvite } from "@/app/(admin)/admin/users/actions";
import type { AuthStatus } from "@/lib/queries/admin-users";
import { formatJstDateTime as formatDateTime } from "@/lib/date";

/**
 * ユーザー詳細画面の「登録状況」と、メールが届かない・リンクが開けない人を救うための操作。
 * - 未登録: 招待メールの再送
 * - 全員: 1回限りの登録（再設定）リンクの作成（メールは送らず、画面に表示するだけ）
 *
 * 作成したリンクはパスワードと同じ扱い。この画面の表示以外には出さない（console にも出さない）。
 */
export function AccountAccessPanel({
  userId,
  displayName,
  auth,
}: {
  userId: string;
  displayName: string;
  auth: AuthStatus | null;
}) {
  const [isResending, startResend] = useTransition();
  const [isGenerating, startGenerate] = useTransition();
  const [resendMessage, setResendMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleResend() {
    setResendMessage(null);
    startResend(async () => {
      const res = await resendInvite(userId);
      setResendMessage(res.ok ? { ok: true, text: "招待メールを再送しました" } : { ok: false, text: res.error });
    });
  }

  function handleGenerate() {
    setLinkError(null);
    setLink(null);
    setCopied(false);
    startGenerate(async () => {
      const res = await generateAccessLink(userId);
      if (res.ok) setLink(res.link);
      else setLinkError(res.error);
    });
  }

  async function handleCopy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // クリップボードが使えない場合は、表示中のリンクを選択して手動でコピーしてもらう
      const input = document.getElementById("access-link") as HTMLInputElement | null;
      input?.select();
    }
  }

  const registered = auth?.registered ?? true;

  return (
    <div className="mb-6 rounded-xl border border-slate-100 bg-white p-4">
      <p className="mb-2 text-sm font-semibold text-[#0F2537]">登録状況</p>
      <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-slate-500">状態</dt>
        <dd className={registered ? "text-slate-700" : "font-semibold text-amber-700"}>
          {auth ? (registered ? "登録済み" : "未登録（招待済み・まだリンクを確認していません）") : "不明"}
        </dd>
        <dt className="text-slate-500">招待日時</dt>
        <dd className="text-slate-700">{formatDateTime(auth?.invitedAt ?? null)}</dd>
        <dt className="text-slate-500">最終ログイン</dt>
        <dd className="text-slate-700">{formatDateTime(auth?.lastSignInAt ?? null)}</dd>
      </dl>

      {auth && !registered && (
        <div className="mb-4">
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending}
            className="h-11 w-full rounded-xl border border-[#0F2537] text-sm font-semibold text-[#0F2537] disabled:opacity-50"
          >
            {isResending ? "送信中..." : "招待メールを再送"}
          </button>
          <p className="mt-1 text-xs text-slate-500">前回送った招待メールのリンクは使えなくなります。</p>
          {resendMessage && (
            <p className={`mt-2 text-sm font-medium ${resendMessage.ok ? "text-emerald-700" : "text-rose-600"}`}>
              {resendMessage.text}
            </p>
          )}
        </div>
      )}

      <p className="mb-1 text-sm font-semibold text-[#0F2537]">メールが届かない・リンクが開けない場合</p>
      <p className="mb-3 text-xs leading-relaxed text-slate-500">
        {displayName}さん専用の、1回だけ使える{registered ? "パスワード再設定" : "登録"}リンクを作ります（メールは送りません）。
        作り直すと、以前のリンク（メールで送ったものを含む）は使えなくなります。
      </p>
      <button
        type="button"
        onClick={handleGenerate}
        disabled={isGenerating}
        className="h-11 w-full rounded-xl bg-[#0F2537] text-sm font-semibold text-white disabled:opacity-50"
      >
        {isGenerating ? "作成中..." : "1回限りの登録リンクを作る"}
      </button>
      {linkError && <p className="mt-2 text-sm font-medium text-rose-600">{linkError}</p>}
      {link && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3">
          <p className="mb-2 text-xs font-semibold leading-relaxed text-rose-700">
            このリンクはパスワードと同じ扱いです。本人以外に見せない・LINE などで本人にだけ送る・一度使うと無効になります。
          </p>
          <input
            id="access-link"
            readOnly
            value={link}
            aria-label="1回限りの登録リンク"
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="mt-2 h-10 w-full rounded-lg bg-white text-sm font-semibold text-[#0F2537] ring-1 ring-slate-200"
          >
            {copied ? "コピーしました" : "リンクをコピー"}
          </button>
        </div>
      )}
    </div>
  );
}
