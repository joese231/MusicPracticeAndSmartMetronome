# Offline Write Queue Strategy

This app should not add PWA background/offline behavior until repository writes have a durable queue.

## Decision

Keep v1 as a foreground local-first app. Before enabling PWA/offline sync, add a Repository-level write queue that records every mutating operation as an idempotent command before applying it.

## Required Shape

- Store queued commands in IndexedDB, not memory.
- Give every command a stable operation id.
- Make item/session commands idempotent server-side before any cloud repository exists.
- Keep `completeSession` as one command so session append and item-total increment remain atomic.
- Keep reorder as a dedicated command that only mutates `sortIndex`.
- Keep statistics reset and factory reset as explicit barrier commands that invalidate older queued mutations.
- Surface queue status in Settings before any service worker retries writes in the background.

## Conflict Policy

- Item edits keep optimistic concurrency with `expectedUpdatedAt`.
- Reorder commands can replay after item edits because they only touch `sortIndex`.
- Session completion commands dedupe by session id and completion-ledger status.
- Practice-time adjustments remain signed deltas against the latest item row.

## PWA Gate

Do not add `next-pwa`, service-worker write replay, or cloud sync until the command queue exists behind `Repository` and has tests for replay, dedupe, reset barriers, and stale item edits.
