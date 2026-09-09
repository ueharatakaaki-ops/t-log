"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { tournamentScheduleSchema, type TournamentScheduleInput } from "@/lib/validations/tournament-schedule";

export type ScheduleActionResult = { ok: true } | { ok: false; error: string };

async function requirePlayer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: appUser } = await supabase
    .from("app_users")
    .select("id, school_id, role")
    .eq("id", user.id)
    .single();

  if (!appUser || appUser.role !== "player") return null;
  return { supabase, appUser };
}

export async function addTournamentSchedule(input: TournamentScheduleInput): Promise<ScheduleActionResult> {
  const parsed = tournamentScheduleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const ctx = await requirePlayer();
  if (!ctx) return { ok: false, error: "選手アカウントでログインしてください" };

  const { error } = await ctx.supabase.from("tournament_schedules").insert({
    player_id: ctx.appUser.id,
    school_id: ctx.appUser.school_id,
    tournament_name: parsed.data.tournamentName,
    start_date: parsed.data.startDate,
    end_date: parsed.data.endDate,
    venue: parsed.data.venue || null,
    surface: parsed.data.surface || null,
  });

  if (error) return { ok: false, error: "登録に失敗しました" };

  revalidatePath("/schedule");
  return { ok: true };
}

export async function deleteTournamentSchedule(id: string): Promise<ScheduleActionResult> {
  const ctx = await requirePlayer();
  if (!ctx) return { ok: false, error: "選手アカウントでログインしてください" };

  const { error } = await ctx.supabase
    .from("tournament_schedules")
    .delete()
    .eq("id", id)
    .eq("player_id", ctx.appUser.id);

  if (error) return { ok: false, error: "削除に失敗しました" };

  revalidatePath("/schedule");
  return { ok: true };
}
