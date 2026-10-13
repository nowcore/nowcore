import type { Chapter, ChapterKey, DropView } from '@nowcore/shared';

/**
 * A chapter's copy from the drop's CMS field (FR-19). The API validates the
 * full set of seven, so a missing key here is a contract break, not a state
 * to design around.
 */
export function chapter(drop: DropView, key: ChapterKey): Chapter {
  const c = drop.chapters.find((x) => x.key === key);
  if (!c) throw new Error(`drop ${drop.number} has no '${key}' chapter`);
  return c;
}
