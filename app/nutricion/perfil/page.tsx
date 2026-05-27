import { redirect } from "next/navigation";

import { SetupNotice } from "@/components/SetupNotice";
import { EditNutritionProfile } from "@/components/nutrition/EditNutritionProfile";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";
import {
  getActiveNutritionGoal,
  getNutritionProfileByUserId,
} from "@/lib/queries/nutrition";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const session = await requireUser();
  const profile = await getNutritionProfileByUserId(session.userId);
  if (!profile || !profile.onboarding_completed) redirect("/nutricion/onboarding");

  const goal = await getActiveNutritionGoal(session.userId);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Perfil nutricional</h1>
      <p className="mb-5 text-sm text-muted">Edita tus datos y regenera tus metas cuando lo necesites.</p>
      <EditNutritionProfile profile={profile} goal={goal} />
    </div>
  );
}
