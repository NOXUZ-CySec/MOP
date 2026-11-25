export type ReadSession1098 = { id: number; key: string; active: boolean };
let sessionSequence = 0;

// This key isolates UI reads; authorization remains in the Electron backend.
export function createReadSession1098(account: {
  userId?: string; username?: string; role?: string; mode?: string; condos?: string[] | null;
}): ReadSession1098 {
  return {
    id: ++sessionSequence,
    key: JSON.stringify([account.userId || account.username || '', account.role || '', account.mode || '', account.condos === null ? null : [...(account.condos || [])].sort()]),
    active: true,
  };
}

type Scope = object | string | null;
export type ReadOutcome1098<T> =
  | { status: 'ok'; value: T; scope: Scope; epoch: number; sequence: number }
  | { status: 'error'; error: unknown; scope: Scope; epoch: number; sequence: number }
  | { status: 'discarded' };
type Flight<T> = { pending: boolean; scope: Scope; epoch: number; sequence: number; promise: Promise<ReadOutcome1098<T>> };

/** Coalesces reads. An invalidation during a read requests one trailing fresh read. */
export class ReadCoordinator1098<T> {
  private scope: Scope = null;
  private epoch = 0;
  private sequence = 0;
  private flight: Flight<T> | null = null;
  private cache: { value: T; at: number; sequence: number } | null = null;

  setScope(scope: Scope): void {
    if (scope === this.scope) return;
    this.scope = scope;
    this.epoch++;
    this.flight = null;
    this.cache = null;
  }

  clearScope(scope: Scope): void {
    if (scope === this.scope) this.setScope(null);
  }

  isCurrent(result: ReadOutcome1098<T>): boolean {
    return result.status !== 'discarded' && result.scope === this.scope && this.scope !== null && result.epoch === this.epoch && result.sequence === this.sequence;
  }

  request(scope: Scope, load: () => Promise<T>, options: { invalidate?: boolean; maxAgeMs?: number; now?: () => number } = {}): Promise<ReadOutcome1098<T>> {
    if (scope === null || scope !== this.scope) return Promise.resolve({ status: 'discarded' });
    if (this.flight) {
      if (options.invalidate) { this.flight.pending = true; this.cache = null; }
      return this.flight.promise;
    }
    const now = options.now || Date.now;
    const age = this.cache ? now() - this.cache.at : Infinity;
    if (!options.invalidate && this.cache && age >= 0 && age < (options.maxAgeMs || 0)) {
      return Promise.resolve({ status: 'ok', value: this.cache.value, scope, epoch: this.epoch, sequence: this.sequence });
    }
    const job = { pending: false, scope, epoch: this.epoch, sequence: ++this.sequence, promise: null as unknown as Promise<ReadOutcome1098<T>> };
    this.cache = null;
    this.flight = job;
    const valid = () => this.scope === scope && this.epoch === job.epoch && this.flight === job;
    const run = async (): Promise<ReadOutcome1098<T>> => {
      while (valid()) {
        job.pending = false;
        try {
          const value = await load();
          if (!valid()) return { status: 'discarded' };
          if (job.pending) continue;
          this.cache = { value, at: now(), sequence: job.sequence };
          return { status: 'ok', value, scope, epoch: job.epoch, sequence: job.sequence };
        } catch (error) {
          if (!valid()) return { status: 'discarded' };
          if (job.pending) continue;
          return { status: 'error', error, scope, epoch: job.epoch, sequence: job.sequence };
        }
      }
      return { status: 'discarded' };
    };
    job.promise = Promise.resolve().then(run).finally(() => { if (this.flight === job) this.flight = null; });
    return job.promise;
  }
}

const dateFormatter = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Sao_Paulo' });
const hourFormatter = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'America/Sao_Paulo' });
export function routinePartition1098(now = new Date()): string {
  const parts = Object.fromEntries(dateFormatter.formatToParts(now).map(part => [part.type, part.value]));
  const hour = Number(hourFormatter.format(now));
  return `${parts.year}-${parts.month}-${parts.day}|${hour >= 6 && hour < 18 ? 'day' : 'night'}`;
}

export function routineReadKey1098(session: ReadSession1098, now = new Date()): string {
  return JSON.stringify([session.id, session.key, routinePartition1098(now)]);
}
