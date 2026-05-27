import { redirect } from "next/navigation";

import { SetupNotice } from "@/components/SetupNotice";
import { NutritionOnboarding } from "@/components/nutrition/NutritionOnboarding";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";
import { getNutritionProfileByUserId } from "@/lib/queries/nutrition";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const session = await requireUser();
  const profile = await getNutritionProfileByUserId(session.userId);

  // Onboarding ya completo → al dashboard (no repetir formulario).
  if (profile?.onboarding_completed) redirect("/nutricion/dashboard");

  return <NutritionOnboarding profile={profile} />;
}
