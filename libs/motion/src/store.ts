/**
 * The smallest observable that does the job. A scrub updates up to 60 times
 * a second; routing that through React state would re-render the tree every
 * frame. Subscribers that draw (the canvas) read it directly; components that
 * only care about crossing a threshold use `useStageStep` and re-render a
 * handful of times per scroll.
 */
export interface ProgressStore {
  get(): number;
  set(value: number): void;
  subscribe(listener: () => void): () => void;
}

export function createProgressStore(initial = 0): ProgressStore {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next) {
      if (next === value) return;
      value = next;
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
