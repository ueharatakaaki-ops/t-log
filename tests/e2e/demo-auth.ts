// E2Eテスト・検証スクリプト用: デモスクールのダミーアカウントでログインし、
// アプリと同じ形式（@supabase/ssr）のセッション Cookie を作る。
// パスワードはリポジトリ外の認証情報ファイル（scripts/demo/README.md 参照）から読み、画面には出さない。
import "../../scripts/demo/env";
import { createServerClient } from "@supabase/ssr";
import { DEMO_ACCOUNTS, loadSavedPasswords, type DemoAccountKey } from "../../scripts/demo/common";

export type SimpleCookie = { name: string; value: string };

export async function demoSessionCookies(key: DemoAccountKey): Promise<SimpleCookie[]> {
  const email = DEMO_ACCOUNTS[key].email;
  const password = loadSavedPasswords().get(email.toLowerCase());
  if (!password) throw new Error(`デモアカウント(${key})のパスワードが認証情報ファイルにありません`);

  const jar = new Map<string, string>();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (cookies: { name: string; value: string }[]) =>
          cookies.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
      },
    }
  );
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`デモアカウント(${key})でログインできません: ${error.message}`);
  return [...jar].map(([name, value]) => ({ name, value }));
}

// --- 検証用: セッション Cookie の中身（JSON）を読み書きする ---

const BASE64_PREFIX = "base64-";

/** 分割（.0, .1, ...）されている場合も含めて、セッション JSON を取り出す */
export function readSession(cookies: SimpleCookie[]): { baseName: string; session: Record<string, unknown> } {
  const authCookies = cookies
    .filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (authCookies.length === 0) throw new Error("セッション Cookie がありません");
  const baseName = authCookies[0].name.replace(/\.\d+$/, "");
  let raw = authCookies.map((c) => c.value).join("");
  if (raw.startsWith(BASE64_PREFIX)) {
    raw = Buffer.from(raw.slice(BASE64_PREFIX.length), "base64url").toString("utf8");
  }
  return { baseName, session: JSON.parse(raw) };
}

/** セッション JSON を1つの Cookie にする（Node の fetch からの送信用。ブラウザの4KB制限は考えない） */
export function writeSession(baseName: string, session: Record<string, unknown>): SimpleCookie {
  const value = BASE64_PREFIX + Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return { name: baseName, value };
}

export function toCookieHeader(cookies: SimpleCookie[]): string {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}
