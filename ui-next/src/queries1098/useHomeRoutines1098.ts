import { useCallback, useEffect, useRef, useState } from 'react';
import { ReadCoordinator1098, routineReadKey1098, type ReadSession1098 } from './readCoordinator1098';

export type Home109Task = { id: string; title: string; period: string; reminder_time?: string | null; done: boolean };
export type Home109Snapshot = { tasks: Home109Task[]; date: string; scope: string; period?: string };
const empty = { data: null as Home109Snapshot | null, error: '', busy: false };

/** Read-only UI coordination; all actual access checks stay in home109 IPC. */
export function useHomeRoutines1098(enabled: boolean, session: ReadSession1098 | null) {
  const [state, setState] = useState(empty);
  const reader = useRef(new ReadCoordinator1098<Home109Snapshot>()).current;
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const refresh = useCallback(() => refreshRef.current(), []);

  useEffect(() => {
    if (!enabled || !session?.active || !window.mopDesktop?.home109) {
      reader.setScope(null);
      setState(empty);
      refreshRef.current = async () => {};
      return;
    }
    let active = true;
    let key = '';
    const load = async (invalidate = false) => {
      if (!active || !session.active) return;
      const currentKey = routineReadKey1098(session);
      const changed = currentKey !== key;
      if (changed) { key = currentKey; reader.setScope(key); }
      setState(previous => ({ data: changed ? null : previous.data, error: '', busy: true }));
      const result = await reader.request(currentKey, () => window.mopDesktop!.home109!(), { invalidate, maxAgeMs: 1000 });
      if (!active || !session.active || !reader.isCurrent(result)) return;
      // Never show yesterday's/previous shift's result if a read crossed the boundary.
      if (currentKey !== routineReadKey1098(session)) { void load(); return; }
      if (result.status === 'ok') setState({ data: result.value, error: '', busy: false });
      if (result.status === 'error') setState({ data: null, error: result.error instanceof Error ? result.error.message : 'Rotinas indisponíveis', busy: false });
    };
    refreshRef.current = () => load(true);
    void load();
    const unsubscribe = window.mopDesktop.onSync?.(event => { if (event?.dataChanged) void load(true); });
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 20000);
    const focus = () => { void load(); };
    const visible = () => { if (document.visibilityState === 'visible') void load(); };
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', visible);
    return () => {
      active = false;
      reader.setScope(null);
      refreshRef.current = async () => {};
      unsubscribe?.();
      window.clearInterval(timer);
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [enabled, session, reader]);

  return { ...state, refresh };
}
