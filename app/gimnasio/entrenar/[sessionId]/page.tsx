import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { SetupNotice } from "@/components/SetupNotice";
import { WorkoutSession } from "@/components/gym/WorkoutSession";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";
import { getSessionWithLogs, getWorkoutTimer, listExercisesForUser } from "@/lib/queries/gym";

export const dynamic = "force-dynamic";

export default async function TrainPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const { sessionId } = await params;
  const session = await requireUser();

  const [workout, catalog, timer] = await Promise.all([
    getSessionWithLogs(sessionId, session.userId),
    listExercisesForUser(session.userId),
    getWorkoutTimer(sessionId, session.userId),
  ]);
  if (!workout) notFound();

  // Si ya terminó, manda al detalle del historial (no se reentrena una sesión cerrada).
  if (workout.status !== "in_progress") {
    redirect(`/gimnasio/historial/${sessionId}`);
  }

  const dateLabel = new Intl.DateTimeFormat("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${workout.session_date}T00:00:00`));

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Link
        href="/gimnasio/rutinas"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft size={16} /> Salir
      </Link>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">
          {workout.routine_name ?? "Entrenamiento libre"}
        </h1>
        <p className="text-sm capitalize text-muted">{dateLabel}</p>
      </div>
      <WorkoutSession
        session={workout}
        catalog={catalog}
        estimatedMinutes={timer?.estimated_minutes ?? null}
      />
    </div>
  );
}
