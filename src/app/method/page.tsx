import Link from "next/link";

export const metadata = {
  title: "The method — Guitar Song Practice Metronome",
};

export default function MethodPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/" className="text-sm text-neutral-400 transition hover:text-neutral-100">
        ← Back
      </Link>
      <h1 className="mt-4 text-4xl font-bold tracking-tight">The Method</h1>
      <p className="mt-3 text-neutral-400">
        This is a short, structured speed-practice method for bluegrass tunes. The app runs
        a session against a metronome so you don&rsquo;t have to manage timers, tempo math,
        or rep counting. Read this once and the rest of the app makes sense.
      </p>

      <section className="mt-10 space-y-4">
        <h2 className="text-2xl font-semibold">1. Philosophy</h2>
        <p>
          Trying to muscle tunes up to speed by just playing them faster, for longer, is
          how injuries happen and how tension gets welded into the muscle memory.
        </p>
        <p>
          The method replaces long grinding sessions with short deliberate ones.
          Ten minutes, fully focused, built around three things: a slow warm-up, a
          targeted push at the ceiling of what you can play cleanly, and a cool-down that
          locks the current version in. Repeated across days, the ceiling climbs.
        </p>
        <p className="font-semibold text-neutral-200">
          Golden rule: trust the player. The app will never tell you how it sounded. Only
          you can hear whether a rep was clean and relaxed.
        </p>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-2xl font-semibold">2. The three tempos</h2>
        <p>Every tune you practice has three live tempos at any given moment:</p>
        <ul className="ml-6 list-disc space-y-2 text-neutral-300">
          <li>
            <strong className="text-neutral-100">Working tempo</strong> — the fastest BPM
            at which you can already play the full tune cleanly and relaxed. This is the
            rung you&rsquo;ve already earned.
          </li>
          <li>
            <strong className="text-neutral-100">Target tempo</strong> — one small step
            above your working tempo. The app computes this automatically from your
            per-song step % (default 2.5%). It&rsquo;s the next rung on the ladder — what
            you&rsquo;re pushing for in the Ceiling Work block.
          </li>
          <li>
            <strong className="text-neutral-100">Overspeed tempo</strong> — two steps
            above your working tempo. You&rsquo;re not trying to play it cleanly. The
            point is to make the target tempo feel slow when you drop back.
          </li>
        </ul>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-2xl font-semibold">3. The three-clean-reps ladder</h2>
        <p>
          Promotion rule: when you play three <em>consecutive</em> clean-and-relaxed reps
          at the target tempo, tap <span className="font-semibold text-accent">I earned it</span>.
          That target becomes your new working tempo, the whole ladder shifts up one rung,
          and the downstream blocks of the current session automatically run at the new
          speed.
        </p>
        <p>
          Consecutive matters. Two clean reps, a tense rep, another clean rep — that&rsquo;s
          not three consecutive. Reset the count and keep going.
        </p>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-2xl font-semibold">4. Rep taxonomy</h2>
        <p>Every rep fits one of four buckets. You don&rsquo;t tap anything per rep — this is just how to <em>think</em> about each pass:</p>
        <ul className="ml-6 list-disc space-y-2 text-neutral-300">
          <li>
            <strong className="text-neutral-100">Clean &amp; relaxed</strong> — notes
            land right, hands are loose, breathing is normal. This is the only rep that
            counts toward the three-clean-reps promotion.
          </li>
          <li>
            <strong className="text-neutral-100">Clean but tense</strong> — notes landed
            but your shoulders/forearms locked up to make it happen. Does not count.
            If you stack three of these, the tempo is too high and you should drop back.
          </li>
          <li>
            <strong className="text-neutral-100">Flub (distraction)</strong> — you lost
            the line because you got distracted or mis-picked. Neutral. Reset and go.
          </li>
          <li>
            <strong className="text-neutral-100">Flub (tension)</strong> — you lost the
            line because your hands tightened. Same as &ldquo;clean but tense&rdquo; —
            a sign to drop back.
          </li>
        </ul>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-2xl font-semibold">5. Core session rules</h2>
        <ol className="ml-6 list-decimal space-y-2 text-neutral-300">
          <li><strong className="text-neutral-100">End on a clean rep.</strong> Whatever you played last is the version your brain rehearses overnight. Make it a good one.</li>
          <li><strong className="text-neutral-100">Metronome is the boss.</strong> The clicks don&rsquo;t care how you feel — and that&rsquo;s why they&rsquo;re useful.</li>
          <li><strong className="text-neutral-100">Interleave tunes.</strong> One 10-min session per tune per day beats three sessions on the same tune back-to-back. The spacing is what builds retention.</li>
          <li><strong className="text-neutral-100">Trust the player.</strong> You decide what counts as clean. No app can hear it.</li>
        </ol>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-2xl font-semibold">6. The 10-minute structure</h2>
        <p>The 10-min session is the canonical one — six blocks, each with a short on-screen instruction panel while it runs.</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-bg-border text-neutral-400">
                <th className="py-2 pr-4">Block</th>
                <th className="py-2 pr-4">Duration</th>
                <th className="py-2 pr-4">Tempo</th>
                <th className="py-2">Purpose</th>
              </tr>
            </thead>
            <tbody className="text-neutral-200">
              <Row block="Slow Reference" duration="1:30" tempo="77% of working" purpose="Warm up the tune with a full relaxed pass." />
              <Row block="Trouble Spot" duration="2:00" tempo="Your hard-part BPM" purpose="Loop the hardest 1–2 bars until clean; promote separately." />
              <Row block="Ceiling Work" duration="3:00" tempo="Target (step above working)" purpose="Full-tune push. Three clean reps earns the new working tempo." />
              <Row block="Overspeed" duration="1:00" tempo="Two steps above working" purpose="A couple of messy fast bursts to make the target feel slow." />
              <Row block="Consolidation" duration="1:30" tempo="Your (possibly new) working" purpose="Deliberate, relaxed reps. The version your brain keeps." />
              <Row block="Slow Musical" duration="1:00" tempo="72% of working" purpose="One musical pass. Remember it&rsquo;s a tune, not a drill." />
            </tbody>
          </table>
        </div>
        <p className="text-neutral-400">
          Longer sessions (15, 20, 30 min, or a custom length up to an hour)
          reuse this exact breakdown with every block proportionally larger.
          A 20-minute session is just a 10-minute session where each block is
          twice as long — Ceiling Work becomes 6 minutes, Overspeed becomes 2.
          Useful when the default 10-min blocks are too short to play the tune
          through even once.
        </p>
        <p className="text-neutral-400">
          If your tune has more than one hard passage, the Trouble Spot block
          is replicated once per spot, with its own tempo and its own
          promotion ladder. Each extra spot <em>adds</em> time to the session
          rather than stealing it from the other blocks.
        </p>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-2xl font-semibold">7. The 5-minute structure</h2>
        <p>
          A compact version for days you only have a few minutes. Skips the
          trouble-spot isolation block and the closing slow musical pass
          entirely — it&rsquo;s a different structural shape, not a shrunken
          10-minute session. If you need trouble-spot work, use 10 minutes or
          longer.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-bg-border text-neutral-400">
                <th className="py-2 pr-4">Block</th>
                <th className="py-2 pr-4">Duration</th>
                <th className="py-2 pr-4">Tempo</th>
                <th className="py-2">Purpose</th>
              </tr>
            </thead>
            <tbody className="text-neutral-200">
              <Row block="Slow Reference" duration="1:00" tempo="80% of working" purpose="Warm-up." />
              <Row block="Ceiling Work" duration="2:30" tempo="Target" purpose="Three clean reps earns promotion." />
              <Row block="Overspeed" duration="0:45" tempo="Two steps above" purpose="Short burst." />
              <Row block="Consolidation" duration="0:45" tempo="Working" purpose="End clean." />
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-2xl font-semibold">8. Trouble-spot isolation</h2>
        <p>
          Most tunes have 1–2 bars that lag the rest. If you practice only the full tune,
          the whole ladder gets pinned at the speed of the worst bar. The Trouble Spot block
          loops those bars at whatever tempo lets you play them genuinely cleanly in
          isolation — which will typically be slower than the rest of the tune can handle.
        </p>
        <p>
          A song can have up to five trouble spots. Each one has its own
          starting BPM and its own promotion ladder. A session runs one
          Trouble Spot block per spot, each at that spot&rsquo;s current
          tempo, so a tune with two genuinely different hard passages
          doesn&rsquo;t have to share a single speed ladder.
        </p>
        <p>
          Tapping <span className="font-semibold text-accent">I earned it</span> during a
          Trouble Spot block promotes <em>only that spot&rsquo;s</em> BPM — other spots and
          your working BPM are unchanged. Once a trouble BPM catches up to your working BPM,
          that spot is no longer a bottleneck; dropping it from the song (or letting it stay
          as-is) makes the block effectively disappear.
        </p>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-2xl font-semibold">9. Worked example — Blackberry Blossom</h2>
        <p className="text-neutral-400">
          Say you&rsquo;ve been playing Blackberry Blossom for a month. You can get through
          the full tune cleanly at <strong className="text-neutral-200">220 BPM</strong>.
          The hardest 2 bars of the B part start to wobble above{" "}
          <strong className="text-neutral-200">150 BPM</strong> in isolation. The original
          Tony Rice recording sits around 270 BPM — that&rsquo;s where you eventually want
          to live, but it&rsquo;s not something the session drives toward directly.
        </p>
        <p>
          You add the song with:
        </p>
        <ul className="ml-6 list-disc space-y-1 text-neutral-300">
          <li>Working BPM: <strong className="text-neutral-100">220</strong></li>
          <li>Hard-part BPM: <strong className="text-neutral-100">150</strong></li>
          <li>Original BPM: <strong className="text-neutral-100">270</strong> (display-only)</li>
          <li>Step %: <strong className="text-neutral-100">2.5</strong> (default)</li>
        </ul>
        <p>The app computes:</p>
        <ul className="ml-6 list-disc space-y-1 text-neutral-300">
          <li>Target: <strong className="text-neutral-100">226</strong> BPM (one step above working)</li>
          <li>Overspeed: <strong className="text-neutral-100">232</strong> BPM (two steps above working)</li>
          <li>Slow reference: <strong className="text-neutral-100">169</strong> BPM</li>
          <li>Slow musical: <strong className="text-neutral-100">158</strong> BPM</li>
        </ul>

        <h3 className="mt-6 text-xl font-semibold text-neutral-100">10-minute session walkthrough</h3>
        <ol className="ml-6 list-decimal space-y-3 text-neutral-300">
          <li>
            <strong className="text-neutral-100">Slow Reference (1:30 @ 169 BPM).</strong>{" "}
            One full easy pass. You notice your right-hand pick angle is a bit steep today,
            loosen it up, play through to the end. No pressure.
          </li>
          <li>
            <strong className="text-neutral-100">Trouble Spot (2:00 @ 150 BPM).</strong>{" "}
            You loop the last two bars of the B part. First rep clean, second rep clean,
            third rep tense — reset. Clean, clean, clean — tap{" "}
            <span className="font-semibold text-accent">I earned it</span>. The toast reads
            &ldquo;Trouble: 150 → 154&rdquo;, the metronome jumps to 154, and you keep
            looping for the rest of the block at the new tempo.
          </li>
          <li>
            <strong className="text-neutral-100">Ceiling Work (3:00 @ 226 BPM).</strong>{" "}
            You play the full tune at the target. First pass hangs on but the B part
            wobbles. Second pass you just barely hold it. Third pass is clean, fourth is
            clean, fifth is clean — tap{" "}
            <span className="font-semibold text-accent">I earned it</span>. Toast:
            &ldquo;Working: 220 → 226&rdquo;. The metronome jumps one more step up to 232
            (the new target) and you keep going.
          </li>
          <li>
            <strong className="text-neutral-100">Overspeed (1:00 @ 238 BPM).</strong>{" "}
            Two fast messy bursts through the A part only. You flub both. That&rsquo;s
            fine — you&rsquo;re not trying to earn anything here.
          </li>
          <li>
            <strong className="text-neutral-100">Consolidation (1:30 @ 226 BPM).</strong>{" "}
            The new working tempo. You play two relaxed full passes. Both clean. This is
            the version your brain rehearses tonight.
          </li>
          <li>
            <strong className="text-neutral-100">Slow Musical (1:00 @ 163 BPM).</strong>{" "}
            One last pass, played musically. You lean into the swing and let the open
            strings ring on the A-part phrases. Session ends on a clean note.
          </li>
        </ol>

        <p className="mt-4">
          Session results: working BPM promoted 220 → 226. Trouble BPM promoted 150 → 154.
          Total practice time on this song has gone up by 10 minutes. Tomorrow you pick
          it up from here.
        </p>
      </section>

      <section className="mt-12 border-t border-bg-border pt-6 text-sm text-neutral-500">
        <p>
          That&rsquo;s the whole method. The rest of the app is just plumbing for these
          six blocks, a metronome, and an &ldquo;I earned it&rdquo; button.
        </p>
      </section>
    </main>
  );
}

function Row({
  block,
  duration,
  tempo,
  purpose,
}: {
  block: string;
  duration: string;
  tempo: string;
  purpose: string;
}) {
  return (
    <tr className="border-b border-bg-border/60">
      <td className="py-2 pr-4 font-semibold">{block}</td>
      <td className="py-2 pr-4 tabular-nums text-neutral-400">{duration}</td>
      <td className="py-2 pr-4 text-neutral-400">{tempo}</td>
      <td className="py-2 text-neutral-400">{purpose}</td>
    </tr>
  );
}
