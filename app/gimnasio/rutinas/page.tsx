import Link from "next/link";
import { Plus, Play } from "lucide-react";

import { SetupNotice } from "@/components/SetupNotice";
import { GymTabs } from "@/components/gym/GymTabs";
import { RoutineList } from "@/components/gym/RoutineList";
import { StartFreeButton } from "@/components/gym/StartFreeButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";
import { listRoutines } from "@/lib/queries/gym";

export const dynamic = "force-dynamic";

export default async function RoutinesPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const session = await requireUser();
  const routines = await listRoutines(session.userId);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <GymTabs />
      <PageHeader
        title="Mis rutinas"
        subtitle="Crea rutinas y empieza a entrenar"
        action={
          <div className="flex gap-2">
            <StartFreeButton />
            <Link
              href="/gimnasio/rutinas/nueva"
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-[#0f1623] hover:brightness-105"
            >
              <Plus size={16} /> Nueva rutina
            </Link>
          </div>
        }
      />
      <RoutineList routines={routines} />

      <div className="mt-6 rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted">
        <Play size={16} className="mx-auto mb-1" />
        ¿Sin rutina hoy? Inicia un entrenamiento libre y agrega ejercicios sobre la marcha.
      </div>
    </div>
  );
}
