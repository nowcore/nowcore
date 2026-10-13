import { liveDrop } from '../lib/fixtures/live-drop';
import { FilmChrome } from '../features/film/Chrome';
import { Signal } from '../features/film/Signal';
import {
  TakeIt,
  TheArchive,
  TheDrop,
  TheMaking,
  TheWall,
  WhatsNow,
} from '../features/film/Chapters';

/**
 * The film: seven chapters, 00–06 (docs/02 F1). Three are pinned stages —
 * the signal, the drop, the making; the rest read at a glance and scroll
 * like a page, which keeps the film from becoming a chore on a phone.
 */
export default function Home() {
  return (
    <main className="bg-void text-paper font-sans">
      <FilmChrome closesAt={liveDrop.closesAt} />
      <Signal drop={liveDrop} />
      <WhatsNow />
      <TheDrop drop={liveDrop} />
      <TheArchive />
      <TheMaking />
      <TheWall />
      <TakeIt />
    </main>
  );
}
