/**
 * Every queue the worker consumes. One per family of job, so a backlog of
 * frame renders can never delay a POD submission (docs/04-hld.md §2).
 *
 * Only `system` has a processor yet. The others are named here so the API and
 * the worker agree on spelling from day one; each gets its processor with its
 * task — pod (T-060), render (T-034), trends (T-074), notify (T-062).
 */
export const QUEUES = {
  system: 'system',
  pod: 'pod',
  render: 'render',
  trends: 'trends',
  notify: 'notify',
} as const;
