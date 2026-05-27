import Link from "next/link";
import { ArrowRight, Salad } from "lucide-react";

import { SetupNotice } from "@/components/SetupNotice";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";
import { getNutritionProfileByUserId } from "@/lib/queries/nutrition";

export const dynamic = "force-dynamic";

export default async function NutritionEntryPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const session = await requireUser();
  const profile = await getNutritionProfileByUserId(session.userId);
  const href = profile?.onboarding_completed ? "/nutricion/dashboard" : "/nutricion/onboarding";

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-10 sm:px-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500/20 text-emerald-300">
          <Salad size={22} />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fitness</h1>
          <p className="text-sm text-muted">Nutrición y seguimiento diario</p>
        </div>
      </div>
      <Link
        href={href}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-[#0f1623] shadow-lg shadow-accent/20 hover:brightness-105"
      >
        Continuar <ArrowRight size={16} />
      </Link>
    </div>
  );
}
