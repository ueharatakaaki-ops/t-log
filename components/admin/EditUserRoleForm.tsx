"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SingleChoiceChips } from "@/components/shared/SingleChoiceChips";
import { TextField } from "@/components/shared/TextField";
import { updateStaffRole } from "@/app/(admin)/admin/users/[id]/actions";
import type { AdminUserDetail } from "@/lib/queries/admin-users";

const ROLE_OPTIONS = [
  { value: "coach", label: "コーチ" },
  { value: "school_admin", label: "スクール管理者" },
];

export function EditUserRoleForm({ user }: { user: AdminUserDetail }) {
  const router = useRouter();
  const [role, setRole] = useState<"coach" | "school_admin">(user.role as "coach" | "school_admin");
  const [grantCoachProfile, setGrantCoachProfile] = useState(false);
  const [title, setTitle] = useState("");

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // 元々コーチとして招待された人（role='coach'）は、既にcoachesテーブルに行があるので、
  // スクール管理者に変えても自動的にコーチ機能を使い続けられる。
  // このトグルが必要なのは「今はコーチの行を持っていないユーザーに、新たに持たせたい」場合だけ。
  const showCoachToggle = role === "school_admin" && !user.hasCoachProfile;

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const res = await updateStaffRole({
        userId: user.id,
        role,
        grantCoachProfile: showCoachToggle ? grantCoachProfile : undefined,
        title: showCoachToggle && grantCoachProfile ? title || null : null,
      });
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
      <SingleChoiceChips label="ロール" options={ROLE_OPTIONS} value={role} onChange={(v) => setRole(v as "coach" | "school_admin")} />

      {role === "coach" && (
        <p className="text-sm text-slate-500">
          コーチロールにすると、ユーザー管理・紐付け管理などの管理画面には入れなくなります（コーチ用の画面のみ利用できます）。
        </p>
      )}

      {role === "school_admin" && user.hasCoachProfile && (
        <p className="rounded-lg bg-[#F4F6F8] p-3 text-sm text-slate-600">
          このユーザーは既にコーチとしても登録されています。スクール管理者に変更しても、コーチメモの記入など既存のコーチ機能はそのまま使えます。
        </p>
      )}

      {showCoachToggle && (
        <>
          <SingleChoiceChips
            label="コーチ業務も兼任させますか？"
            options={[
              { value: "no", label: "兼任させない" },
              { value: "yes", label: "兼任させる" },
            ]}
            value={grantCoachProfile ? "yes" : "no"}
            onChange={(v) => setGrantCoachProfile(v === "yes")}
          />
          <p className="-mt-4 text-xs text-slate-400">
            兼任させると、選手ごとのコーチメモの記入などコーチ専用の機能も使えるようになります。
          </p>
          {grantCoachProfile && (
            <TextField label="役職" value={title} onChange={setTitle} placeholder="例: ヘッドコーチ" />
          )}
        </>
      )}

      {error && <p className="rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</p>}
      {saved && !error && <p className="text-sm font-semibold text-[#00A859]">保存しました</p>}

      <button
        type="button"
        disabled={isPending}
        onClick={handleSubmit}
        className="h-12 rounded-xl bg-[#0F2537] text-base font-bold text-white disabled:opacity-60"
      >
        {isPending ? "保存中..." : "保存する"}
      </button>
    </div>
  );
}
