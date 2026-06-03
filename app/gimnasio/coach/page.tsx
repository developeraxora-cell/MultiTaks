import { SetupNotice } from "@/components/SetupNotice";
import { GymTabs } from "@/components/gym/GymTabs";
import { GymChat } from "@/components/gym/GymChat";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";
import { getGymChatMessages } from "@/lib/queries/gym";

export const dynamic = "force-dynamic";

export default async function GymCoachPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const session = await requireUser();
  const messages = await getGymChatMessages(session.userId);

  return (
    <div className="mx-auto flex h-[calc(100dvh-3.5rem)] max-w-3xl flex-col px-4 py-4 sm:px-6 lg:h-screen">
      <GymTabs />
      <div className="mb-3 shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">Coach IA</h1>
        <p className="text-sm text-muted">
          Consejos de entrenamiento según tus rutinas e historial.
        </p>
      </div>
      <GymChat initial={messages} closeHref="/gimnasio/rutinas" />
    </div>
  );
}
