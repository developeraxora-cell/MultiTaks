import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function GymEntryPage() {
  redirect("/gimnasio/rutinas");
}
