// lib/daily-log/save.ts の単体テスト（npm test で実行）。
// Supabase には接続せず、必要な呼び出しだけを持つ偽クライアントで動かす。
import { test } from "node:test";
import assert from "node:assert/strict";
import { saveDailyLog, isSameDailyLogContent } from "@/lib/daily-log/save";

const PLAYER_ID = "00000000-0000-0000-0000-000000000001";
const SCHOOL_ID = "00000000-0000-0000-0000-0000000000aa";

// 修正期限（翌日9:00 JST）を過ぎた過去日。救済入力を想定
const PAST_DATE = "2026-10-01";
const AFTER_DEADLINE = new Date("2026-10-03T00:00:00Z");

const input = {
  logDate: PAST_DATE,
  sleepHours: 7.5,
  fatigueLevel: 4,
  hasPain: true,
  painLocations: ["肘", "膝"],
  hasPractice: true,
  practiceIntensity: 6,
  selfScore: 8,
  notes: "テスト用メモ",
  coachMessage: "",
};

// 保存済みの行（DBからはこのような形で返る。numeric は文字列で返る場合がある想定も含める）
const savedRow = {
  sleep_hours: "7.5",
  fatigue_level: 4,
  has_pain: true,
  pain_locations: ["膝", "肘"],
  has_practice: true,
  practice_intensity: 6,
  self_score: 8,
  notes: "テスト用メモ",
  coach_message: null,
};

function fakeSupabase(opts: { existing: Record<string, unknown> | null; role?: string; user?: boolean }) {
  const upserts: unknown[] = [];
  const client = {
    auth: {
      getUser: async () => ({ data: { user: opts.user === false ? null : { id: PLAYER_ID } } }),
    },
    from(table: string) {
      const query = {
        select: () => query,
        eq: () => query,
        single: async () => ({
          data: { id: PLAYER_ID, school_id: SCHOOL_ID, role: opts.role ?? "player" },
          error: null,
        }),
        maybeSingle: async () => ({ data: opts.existing, error: null }),
        upsert: async (row: unknown) => {
          upserts.push({ table, row });
          return { error: null };
        },
      };
      return query;
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: client as any, upserts };
}

test("通常の初回保存（既存ログなし）は ok で、upsert される", async () => {
  const { client, upserts } = fakeSupabase({ existing: null });
  const result = await saveDailyLog(client, input, { now: AFTER_DEADLINE });
  assert.deepEqual(result, { ok: true });
  assert.equal(upserts.length, 1);
});

test("修正期限後に同一内容が再送された場合は ok（保存済みとして扱い、書き込まない）", async () => {
  const { client, upserts } = fakeSupabase({ existing: savedRow });
  const result = await saveDailyLog(client, input, { now: AFTER_DEADLINE });
  assert.deepEqual(result, { ok: true });
  assert.equal(upserts.length, 0);
});

test("修正期限後に内容が違う送信は期限エラー（deadline）", async () => {
  const { client, upserts } = fakeSupabase({ existing: savedRow });
  const result = await saveDailyLog(client, { ...input, selfScore: 9 }, { now: AFTER_DEADLINE });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.reason, "deadline");
  assert.match(!result.ok ? result.error : "", /修正期限/);
  assert.equal(upserts.length, 0);
});

test("修正期限内なら既存ログがあっても上書き保存される", async () => {
  const { client, upserts } = fakeSupabase({ existing: savedRow });
  const beforeDeadline = new Date("2026-10-01T12:00:00Z");
  const result = await saveDailyLog(client, { ...input, selfScore: 9 }, { now: beforeDeadline });
  assert.deepEqual(result, { ok: true });
  assert.equal(upserts.length, 1);
});

test("未ログインは unauthenticated、選手以外は forbidden、不正な入力は validation", async () => {
  const noUser = await saveDailyLog(fakeSupabase({ existing: null, user: false }).client, input);
  assert.equal(!noUser.ok && noUser.reason, "unauthenticated");

  const coach = await saveDailyLog(fakeSupabase({ existing: null, role: "coach" }).client, input);
  assert.equal(!coach.ok && coach.reason, "forbidden");

  const invalid = await saveDailyLog(fakeSupabase({ existing: null }).client, { ...input, fatigueLevel: 11 });
  assert.equal(!invalid.ok && invalid.reason, "validation");
});

test("isSameDailyLogContent: 空文字と null、痛みの部位の順序の違いは同一とみなす", () => {
  const row = {
    sleep_hours: 7.5,
    fatigue_level: 4,
    has_pain: true,
    pain_locations: ["肘", "膝"],
    has_practice: true,
    practice_intensity: 6,
    self_score: 8,
    notes: "テスト用メモ",
    coach_message: null,
  };
  assert.equal(isSameDailyLogContent({ ...savedRow, coach_message: "" }, row), true);
  assert.equal(isSameDailyLogContent({ ...savedRow, notes: "別のメモ" }, row), false);
  assert.equal(isSameDailyLogContent({ ...savedRow, pain_locations: ["肘"] }, row), false);
  assert.equal(isSameDailyLogContent({ ...savedRow, sleep_hours: 8 }, row), false);
});
