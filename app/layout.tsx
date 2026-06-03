import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { Nav } from "@/components/Nav";
import { ActiveWorkoutTimer } from "@/components/gym/ActiveWorkoutTimer";
import { getSession } from "@/lib/auth/server";
import { getNutritionProfileByUserId } from "@/lib/queries/nutrition";
import { getActiveWorkoutTimer } from "@/lib/queries/gym";
import { isSupabaseConfigured } from "@/lib/supabase/server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mentes Creadoras · Seguimiento de hábitos",
  description: "Gestión y monitoreo de hábitos diarios con reportes de cumplimiento",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const nutritionProfile =
    session && isSupabaseConfigured()
      ? await getNutritionProfileByUserId(session.userId)
      : null;
  const fitnessUnlocked = Boolean(nutritionProfile?.onboarding_completed);
  const activeWorkout =
    session && isSupabaseConfigured() ? await getActiveWorkoutTimer(session.userId) : null;

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        {session && (
          <Nav name={session.name} role={session.role} fitnessUnlocked={fitnessUnlocked} />
        )}
        <div className={session ? "lg:pl-64" : ""}>
          <main className="min-h-screen">{children}</main>
        </div>
        {activeWorkout && (
          <ActiveWorkoutTimer
            sessionId={activeWorkout.id}
            startedAt={activeWorkout.started_at}
            estimatedMinutes={activeWorkout.estimated_minutes}
            routineName={activeWorkout.routine_name}
          />
        )}
        <Toaster
          theme="dark"
          position="top-right"
          richColors
          toastOptions={{
            style: {
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            },
          }}
        />
      </body>
    </html>
  );
}
