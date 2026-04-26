# Music Practice & Smart Metronome

A web app for structured bluegrass speed-practice sessions. It drives a three-tempo ladder (working / target / overspeed), a block timer, and a metronome — keeping sessions focused and progressive.

## Current state (April 2026)

The core practice loop is fully working:

- **Songs** — add a song with a working BPM and up to 5 trouble spots, then run timed sessions that walk you through Conscious Practice → Target Work → Overspeed → Ceiling Work → Trouble Spot blocks. Hit "I earned it" to promote your BPM and the metronome jumps to the new tempo on the spot.
- **Exercises** — run technique drills (scales, arpeggios, picking patterns) on a customizable session length (5–60 min, default 5, saved per exercise). Block flow: Conscious Practice → Build → Burst (fixed 90s) → Cool Down (fixed 30s). The Build block absorbs all remaining time.
- **Metronome** — Web Audio API look-ahead scheduler with all-beats / backbeat 2&4 toggle and accent control. Tempo changes are phase-preserving (no glitch).
- **Session recording** — audio captured in-memory for immediate playback on the song/exercise detail page after the session. Ephemeral (resets on next session).
- **Stats** — calendar heatmap, daily practice minutes, and BPM promotion timeline per song/exercise.
- **Method page** — full explanation of the practice method with a Blackberry Blossom worked example.

What's not in yet: accounts / sync, offline PWA, persistent recording storage, auto-flub detection.

## Prerequisites

If this is a fresh computer, install these two things first:

1. **Git** — [git-scm.com/downloads](https://git-scm.com/downloads) — needed to clone the repo
2. **Node.js ≥ 20** — [nodejs.org](https://nodejs.org) — includes npm; pick the "LTS" version

Once both are installed, open a terminal (PowerShell on Windows, Terminal on Mac) and continue below.

## Getting started

```bash
git clone https://github.com/joese231/MusicPracticeAndSmartMetronome.git
cd MusicPracticeAndSmartMetronome
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No environment variables or database setup needed — data is stored as JSON files in `data/` (created automatically on first run).

## Usage

1. Go to the **Songs** tab and add a song with a working BPM.
2. On the song detail page, pick a session length and tap **Start Session**.
3. Follow the on-screen block instructions. Use keyboard shortcuts for fast control:
   - `Space` — advance / I earned it
   - `N` — skip current block
   - `P` — pause / resume
   - `R` — reset block countdown
   - `Esc` — end session

Visit `/method` in the app for the full practice method explanation.

## Tech stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Zustand · Web Audio API · Vitest

## License

MIT — free to fork, modify, and use locally. See [LICENSE](LICENSE).
