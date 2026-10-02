import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface SharedJsonSnapshot<T> {
  value: T;
  serialized: string;
}

const wait = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));
const lockTimeoutMilliseconds = 20_000;
// Writing the owner happens immediately after the exclusive create. A small
// grace period protects that window while still allowing a later extension
// host to recover a zero-byte lock left by a crash.
const incompleteLockGraceMilliseconds = 5_000;

interface LockOwner {
  pid: number;
  token: string;
}

interface LockLease {
  serializedOwner: string;
}

function isFileError(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

function isTransientWindowsFileError(error: unknown): boolean {
  return ['EPERM', 'EACCES', 'EBUSY'].some((code) => isFileError(error, code));
}

async function retryTransientFileOperation<T>(operation: () => Promise<T>, attempts = 12): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientWindowsFileError(error) || attempt === attempts - 1) throw error;
      await wait(10 + attempt * 5);
    }
  }
  throw lastError;
}

function lockOwner(serialized: string): LockOwner | undefined {
  try {
    const value = JSON.parse(serialized) as Partial<LockOwner>;
    return Number.isInteger(value.pid) && Number(value.pid) > 0 && typeof value.token === 'string'
      ? { pid: Number(value.pid), token: value.token }
      : undefined;
  } catch {
    return undefined;
  }
}

function processIsRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !isFileError(error, 'ESRCH');
  }
}

async function incompleteLockIsAbandoned(filePath: string): Promise<boolean> {
  try {
    const details = await stat(filePath);
    return Date.now() - details.mtimeMs >= incompleteLockGraceMilliseconds;
  } catch (error) {
    if (isFileError(error, 'ENOENT')) return true;
    throw error;
  }
}

/**
 * A small cross-process JSON store. An exclusive lock prevents two VS Code
 * extension hosts from overwriting each other's changes, and atomic renames
 * keep readers from observing partially written JSON.
 */
export class SharedJsonFile<T> {
  private readonly lockPath: string;
  private readonly recoveryPath: string;

  constructor(readonly filePath: string) {
    this.lockPath = `${filePath}.lock`;
    this.recoveryPath = `${this.lockPath}.recovering`;
  }

  async read(): Promise<SharedJsonSnapshot<T> | undefined> {
    try {
      const serialized = await retryTransientFileOperation(() => readFile(this.filePath, 'utf8'));
      return { value: JSON.parse(serialized) as T, serialized };
    } catch (error) {
      if (isFileError(error, 'ENOENT')) return undefined;
      throw error;
    }
  }

  async update(fallback: T, transform: (current: T) => T): Promise<SharedJsonSnapshot<T>> {
    await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 });
    const lock = await this.acquireLock();
    try {
      const persisted = await this.read();
      const next = transform(persisted?.value ?? structuredClone(fallback));
      const serialized = JSON.stringify(next);
      await this.atomicWrite(serialized);
      return { value: next, serialized };
    } finally {
      await this.releaseLock(lock);
    }
  }

  private async acquireLock(): Promise<LockLease> {
    const deadline = Date.now() + lockTimeoutMilliseconds;
    while (Date.now() < deadline) {
      try {
        const handle = await open(this.lockPath, 'wx', 0o600);
        const serializedOwner = JSON.stringify({ pid: process.pid, token: randomUUID() } satisfies LockOwner);
        try {
          await handle.writeFile(serializedOwner, 'utf8');
          await handle.close();
          return { serializedOwner };
        } catch (error) {
          await handle.close().catch(() => undefined);
          await rm(this.lockPath, { force: true }).catch(() => undefined);
          throw error;
        }
      } catch (error) {
        if (!isFileError(error, 'EEXIST') && !isTransientWindowsFileError(error)) throw error;
        if (await this.recoverAbandonedLock()) continue;
        await wait(20 + Math.floor(Math.random() * 20));
      }
    }
    throw new Error(`Could not lock private storage at "${this.filePath}". Close other windows and retry.`);
  }

  /** Serialize recovery and re-read the owner while holding the recovery guard. */
  private async recoverAbandonedLock(): Promise<boolean> {
    let guard;
    try { guard = await this.acquireRecoveryGuard(); }
    catch (error) {
      if (isTransientWindowsFileError(error)) return false;
      throw error;
    }
    if (!guard) return false;
    try {
      let serializedOwner: string;
      try { serializedOwner = await readFile(this.lockPath, 'utf8'); }
      catch (error) { if (isFileError(error, 'ENOENT')) return true; throw error; }
      const owner = lockOwner(serializedOwner);
      if (!owner) {
        // A crash can happen between exclusive creation and writing the owner.
        // Only reclaim that incomplete lock once it is old enough that the
        // creating process cannot reasonably still be in that tiny window.
        if (!(await incompleteLockIsAbandoned(this.lockPath))) return false;
      } else if (processIsRunning(owner.pid)) {
        return false;
      }
      await rm(this.lockPath);
      return true;
    } catch (error) {
      if (isFileError(error, 'ENOENT')) return true;
      if (isTransientWindowsFileError(error)) return false;
      throw error;
    } finally {
      await guard.close();
      await rm(this.recoveryPath, { force: true });
    }
  }

  private async acquireRecoveryGuard() {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await open(this.recoveryPath, 'wx', 0o600);
      } catch (error) {
        if (!isFileError(error, 'EEXIST')) throw error;
        if (attempt > 0 || !(await incompleteLockIsAbandoned(this.recoveryPath))) return undefined;
        // Recovery itself can be interrupted after creating its guard. An old
        // zero-byte guard has no live owner and is safe to replace.
        await rm(this.recoveryPath, { force: true });
      }
    }
    return undefined;
  }

  private async releaseLock(lock: LockLease): Promise<void> {
    try {
      const currentOwner = await retryTransientFileOperation(() => readFile(this.lockPath, 'utf8'));
      if (currentOwner === lock.serializedOwner) {
        await retryTransientFileOperation(() => rm(this.lockPath, { force: true }));
      }
    } catch (error) {
      if (!isFileError(error, 'ENOENT')) throw error;
    }
  }

  private async atomicWrite(serialized: string): Promise<void> {
    const temporaryPath = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, serialized, { encoding: 'utf8', mode: 0o600 });
      await retryTransientFileOperation(() => rename(temporaryPath, this.filePath));
    } finally {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
    }
  }
}
