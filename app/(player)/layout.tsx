import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/nav/BottomNav";
import { TopBar } from "@/components/nav/TopBar";
import { PLAYER_NAV_ITEMS } from "@/lib/nav/player-nav";

export default async function PlayerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: player } = await supabase
      .from("players")
      .select("birthdate")
      .eq("id", user.id)
      .maybeSingle();

    // 生年月日が未入力（招待時に代理入力せず本人入力へ移行したため）の選手は、
    // 学年計算に必要な生年月日を先に入力してもらう
    if (player && !player.birthdate) {
      redirect("/onboarding/birthdate");
    }
  }

  return (
    <>
      <TopBar />
      <div className="pb-16">{children}</div>
      <BottomNav items={PLAYER_NAV_ITEMS} />
    </>
  );
}
