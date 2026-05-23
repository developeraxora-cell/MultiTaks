import { SetupNotice } from "@/components/SetupNotice";
import { TaskManager } from "@/components/tasks/TaskManager";
import { isSupabaseConfigured, getSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";
import type { Task } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const session = await requireUser();
  const { data, error } = await getSupabase()
    .from("tasks")
    .select("*")
    .eq("user_id", session.userId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const tasks = (data ?? []) as Task[];
  return <TaskManager tasks={tasks} />;
}
