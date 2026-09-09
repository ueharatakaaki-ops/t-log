"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit/log";

const baseSchema = z.object({
  email: z.string().email("メールアドレスの形式が不正です"),
  displayName: z.string().min(1, "氏名を入力してください").max(200),
});

const playerFieldsSchema = z.object({
  birthdate: z.string().optional().nullable(),
  grade: z.string().optional().nullable(),
  category: z.enum(["U12", "U14", "U15", "U18"]).optional().nullable(),
});

const coachFieldsSchema = z.object({
  title: z.string().optional().nullable(),
});

const inviteSchema = z.discriminatedUnion("role", [
  baseSchema.extend({ role: z.literal("player") }).merge(playerFieldsSchema),
  baseSchema.extend({ role: z.literal("coach") }).merge(coachFieldsSchema),
  baseSchema.extend({ role: z.literal("parent") }),
  baseSchema.extend({ role: z.literal("school_admin") }),
]);

export type InviteUserInput = z.infer<typeof inviteSchema>;
export type InviteUserResult = { ok: true } | { ok: false; error: string };

/**
 * 選手・コーチ・保護者・スクール管理者のアカウントを発行する（招待制。セルフサインアップは無効）。
 * 1. Supabase Authに招待メールを送信してユーザーを作成
 * 2. app_users + ロール別プロフィール行を同時に作成
 *    （DBトリガーではなくここで明示的に行う。理由: ロール・school_id・
 *      選手プロフィール等の情報を同時に確定させる必要があり、
 *      トリガーだけでは情報が不足するため）
 */
export async function inviteUser(input: InviteUserInput): Promise<InviteUserResult> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const admin = await requireAdmin();
  // school_admin は school_admin ロールのユーザーを発行できない（権限昇格の防止）。system_adminのみ許可。
  if (parsed.data.role === "school_admin" && admin.role !== "system_admin") {
    return { ok: false, error: "スクール管理者の発行はシステム管理者のみ行えます" };
  }

  const supabaseAdmin = createAdminClient();

  const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    parsed.data.email,
    { data: { display_name: parsed.data.displayName } }
  );

  if (inviteError || !invited?.user) {
    return { ok: false, error: `招待メールの送信に失敗しました: ${inviteError?.message ?? "unknown error"}` };
  }

  const newUserId = invited.user.id;

  const { error: appUserError } = await supabaseAdmin.from("app_users").insert({
    id: newUserId,
    school_id: admin.schoolId,
    role: parsed.data.role,
    display_name: parsed.data.displayName,
  });

  if (appUserError) {
    // app_usersの作成に失敗した場合、認証ユーザーだけが残ると不整合になるため取り消す
    await supabaseAdmin.auth.admin.deleteUser(newUserId);
    return { ok: false, error: "ユーザー情報の作成に失敗しました" };
  }

  if (parsed.data.role === "player") {
    const { error } = await supabaseAdmin.from("players").insert({
      id: newUserId,
      school_id: admin.schoolId,
      full_name: parsed.data.displayName,
      birthdate: parsed.data.birthdate || null,
      grade: parsed.data.grade || null,
      category: parsed.data.category || null,
    });
    if (error) return { ok: false, error: "選手プロフィールの作成に失敗しました" };
  } else if (parsed.data.role === "coach") {
    const { error } = await supabaseAdmin.from("coaches").insert({
      id: newUserId,
      school_id: admin.schoolId,
      title: parsed.data.title || null,
    });
    if (error) return { ok: false, error: "コーチプロフィールの作成に失敗しました" };
  } else if (parsed.data.role === "parent") {
    const { error } = await supabaseAdmin.from("parents").insert({
      id: newUserId,
      school_id: admin.schoolId,
    });
    if (error) return { ok: false, error: "保護者プロフィールの作成に失敗しました" };
  }

  await logAudit({
    schoolId: admin.schoolId,
    actorId: admin.userId,
    action: "create",
    targetTable: "app_users",
    targetId: newUserId,
  });

  revalidatePath("/admin/users");
  return { ok: true };
}
