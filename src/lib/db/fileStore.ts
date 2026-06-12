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

async function writeJsonFile<T>(file: string, value: T): Promise<void> {
  await ensureDataDir();
  const tmp = `${file}.${process.pid}.${Date.now()}.${Math.random()
    .toString(36)
    .slice(2)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
  await fs.rename(tmp, file);
}

function withLock<T>(file: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(file) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  let cleanup: Promise<void>;
  cleanup = next.then(
    () => {
      if (locks.get(file) === cleanup) locks.delete(file);
    },
    () => {
      if (locks.get(file) === cleanup) locks.delete(file);
    },
  );
  locks.set(file, cleanup);
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
    await writeJsonFile(file, value);
  });
}

export async function updateJsonAtomic<T, R>(
  name: string,
  fallback: T,
  mutator:
    | ((current: T) => { value: T; result: R })
    | ((current: T) => Promise<{ value: T; result: R }>),
): Promise<R> {
  const file = resolveDataPath(name);
  return withLock(file, async () => {
    let current: T;
    try {
      const raw = await fs.readFile(file, "utf8");
      current = JSON.parse(raw) as T;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      current = fallback;
    }
    const { value, result } = await mutator(current);
    await writeJsonFile(file, value);
    return result;
  });
}
