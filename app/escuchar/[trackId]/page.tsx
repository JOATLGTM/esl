import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOnboardedProfile } from "@/lib/auth/session";
import { es, fill } from "@/lib/copy/es";
import { loadListeningTrack } from "@/lib/session/listening";
import { ListeningPlayer } from "../listening-player";

export default async function ListeningTrackPage({ params }: PageProps<"/escuchar/[trackId]">) {
  const { trackId } = await params;
  const profile = await requireOnboardedProfile();
  const track = await loadListeningTrack(trackId, profile.current_unit);
  if (!track) notFound();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-5 py-8">
      <div className="flex items-center justify-between">
        <Link href="/escuchar" className="min-h-11 text-base font-medium text-muted underline underline-offset-4">
          {es.listening.backToLibrary}
        </Link>
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-ink">{track.titleEs}</h1>
        <p className="text-base text-muted">{fill(es.listening.narrator, { name: track.narrator })}</p>
      </div>
      <ListeningPlayer track={track} />
    </main>
  );
}
