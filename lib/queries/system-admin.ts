import { createAdminClient } from "@/lib/supabase/server";

export type SchoolOverviewRow = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  createdAt: string;
  counts: {
    player: number;
    coach: number;
    parent: number;
    schoolAdmin: number;
    systemAdmin: number;
    total: number;
  };
};

/**
 * 全スクールの一覧と、スクールごとの登録者数（ロール別）を取得する。
 * system_admin専用（呼び出し元でrequireSystemAdmin()による権限チェックを行うこと）。
 * RLSは school_id = current_school_id() で自校に絞る設計のため、
 * 他校を横断して見るこの集計はRLSをバイパスするadminクライアントで行う。
 */
export async function getSchoolsOverview(): Promise<SchoolOverviewRow[]> {
  const admin = createAdminClient();

  const [{ data: schools }, { data: users }] = await Promise.all([
    admin.from("schools").select("id, name, slug, plan, created_at").order("created_at", { ascending: true }),
    admin.from("app_users").select("school_id, role"),
  ]);

  const countsBySchool = new Map<string, Record<string, number>>();
  for (const u of users ?? []) {
    const bucket = countsBySchool.get(u.school_id) ?? {};
    bucket[u.role] = (bucket[u.role] ?? 0) + 1;
    countsBySchool.set(u.school_id, bucket);
  }

  return (schools ?? []).map((s) => {
    const bucket = countsBySchool.get(s.id) ?? {};
    const player = bucket.player ?? 0;
    const coach = bucket.coach ?? 0;
    const parent = bucket.parent ?? 0;
    const schoolAdmin = bucket.school_admin ?? 0;
    const systemAdmin = bucket.system_admin ?? 0;
    return {
      id: s.id,
      name: s.name,
      slug: s.slug,
      plan: s.plan,
      createdAt: s.created_at,
      counts: {
        player,
        coach,
        parent,
        schoolAdmin,
        systemAdmin,
        total: player + coach + parent + schoolAdmin + systemAdmin,
      },
    };
  });
}
