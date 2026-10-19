// 招待・パスワード再設定リンク（/auth/confirm）、確認コード（/auth/code）、管理者の1回限りリンクのブラウザテスト。
// デモスクールに、テストごとの使い捨てユーザー（保護者ロール）を作って使い、テスト後に削除する。
// リンク・コードは generateLink（メール送信なし）で作るため、メールは送らない
// （招待メール再送のテストだけは E2E_SEND_EMAIL=1 のときに1通送る）。
import { randomBytes } from "node:crypto";
import { test, expect as baseExpect, type Browser, type Page } from "@playwright/test";
import { demoSessionCookies, type SimpleCookie } from "./demo-auth";
import {
  countAccessLinkAudits,
  createTempUser,
  deleteLeftoverTempUsers,
  deleteTempUser,
  generateLinkFor,
  getAuthUpdatedAt,
  TEMP_DISPLAY_NAME,
  type LinkProps,
  type TempUser,
} from "./demo-temp-user";

// verifyOtp は本番の Supabase と通信するため、既定の5秒より長く待つ
const expect = baseExpect.configure({ timeout: 20_000 });

const INVALID_TEXT = "このリンクはすでに使用されたか、有効期限が切れています。";
const CODE_BUTTON = "メールに書かれたコードで続ける";
const NETWORK_TEXT = "通信できませんでした。もう一度ボタンを押してください。";
const IN_APP_TEXT = "アプリ内のブラウザで開いています";

const UA = {
  line: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.9.0",
  iosNoSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  docomo: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) docomo01",
};

let users: TempUser[] = [];
let adminCookies: SimpleCookie[];

test.beforeAll(async () => {
  await deleteLeftoverTempUsers();
  adminCookies = await demoSessionCookies("admin");
});

test.afterEach(async () => {
  for (const u of users) await deleteTempUser(u);
  users = [];
});

async function newUser(tag: string, opts?: { inSchool?: boolean }) {
  const created = await createTempUser(tag, opts);
  users.push(created.user);
  return created;
}

function confirmUrl(link: LinkProps, extra = ""): string {
  return `/auth/confirm?token_hash=${link.hashedToken}&type=${link.type}${extra}`;
}

async function setPasswordAndFinish(page: Page) {
  await expect(page).toHaveURL(/\/auth\/set-password/);
  const password = randomBytes(12).toString("base64url");
  await page.getByPlaceholder("新しいパスワード（8文字以上）").fill(password);
  await page.getByPlaceholder("新しいパスワード（確認）").fill(password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "パスワードを設定してはじめる" }).click();
  // 保護者ロールの画面へ
  await expect(page).toHaveURL(/\/reports/, { timeout: 30_000 });
}

async function loginAsAdmin(page: Page, baseURL: string) {
  const { hostname } = new URL(baseURL);
  await page.context().addCookies(adminCookies.map((c) => ({ ...c, domain: hostname, path: "/" })));
}

async function contextWithUA(browser: Browser, baseURL: string, userAgent: string) {
  return browser.newContext({ baseURL, userAgent, viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
}

test("通常の招待リンク → ボタン → パスワード設定 → ロールの画面へ", async ({ page }) => {
  const { invite } = await newUser("normal");
  await page.goto(confirmUrl(invite));
  await expect(page.getByText(IN_APP_TEXT)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "メールのコードで続ける" })).toBeVisible();
  await page.getByRole("button", { name: "パスワードを設定する" }).click();
  await setPasswordAndFinish(page);
});

test("以前の形式のリンク（next 付き）も従来どおり動き、外部への next は無視される", async ({ page }) => {
  const a = await newUser("legacy");
  await page.goto(confirmUrl(a.invite, "&next=/auth/set-password"));
  await page.getByRole("button", { name: "パスワードを設定する" }).click();
  await expect(page).toHaveURL(/\/auth\/set-password/);

  const b = await newUser("evilnext");
  await page.context().clearCookies();
  await page.goto(confirmUrl(b.invite, `&next=${encodeURIComponent("https://evil.example/")}`));
  await page.getByRole("button", { name: "パスワードを設定する" }).click();
  await expect(page).toHaveURL(/\/auth\/set-password/);
});

