import { SetupNotice } from "@/components/SetupNotice";
import { TaskManager } from "@/components/tasks/TaskManager";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { getSupabase } from "@/lib/supabase/server";
import type { Task } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const { data, error } = await getSupabase()
    .from("tasks")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const all = (data ?? []) as Task[];
  const tasks = all.filter((t) => !t.deleted_at);
  const deletedTasks = all.filter((t) => t.deleted_at);

  return <TaskManager tasks={tasks} deletedTasks={deletedTasks} />;
}
