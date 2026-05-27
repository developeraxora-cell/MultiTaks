import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { SetupNotice } from "@/components/SetupNotice";
import { RegisterMeal } from "@/components/nutrition/RegisterMeal";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";
import { getNutritionProfileByUserId } from "@/lib/queries/nutrition";
import { todayKey } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function RegisterMealPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const session = await requireUser();
  const profile = await getNutritionProfileByUserId(session.userId);
  if (!profile || !profile.onboarding_completed) redirect("/nutricion/onboarding");

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <Link href="/nutricion/dashboard" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ChevronLeft size={16} /> Volver al dashboard
      </Link>
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Registrar comida</h1>
      <p className="mb-5 text-sm text-muted">
        Toma una foto de tu plato y la IA estimará sus nutrientes. Podrás revisar y editar antes de guardar.
      </p>
      <RegisterMeal today={todayKey(session.timeZone)} />
    </div>
  );
}
