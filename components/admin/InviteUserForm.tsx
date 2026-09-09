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

const CATEGORIES = [
  { value: "U12", label: "U12" },
  { value: "U14", label: "U14" },
  { value: "U15", label: "U15" },
  { value: "U18", label: "U18" },
];

export function InviteUserForm() {
  const router = useRouter();
  const [role, setRole] = useState<InviteUserInput["role"]>("player");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [grade, setGrade] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [title, setTitle] = useState("");

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      let input: InviteUserInput;
      if (role === "player") {
        input = {
          role,
          email,
          displayName,
          birthdate: birthdate || null,
          grade: grade || null,
          category: (category as "U12" | "U14" | "U15" | "U18" | null) ?? null,
        };
      } else if (role === "coach") {
        input = { role, email, displayName, title: title || null };
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
        <>
          <div>
            <span className="mb-2 block text-base font-semibold text-[#0F2537]">生年月日</span>
            <input
              type="date"
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-base text-[#0F2537] outline-none focus:border-[#0F2537]"
            />
          </div>
          <TextField label="学年" value={grade} onChange={setGrade} placeholder="例: 高2" />
          <SingleChoiceChips label="カテゴリー" options={CATEGORIES} value={category} onChange={setCategory} />
        </>
      )}

      {role === "coach" && (
        <TextField label="役職" value={title} onChange={setTitle} placeholder="例: ヘッドコーチ" />
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
