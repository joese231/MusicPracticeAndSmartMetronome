"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSongsStore } from "@/lib/store/useSongsStore";
import { SongForm } from "@/components/songs/SongForm";

export default function NewSongPage() {
  const router = useRouter();
  const createSong = useSongsStore((s) => s.createSong);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/" className="text-sm text-neutral-400 transition hover:text-neutral-100">
        ← Back
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Add song</h1>
      <p className="mt-2 text-sm text-neutral-400">
        Enter the tempo where you can already play the tune cleanly and relaxed. The app promotes it from there.
      </p>

      <div className="mt-8">
        <SongForm
          submitLabel="Add song"
          onSubmit={async (values) => {
            const song = await createSong(values);
            router.push(`/songs/${song.id}`);
          }}
          onCancel={() => router.push("/")}
        />
      </div>
    </main>
  );
}
