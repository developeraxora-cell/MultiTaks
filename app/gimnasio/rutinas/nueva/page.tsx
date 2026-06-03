import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { SetupNotice } from "@/components/SetupNotice";
import { RoutineForm } from "@/components/gym/RoutineForm";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";
import { listExercisesForUser } from "@/lib/queries/gym";

export const dynamic = "force-dynamic";

export default async function NewRoutinePage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const session = await requireUser();
  const exercises = await listExercisesForUser(session.userId);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <Link
        href="/gimnasio/rutinas"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft size={16} /> Volver
      </Link>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Nueva rutina</h1>
      <RoutineForm exercises={exercises} />
    </div>
  );
}
