import { SetupNotice } from "@/components/SetupNotice";
import { UsersManager } from "@/components/admin/UsersManager";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/server";
import { listUsuarios } from "@/lib/queries/users";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  await requireAdmin();

  const users = await listUsuarios();
  return <UsersManager users={users} />;
}
