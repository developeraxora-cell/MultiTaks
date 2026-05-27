import { redirect } from "next/navigation";

import { SetupNotice } from "@/components/SetupNotice";
import { NutritionChat } from "@/components/nutrition/NutritionChat";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";
import { getChatMessages, getNutritionProfileByUserId } from "@/lib/queries/nutrition";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const session = await requireUser();
  const profile = await getNutritionProfileByUserId(session.userId);
  if (!profile || !profile.onboarding_completed) redirect("/nutricion/onboarding");

  const messages = await getChatMessages(session.userId);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Chat nutricional IA</h1>
      <p className="mb-4 text-sm text-muted">Consejos personalizados según tu perfil y tus metas.</p>
      <NutritionChat initial={messages} />
    </div>
  );
}
