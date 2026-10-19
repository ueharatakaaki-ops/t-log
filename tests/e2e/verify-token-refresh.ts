/**
 * POST /api/daily-log（middleware の対象外）の中で、期限切れのアクセストークンが自動更新され、
 * 更新後の Cookie がレスポンスに付くことを確認する。
 *
 * 使い方（別ターミナルで npm run dev などでアプリを起動しておく）:
 *   BASE_URL=http://localhost:3100 npx tsx tests/e2e/verify-token-refresh.ts
 *
 * デモスクールの「デモ コーチ」でログインし、セッション Cookie の expires_at だけを過去にして送る。
 * コーチは選手ではないため 403 で止まり、daily_logs には何も書き込まない。
 * トークン・Cookie の値は表示しない（判定結果だけを表示する）。
 */
import { demoSessionCookies, readSession, toCookieHeader, writeSession, type SimpleCookie } from "./demo-auth";
import { todayInJst } from "../../lib/date";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3100";

const body = JSON.stringify({
  logDate: todayInJst(),
  sleepHours: 7,
  fatigueLevel: 3,
  hasPain: false,
  painLocations: [],
  hasPractice: false,
  practiceIntensity: null,
  selfScore: 7,
  notes: "",
  coachMessage: "",
});

async function post(cookieHeader: string | null) {
  const res = await fetch(`${BASE_URL}/api/daily-log`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookieHeader ? { Cookie: cookieHeader } : {}) },
    body,
    redirect: "manual",
  });
  const setCookies = res.headers.getSetCookie();
  return { status: res.status, cacheControl: res.headers.get("cache-control"), json: await res.json(), setCookies };
}

function parseSetCookies(setCookies: string[]): SimpleCookie[] {
  return setCookies
    .map((sc) => sc.split(";")[0])
    .map((pair) => ({ name: pair.slice(0, pair.indexOf("=")), value: decodeURIComponent(pair.slice(pair.indexOf("=") + 1)) }))
    .filter((c) => c.value !== "");
}

function check(label: string, ok: boolean) {
  console.log(`${ok ? "✔" : "✘"} ${label}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  // 1. 未ログイン → 401 の JSON（リダイレクトしない）
  const anon = await post(null);
  check(`未ログインは 401 の JSON（実際: ${anon.status} / ok=${anon.json.ok}）`, anon.status === 401 && anon.json.ok === false);
  check(`Cache-Control: no-store（実際: ${anon.cacheControl}）`, anon.cacheControl?.includes("no-store") === true);

  // 2. 期限切れ扱いのセッション → ハンドラー内で更新され、新しい Cookie が返る
  const cookies = await demoSessionCookies("coach");
  const { baseName, session } = readSession(cookies);
  const oldAccessToken = session.access_token;
  const expired = writeSession(baseName, { ...session, expires_at: Math.floor(Date.now() / 1000) - 60 });

  const refreshed = await post(toCookieHeader([expired]));
  check(`期限切れセッションでも認証される（403=ロール不一致で止まる。実際: ${refreshed.status}）`, refreshed.status === 403);

  const returned = parseSetCookies(refreshed.setCookies);
  const hasAuthCookie = returned.some((c) => c.name.startsWith(baseName));
  check("レスポンスに更新後のセッション Cookie（Set-Cookie）が付く", hasAuthCookie);
  if (!hasAuthCookie) return;

  const next = readSession(returned).session;
  check("アクセストークンが新しいものに変わっている", next.access_token !== oldAccessToken);
  check("新しい有効期限が未来になっている", Number(next.expires_at) > Date.now() / 1000);

  // 3. 返ってきた Cookie で次のリクエストも認証される
  const again = await post(toCookieHeader(returned));
  check(`更新後の Cookie で再度認証される（実際: ${again.status}）`, again.status === 403);
}

main().catch((e) => {
  console.error("検証スクリプトの実行に失敗:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
