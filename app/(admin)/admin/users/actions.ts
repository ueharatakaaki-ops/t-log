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

const coachFieldsSchema = z.object({
  title: z.string().optional().nullable(),
});

// スクール管理者が実質的にコーチも兼ねるケース（小規模スクールでは一般的）に対応するため、
// school_admin発行時にも「コーチ業務も兼任するか」を選べるようにする。
// 兼任する場合は、school_adminとは別にcoachesテーブルの行も作成し、
// コーチメモの記入等コーチ専用機能が使えるようにする。
const schoolAdminFieldsSchema = z.object({
  alsoCoach: z.boolean().optional(),
  title: z.string().optional().nullable(),
});

const inviteSchema = z.discriminatedUnion("role", [
  // 生年月日はスクール管理者/コーチによる代理入力だと誤りが起きやすいため、
  // 招待時には求めず、選手本人が初回ログイン時に入力する方式にした
  // (app/onboarding/birthdate 参照)
  baseSchema.extend({ role: z.literal("player") }),
  baseSchema.extend({ role: z.literal("coach") }).merge(coachFieldsSchema),
  baseSchema.extend({ role: z.literal("parent") }),
  baseSchema.extend({ role: z.literal("school_admin") }).merge(schoolAdminFieldsSchema),
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
    // 生年月日はここでは設定しない(null)。選手本人が初回ログイン時の
    // オンボーディング画面(/onboarding/birthdate)で入力するまでは
    // 学年は「未設定」として扱われる
    const { error } = await supabaseAdmin.from("players").insert({
      id: newUserId,
      school_id: admin.schoolId,
      full_name: parsed.data.displayName,
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
  } else if (parsed.data.role === "school_admin" && parsed.data.alsoCoach) {
    // スクール管理者がコーチ業務も兼任する場合、coachesテーブルにも行を作っておく
    // （コーチメモ等、coachesテーブルの行を前提とする機能を使えるようにするため）
    const { error } = await supabaseAdmin.from("coaches").insert({
      id: newUserId,
      school_id: admin.schoolId,
      title: parsed.data.title || null,
    });
    if (error) return { ok: false, error: "コーチプロフィール（兼任分）の作成に失敗しました" };
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

export type SendPasswordResetLinkResult = { ok: true } | { ok: false; error: string };

/**
 * 既存ユーザーがパスワードを忘れた場合に、パスワード再設定メールを送る。
 *
 * 重要: これは inviteUser（新規アカウント発行）とは別物。inviteUserByEmail を
 * 既に本登録済み（確認済み）のメールアドレスに対してもう一度呼んでも、Supabase側は
 * 「既に登録済みのメールアドレスです」というエラーを返すだけで、以前使っていた
 * アカウント（選手のこれまでの記録等）にログインし直せるようにはならない。
 * 既存アカウントのパスワードだけをリセットしたい場合は、resetPasswordForEmail
 * （Supabaseの「Reset Password」メールテンプレートでリンクを送る機能）を使う必要がある。
 *
 * 事前準備: Supabaseダッシュボードの Authentication → Emails → Templates →
 * 「Reset Password」テンプレートの本文にあるリンクを、招待メールと同じ形式
 * （{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery）に
 * 変更しておく必要がある（招待メールのテンプレート修正時と同じ考え方）。
 */
export async function sendPasswordResetLink(userId: string): Promise<SendPasswordResetLinkResult> {
  const admin = await requireAdmin();
  const supabaseAdmin = createAdminClient();

  // 自校のユーザーにしか送れないようにする（他校のユーザーIDを渡されても弾く）
  const { data: targetUser } = await supabaseAdmin
    .from("app_users")
    .select("id, school_id")
    .eq("id", userId)
    .eq("school_id", admin.schoolId)
    .maybeSingle();

  if (!targetUser) {
    return { ok: false, error: "対象のユーザーが見つかりません" };
  }

  const { data: authUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (getUserError || !authUser?.user?.email) {
    return { ok: false, error: "ユーザーのメールアドレスを取得できませんでした" };
  }

  const { error } = await supabaseAdmin.auth.resetPasswordForEmail(authUser.user.email);
  if (error) {
    return { ok: false, error: `パスワード再設定メールの送信に失敗しました: ${error.message}` };
  }

  await logAudit({
    schoolId: admin.schoolId,
    actorId: admin.userId,
    action: "update",
    targetTable: "app_users",
    targetId: userId,
  });

  return { ok: true };
}
