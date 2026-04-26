import { promises as fs } from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");

const locks = new Map<string, Promise<unknown>>();

function resolveDataPath(name: string): string {
  if (name.includes("/") || name.includes("\\") || name.includes("..")) {
    throw new Error(`invalid data file name: ${name}`);
  }
  return path.join(DATA_DIR, name);
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function withLock<T>(file: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(file) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(
    file,
    next.finally(() => {
      if (locks.get(file) === next) locks.delete(file);
    }),
  );
  return next;
}

export async function readJson<T>(name: string, fallback: T): Promise<T> {
  const file = resolveDataPath(name);
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw err;
  }
}

export async function writeJsonAtomic<T>(name: string, value: T): Promise<void> {
  const file = resolveDataPath(name);
  await withLock(file, async () => {
    await ensureDataDir();
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
    await fs.rename(tmp, file);
  });
}
