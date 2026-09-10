// ロールごとのログイン後の遷移先。
// ログイン画面・トップページ・パスワード設定画面・招待リンクの受け皿(auth/confirm, auth/callback)
// など、認証が絡む複数の画面で同じ対応表が必要になるためここに集約する。
export const ROLE_LANDING: Record<string, string> = {
  player: "/daily-log",
  coach: "/dashboard",
  parent: "/reports",
  school_admin: "/admin/users",
  system_admin: "/admin/users",
};

export function getRoleLanding(role: string | null | undefined): string {
  if (!role) return "/login";
  return ROLE_LANDING[role] ?? "/login";
}
