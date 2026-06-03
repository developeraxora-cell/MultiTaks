import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { SetupNotice } from "@/components/SetupNotice";
import { RoutineForm } from "@/components/gym/RoutineForm";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";
import { getRoutineWithExercises, listExercisesForUser } from "@/lib/queries/gym";

export const dynamic = "force-dynamic";

export default async function EditRoutinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const { id } = await params;
  const session = await requireUser();

  const [routine, exercises] = await Promise.all([
    getRoutineWithExercises(id, session.userId),
    listExercisesForUser(session.userId),
  ]);
  if (!routine) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <Link
        href={`/gimnasio/rutinas/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft size={16} /> Volver
      </Link>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Editar rutina</h1>
      <RoutineForm exercises={exercises} routine={routine} />
    </div>
  );
}
