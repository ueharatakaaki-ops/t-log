"use server";

import { z } from "zod";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const schema = z.object({
  birthdate: z.string().min(1, "生年月日を入力してください"),
});

export type SetOwnBirthdateResult = { ok: true } | { ok: false; error: string };

/**
 * 選手本人が初回ログイン時に自分の生年月日を入力するための処理。
 *
 * 以前は招待時にスクール管理者/コーチが代理で生年月日を入力していたが、
 * 名簿からの転記ミスが起きやすいため、本人（または実際に操作する保護者）が
 * 直接入力する方式に変更した。学年は生年月日から自動計算されるため、
 * ここで正確な値が入ることが重要。
 *
 * 一度設定した生年月日を選手本人が自由に書き換えられると、学年記録の
 * 正確性・公平性が損なわれるため、このアクションは「まだ未設定(null)の
 * 場合のみ」更新を許可する。設定済みの生年月日に誤りがあった場合の訂正は、
 * スクール管理者が対応する運用とする。
 */
export async function setOwnBirthdate(input: { birthdate: string }): Promise<SetOwnBirthdateResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "ログインが必要です" };
  }

  const { data: appUser } = await supabase.from("app_users").select("id, role").eq("id", user.id).single();

  if (!appUser || appUser.role !== "player") {
    return { ok: false, error: "選手アカウントでログインしてください" };
  }

  // RLS上は選手本人によるplayers行の更新を許可していないため、
  // (誰でも自分の学年を書き換えられてしまうのを防ぐため)、ここでは
  // 上でロールを確認した上でservice role clientを使う。
  // birthdateがまだnullの行だけを対象にすることで、一度設定した値を
  // 本人が後から自由に上書きできないようにしている。
  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin
    .from("players")
    .update({ birthdate: parsed.data.birthdate })
    .eq("id", appUser.id)
    .is("birthdate", null);

  if (error) {
    return { ok: false, error: "保存に失敗しました。時間をおいて再度お試しください" };
  }

  return { ok: true };
}