test("token_hash が途中で切れた・文字が変わったリンク → 原因別のエラーと「コードで続ける」", async ({ page }) => {
  const { invite } = await newUser("broken");
  const variants = [
    invite.hashedToken.slice(0, 40),
    (invite.hashedToken[0] === "a" ? "b" : "a") + invite.hashedToken.slice(1),
  ];
  for (const hash of variants) {
    await page.goto(`/auth/confirm?token_hash=${hash}&type=invite`);
    await page.getByRole("button", { name: "パスワードを設定する" }).click();
    await expect(page.getByText(INVALID_TEXT)).toBeVisible();
    const codeLink = page.getByRole("link", { name: CODE_BUTTON });
    await expect(codeLink).toBeVisible();
    await expect(page.getByText("管理者に再度招待")).toBeVisible();
    await expect(codeLink).toHaveAttribute("href", "/auth/code?type=invite");
  }
  // 壊れたリンクを試しても、正しいトークンは消費されていない
  await page.goto(confirmUrl(invite));
  await page.getByRole("button", { name: "パスワードを設定する" }).click();
  await expect(page).toHaveURL(/\/auth\/set-password/);
});

test("token_hash・type が無いリンク → 無効なリンクの案内と「コードで続ける」", async ({ page }) => {
  await page.goto("/auth/confirm?type=invite");
  await expect(page.getByText("無効なリンクです。")).toBeVisible();
  await expect(page.getByRole("link", { name: CODE_BUTTON })).toBeVisible();
});

test("アプリ内ブラウザ（LINE・iOS で Safari/ なし・docomo）→ 注意が出て、ボタンは押せる", async ({ browser, baseURL }) => {
  const { invite } = await newUser("inapp");
  for (const [name, ua] of Object.entries(UA)) {
    const ctx = await contextWithUA(browser, baseURL!, ua);
    const page = await ctx.newPage();
    await page.goto(confirmUrl(invite));
    await expect(page.getByText(IN_APP_TEXT), name).toBeVisible();
    await expect(page.getByText("『Safariで開く』"), name).toBeVisible();
    await expect(page.getByRole("button", { name: "パスワードを設定する" }), name).toBeEnabled();
    // 『リンクをコピー』: クリップボードが使えればコピー、使えなければ URL を選択状態で表示
    await page.getByRole("button", { name: "リンクをコピー" }).click();
    await expect(page.getByText("コピーしました").or(page.getByLabel("このページのリンク")), name).toBeVisible();
    if (name === "docomo") {
      await page.getByRole("button", { name: "パスワードを設定する" }).click();
      await expect(page).toHaveURL(/\/auth\/set-password/);
    }
    await ctx.close();
  }
});

test("通信失敗（verify を落とす）→「もう一度押してください」→ 押し直して進める", async ({ page }) => {
  const { invite } = await newUser("network");
  await page.route("**/auth/v1/verify*", (route) => route.abort("internetdisconnected"));
  await page.goto(confirmUrl(invite));
  await page.getByRole("button", { name: "パスワードを設定する" }).click();
  await expect(page.getByText(NETWORK_TEXT)).toBeVisible();
  await expect(page.getByRole("button", { name: "パスワードを設定する" })).toBeEnabled();

  await page.unroute("**/auth/v1/verify*");
  await page.getByRole("button", { name: "パスワードを設定する" }).click();
  await expect(page).toHaveURL(/\/auth\/set-password/);
});

