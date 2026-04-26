"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { useExercisesStore } from "@/lib/store/useExercisesStore";
import { ExerciseForm } from "@/components/exercises/ExerciseForm";

const TAB_STORAGE_KEY = "practice.activeTab";

function focusExercisesTab() {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(TAB_STORAGE_KEY, "exercises");
  }
}

export default function NewExercisePage() {
  const router = useRouter();
  const createExercise = useExercisesStore((s) => s.createExercise);
  const [formKey, setFormKey] = useState(0);
  const [justAdded, setJustAdded] = useState<string | null>(null);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/" className="text-sm text-neutral-400 transition hover:text-neutral-100">
        ← Back
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Add exercise</h1>
      <p className="mt-2 text-sm text-neutral-400">
        Enter the BPM where you can already play this exercise cleanly and relaxed. The app promotes it from there.
      </p>

      {justAdded && (
        <div className="mt-6 rounded-lg border border-emerald-900 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">
          Added <span className="font-semibold">{justAdded}</span>. Add another below, or{" "}
          <Link href="/" className="underline transition hover:text-emerald-100">
            go to your exercises
          </Link>
          .
        </div>
      )}

      <div className="mt-8">
        <ExerciseForm
          key={formKey}
          submitLabel="Add exercise"
          onSubmit={async (values) => {
            await createExercise(values);
            focusExercisesTab();
            router.push("/");
          }}
          secondarySubmit={{
            label: "Save and add another",
            onSubmit: async (values) => {
              await createExercise(values);
              setJustAdded(values.name);
              setFormKey((k) => k + 1);
              if (typeof window !== "undefined") {
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            },
          }}
          onCancel={() => router.push("/")}
        />
      </div>
    </main>
  );
}
