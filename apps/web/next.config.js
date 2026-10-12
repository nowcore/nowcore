//@ts-check

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  /**
   * Keep `next build` out of `next dev`'s working directory.
   *
   * They both default to `.next`, and a build run while a dev server is
   * serving leaves the dev server's Turbopack cache unreadable — "Failed to
   * restore task data (corrupted database or bug)". After that, pages already
   * compiled keep working and anything needing a fresh compile *hangs*, which
   * reads like a routing bug or a dead upstream rather than a broken cache.
   *
   * It cost time three times in one session, twice after it had been written
   * down, which is the evidence that a note in the setup docs was the wrong
   * fix. Separating the directories makes the collision impossible instead of
   * discouraged.
   *
   * `NEXT_DIST_DIR` rather than a check on `NODE_ENV`, because `next build`
   * and `next start` must agree on one directory and only the command knows
   * which it is.
   */
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
};

module.exports = nextConfig;