test("/auth/code: 間違いはエラー、全角数字・空白付きの正しいコードで進める（招待）", async ({ page }) => {
  const { user, invite } = await newUser("code");
  await page.goto("/auth/code");
  await page.getByLabel("メールアドレス").fill(` ${user.email} `);
  const wrong = invite.otp.slice(0, -1) + (invite.otp.endsWith("0") ? "1" : "0");
  await page.getByLabel("確認コード（数字）").fill(wrong);
  await page.getByRole("button", { name: "続ける" }).click();
  await expect(page.getByText("メールアドレスまたはコードが違う、または期限切れです")).toBeVisible();

  const fullWidth = invite.otp.replace(/\d/g, (d) => String.fromCharCode(d.charCodeAt(0) + 0xfee0));
  await page.getByLabel("確認コード（数字）").fill(`  ${fullWidth.slice(0, 4)} ${fullWidth.slice(4)}　`);
  await page.getByRole("button", { name: "続ける" }).click();
  await setPasswordAndFinish(page);
});

test("/auth/code: 再設定メールのコード（recovery）でも進める", async ({ page }) => {
  const { user } = await newUser("coderecovery");
  const recovery = await generateLinkFor(user, "recovery");
  await page.goto("/auth/code");
  await page.getByLabel("メールアドレス").fill(user.email);
  await page.getByLabel("確認コード（数字）").fill(recovery.otp);
  await page.getByRole("button", { name: "続ける" }).click();
  await expect(page).toHaveURL(/\/auth\/set-password/);
});

test("/auth/code: 連続で失敗すると、管理者への連絡を案内してそれ以上試させない", async ({ page }) => {
  const { user, invite } = await newUser("codefail");
  await page.goto("/auth/code");
  await page.getByLabel("メールアドレス").fill(user.email);
  const wrong = invite.otp.slice(0, -1) + (invite.otp.endsWith("0") ? "1" : "0");
  for (let i = 0; i < 3; i++) {
    await page.getByLabel("確認コード（数字）").fill(wrong);
    await page.getByRole("button", { name: "続ける" }).click();
    if (i < 2) await expect(page.getByText("メールアドレスまたはコードが違う")).toBeVisible();
  }
  await expect(page.getByText("管理者（コーチ・スクール）に連絡")).toBeVisible();
  await expect(page.getByRole("button", { name: "続ける" })).toHaveCount(0);
});

test("管理者リンク: 一覧で未登録が分かり、1回目で登録でき、2回目は使用済みの案内になる", async ({ page, browser, baseURL }) => {
  const { user } = await newUser("adminlink");
  await loginAsAdmin(page, baseURL!);

  await page.goto("/admin/users");
  const row = page.getByRole("link").filter({ hasText: TEMP_DISPLAY_NAME });
  await expect(row.getByText("未登録", { exact: true })).toBeVisible();
  await expect(row.getByText(/招待 \d+\/\d+ \d{2}:\d{2}/)).toBeVisible();

  await page.goto(`/admin/users/${user.id}`);
  await expect(page.getByText("未登録（招待済み・まだリンクを確認していません）")).toBeVisible();
  await expect(page.getByRole("button", { name: "招待メールを再送" })).toBeVisible();
  await page.getByRole("button", { name: "1回限りの登録リンクを作る" }).click();
  const linkInput = page.getByLabel("1回限りの登録リンク");
  await expect(linkInput).toBeVisible();
  await expect(page.getByText("このリンクはパスワードと同じ扱いです。")).toBeVisible();
  const link = await linkInput.inputValue();
  expect(new URL(link).pathname).toBe("/auth/confirm");
  expect(new URL(link).searchParams.get("type")).toBe("invite");
  expect(await countAccessLinkAudits(user)).toBe(1);

  // 本人（ログインしていない別のブラウザ）が開く
  const first = await browser.newContext({ baseURL });
  const p1 = await first.newPage();
  await p1.goto(link);
  await p1.getByRole("button", { name: "パスワードを設定する" }).click();
  await setPasswordAndFinish(p1);
  await first.close();

  // 2回目（別の端末で開いた想定）
  const second = await browser.newContext({ baseURL });
  const p2 = await second.newPage();
  await p2.goto(link);
  await p2.getByRole("button", { name: "パスワードを設定する" }).click();
  await expect(p2.getByText(INVALID_TEXT)).toBeVisible();
  await expect(p2.getByRole("link", { name: CODE_BUTTON })).toBeVisible();
  await second.close();

  // 登録後は「登録済み」になり、リンクは再設定（recovery）として作られる
  await page.goto(`/admin/users/${user.id}`);
  await expect(page.getByText("登録済み", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "招待メールを再送" })).toHaveCount(0);
  await page.getByRole("button", { name: "1回限りの登録リンクを作る" }).click();
  const recoveryLink = await page.getByLabel("1回限りの登録リンク").inputValue();
  expect(new URL(recoveryLink).searchParams.get("type")).toBe("recovery");
});

