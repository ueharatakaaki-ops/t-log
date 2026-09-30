/**
 * t-log運営者（システム管理者）の最初のアカウントを作成する。
 *
 * inviteUser()（app/(admin)/admin/users/actions.ts）はアプリのUIから実行する必要があり、
 * 実行者自身がすでに管理者としてログインしている前提になっている。
 * そのため「まだ誰も管理者アカウントを持っていない」最初の1回だけは、
 * このスクリプトでSupabase側から直接作成する。
 *
 * 現時点ではシステム管理者もどこか1つのschool_idに所属する必要があるという
 * DB制約上の理由から、暫定的にNLTCに所属させる。これは他校展開時に見直す
 * 予定（school_idを持たない独立した運営者アカウントに切り出す等）だが、
 * school_idの付け替えは後からUPDATE一発でできるため、今は急がなくてよい。
 *
 * 使い方:
 *   npm run bootstrap:system-admin
 *   （メールアドレス・表示名を変えたい場合）
 *   npm run bootstrap:system-admin -- --email=someone@example.com --name="山田太郎"
 *
 * 実行すると、指定したメールアドレス宛にt-logの招待メール（パスワード設定リンク）が
 * 届くので、本人がリンクからパスワードを設定してログインする。
 *
 * 冪等性: すでにsystem_adminロールのアカウントが存在する場合は、何もせず一覧を表示して終了する
 * （二重作成を防ぐため）。
 */
import "dotenv/config";
import { adminClient, getNltcSchoolId } from "./client";

function parseArgs() {
  const args = process.argv.slice(2);
  const email = args.find((a) => a.startsWith("--email="))?.split("=")[1] ?? "ueharatakaaki@gmail.com";
  const name = args.find((a) => a.startsWith("--name="))?.split("=")[1] ?? "上原隆明";
  return { email, name };
}

async function main() {
  const { email, name } = parseArgs();

  const { data: existing, error: existingError } = await adminClient
    .from("app_users")
    .select("id, display_name, role")
    .eq("role", "system_admin");
  if (existingError) throw new Error(`既存の管理者確認に失敗しました: ${existingError.message}`);

  if ((existing ?? []).length > 0) {
    console.log("すでにシステム管理者アカウントが存在します。二重作成を避けるため、何もしませんでした。\n");
    for (const u of existing ?? []) {
      console.log(`  - ${u.display_name}（id: ${u.id}）`);
    }
    console.log(
      "\n新しく別のシステム管理者を追加したい場合は、既存のシステム管理者アカウントでログインし、" +
        "アプリの「ユーザー管理」画面から招待してください（このスクリプトは最初の1名専用です）。"
    );
    return;
  }

  const schoolId = await getNltcSchoolId();

  console.log(`システム管理者アカウントを作成します: ${name} <${email}>`);
  console.log(`（所属school_id: ${schoolId} = NLTC。暫定措置。後で移動可能）\n`);

  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { display_name: name },
  });
  if (inviteError || !invited?.user) {
    throw new Error(`招待メールの送信に失敗しました: ${inviteError?.message ?? "unknown error"}`);
  }

  const userId = invited.user.id;

  const { error: appUserError } = await adminClient.from("app_users").insert({
    id: userId,
    school_id: schoolId,
    role: "system_admin",
    display_name: name,
  });
  if (appUserError) {
    // 失敗した場合、認証ユーザーだけが残ると不整合になるため取り消す
    await adminClient.auth.admin.deleteUser(userId);
    throw new Error(`app_usersの作成に失敗しました（作成した認証ユーザーは取り消しました）: ${appUserError.message}`);
  }

  console.log("✅ システム管理者アカウントを作成し、招待メールを送信しました。");
  console.log(`   ${email} 宛のメール内リンクからパスワードを設定し、ログインしてください。`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
