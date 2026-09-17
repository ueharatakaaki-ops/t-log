import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRoleLanding } from "@/lib/auth/role-landing";
import { BirthdateOnboardingForm } from "@/components/onboarding/BirthdateOnboardingForm";

export const dynamic = "force-dynamic";

/**
 * 選手が初回ログイン時（パスワード設定直後）に、自分の生年月日を入力する画面。
 * app/(player)/layout.tsx から、birthdateが未設定の選手はここへリダイレクトされる。
 */
export default async function OnboardingBirthdatePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: appUser } = await supabase.from("app_users").select("role").eq("id", user.id).single();

  // 選手以外のロールはこの画面自体が不要
  if (!appUser || appUser.role !== "player") {
    redirect(getRoleLanding(appUser?.role));
  }

  const { data: player } = await supabase.from("players").select("birthdate").eq("id", user.id).single();

  // 既に入力済みなら通常の画面へ（この画面を直接開き直した場合の救済）
  if (player?.birthdate) {
    redirect(getRoleLanding("player"));
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#F4F6F8] px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-2xl font-bold text-[#0F2537]">t-log</h1>
        <p className="mb-8 text-center text-sm text-slate-500">はじめに、生年月日を入力してください</p>

        <BirthdateOnboardingForm />
      </div>
    </main>
  );
}