test("管理者リンク: 自校のユーザーでなければ作れない（Server Action を直接呼んでも拒否）", async ({ page, baseURL }) => {
  const { user: own } = await newUser("ownschool");
  const { user: outsider } = await newUser("outsider", { inSchool: false });
  await loginAsAdmin(page, baseURL!);

  // 画面からは開けない
  const res = await page.goto(`/admin/users/${outsider.id}`);
  expect(res?.status()).toBe(404);

  // 自校ユーザーの画面でボタンを押したときの Server Action の要求を記録し、対象IDだけ差し替えて送り直す
  await page.goto(`/admin/users/${own.id}`);
  const actionRequest = page.waitForRequest(
    (r) => r.method() === "POST" && !!r.headers()["next-action"] && (r.postData() ?? "").includes(own.id)
  );
  await page.getByRole("button", { name: "1回限りの登録リンクを作る" }).click();
  const req = await actionRequest;
  await expect(page.getByLabel("1回限りの登録リンク")).toBeVisible();

  const before = await getAuthUpdatedAt(outsider);
  const replay = await page.request.post(req.url(), {
    headers: {
      "next-action": req.headers()["next-action"],
      "content-type": req.headers()["content-type"] ?? "text/plain;charset=UTF-8",
      accept: "text/x-component",
    },
    data: (req.postData() ?? "").replaceAll(own.id, outsider.id),
  });
  const body = await replay.text();
  expect(body).toContain("対象のユーザーが見つかりません");
  expect(body).not.toContain("/auth/confirm?token_hash=");
  // generateLink が呼ばれていない（呼ばれると認証ユーザーの updated_at が変わる）
  expect(await getAuthUpdatedAt(outsider)).toBe(before);
  expect(await countAccessLinkAudits(outsider)).toBe(0);
});

test("未ログインで /auth/code と /api/auth-log に届き、保護ページは従来どおりログインへ", async ({ page, request }) => {
  await page.goto("/auth/code");
  await expect(page).toHaveURL(/\/auth\/code$/);
  await expect(page.getByLabel("確認コード（数字）")).toBeVisible();

  const log = await request.post("/api/auth-log", { data: { event: "confirm_view", hashLength: 56 } });
  expect([204, 400, 429]).toContain(log.status());
  expect(log.status()).not.toBe(307);

  for (const path of ["/daily-log", "/admin/users", "/auth/set-password", "/auth/codex", "/auth/code-admin", "/reports"]) {
    // リダイレクト先が確定すれば十分（ページの load 完了までは待たない）
    await page.goto(path, { waitUntil: "commit" });
    await expect(page, path).toHaveURL(/\/login/);
  }
});

test("招待メールの再送（E2E_SEND_EMAIL=1 のときだけ。メールが1通送られる）", async ({ page, baseURL }) => {
  test.skip(process.env.E2E_SEND_EMAIL !== "1", "メールを送るテストは E2E_SEND_EMAIL=1 のときだけ実行する");
  const { user } = await newUser("resend");
  await loginAsAdmin(page, baseURL!);
  await page.goto(`/admin/users/${user.id}`);
  await page.getByRole("button", { name: "招待メールを再送" }).click();
  await expect(page.getByText("招待メールを再送しました")).toBeVisible({ timeout: 30_000 });
});
