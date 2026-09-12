"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  physicalMeasurementSchema,
  type PhysicalMeasurementInput,
} from "@/lib/validations/physical-measurement";
import { mapPhysicalMeasurement } from "@/lib/queries/player-detail";

export type SubmitPhysicalMeasurementResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function submitPhysicalMeasurement(
  input: PhysicalMeasurementInput
): Promise<SubmitPhysicalMeasurementResult> {
  const parsed = physicalMeasurementSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "入力内容を確認してください",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "ログインが必要です" };
  }

  const { data: appUser, error: appUserError } = await supabase
    .from("app_users")
    .select("id, school_id, role")
    .eq("id", user.id)
    .single();

  if (appUserError || !appUser || appUser.role !== "player") {
    return { ok: false, error: "選手アカウントでログインしてください" };
  }

  const d = parsed.data;

  // player_id + measured_date のUNIQUE制約を利用し、同じ日に再送信した場合は上書きにする
  const { error } = await supabase.from("physical_measurements").upsert(
    {
      player_id: appUser.id,
      school_id: appUser.school_id,
      measured_date: d.measuredDate,
      height_cm: d.heightCm,
      weight_kg: d.weightKg,
      eyesight_left: d.eyesightLeft,
      eyesight_right: d.eyesightRight,
      grip_strength_left: d.gripStrengthLeft,
      grip_strength_right: d.gripStrengthRight,
      dominant_hand: d.dominantHand,
      racket: d.racket,
      shoes: d.shoes,
      strings: d.strings,
      source: "app",
    },
    { onConflict: "player_id,measured_date", ignoreDuplicates: false }
  );

  if (error) {
    return { ok: false, error: "保存に失敗しました。時間をおいて再度お試しください" };
  }

  revalidatePath("/physical");
  return { ok: true };
}

/** 直近の記録（前回値）を取得する。用具情報などを新規入力時に引き継いで表示するために使う */
export async function getMyLatestPhysicalMeasurement() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("physical_measurements")
    .select("*")
    .eq("player_id", user.id)
    .order("measured_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? mapPhysicalMeasurement(data) : null;
}

/** 自分の過去の記録を新しい順にすべて取得する */
export async function getMyPhysicalMeasurementHistory() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data } = await supabase
    .from("physical_measurements")
    .select("*")
    .eq("player_id", user.id)
    .order("measured_date", { ascending: false });

  return (data ?? []).map(mapPhysicalMeasurement);
}
