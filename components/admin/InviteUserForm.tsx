"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SingleChoiceChips } from "@/components/shared/SingleChoiceChips";
import { TextField } from "@/components/shared/TextField";
import { inviteUser, type InviteUserInput } from "@/app/(admin)/admin/users/actions";

const ROLES = [
  { value: "player", label: "選手" },
  { value: "coach", label: "コーチ" },
  { value: "parent", label: "保護者" },
  { value: "school_admin", label: "スクール管理者" },
];

export function InviteUserForm() {
  const router = useRouter();
  const [role, setRole] = useState<InviteUserInput["role"]>("player");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [title, setTitle] = useState("");
  const [alsoCoach, setAlsoCoach] = useState(false);

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      let input: InviteUserInput;
      if (role === "coach") {
        input = { role, email, displayName, title: title || null };
      } else if (role === "school_admin") {
        input = { role, email, displayName, alsoCoach, title: alsoCoach ? title || null : null };
      } else {
        input = { role, email, displayName };
      }

      const res = await inviteUser(input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/admin/users");
    });
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <SingleChoiceChips
        label="ロール"
        options={ROLES}
        value={role}
        onChange={(v) => setRole(v as InviteUserInput["role"])}
      />

      <TextField label="氏名" value={displayName} onChange={setDisplayName} required placeholder="例: 赤本 大地" />
      <TextField label="メールアドレス（招待先）" value={email} onChange={setEmail} required placeholder="example@nltc.jp" />

      {role === "player" && (
        <p className="rounded-xl bg-slate-100 p-3 text-xs leading-relaxed text-slate-500">
          生年月日はここでは入力しません。招待メールを受け取った選手本人が、初回ログイン時に自分で入力します（学年はそこから自動計算されます）。
        </p>
      )}

      {role === "coach" && (
        <TextField label="役職" value={title} onChange={setTitle} placeholder="例: ヘッドコーチ" />
      )}

      {role === "school_admin" && (
        <>
          <SingleChoiceChips
            label="コーチ業務も兼任しますか？"
            options={[
              { value: "no", label: "兼任しない" },
              { value: "yes", label: "兼任する" },
            ]}
            value={alsoCoach ? "yes" : "no"}
            onChange={(v) => setAlsoCoach(v === "yes")}
          />
          {alsoCoach && (
            <TextField label="役職" value={title} onChange={setTitle} placeholder="例: ヘッドコーチ" />
          )}
        </>
      )}

      {error && <p className="rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</p>}

      <button
        type="button"
        disabled={!email || !displayName || isPending}
        onClick={handleSubmit}
        className="h-12 rounded-xl bg-[#0F2537] text-base font-bold text-white disabled:bg-slate-200 disabled:text-slate-400"
      >
        {isPending ? "招待中..." : "招待メールを送信"}
      </button>
    </div>
  );
}
