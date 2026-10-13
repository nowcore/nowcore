import { archive, liveDrop } from '../lib/api';
import { currentCart } from '../features/cart/cart';
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

/** Rendered per request; the catalogue it reads is cached for 30 s (lib/api.ts). */
export const dynamic = 'force-dynamic';

/**
 * The film: seven chapters, 00–06 (docs/02 F1). Three are pinned stages —
 * the signal, the drop, the making; the rest read at a glance and scroll
 * like a page, which keeps the film from becoming a chore on a phone.
 */
export default async function Home() {
  const [drop, closed, cart] = await Promise.all([
    liveDrop(),
    archive(),
    currentCart(),
  ]);
  return (
    <main className="bg-void font-sans text-paper">
      <FilmChrome
        drop={drop}
        buyHref={
          drop.products[0] ? `/product/${drop.products[0].slug}` : '/shop'
        }
        cartCount={cart?.count ?? 0}
      />
      <Signal drop={drop} />
      <WhatsNow drop={drop} />
      <TheDrop drop={drop} />
      <TheArchive drop={drop} archive={closed} />
      <TheMaking drop={drop} />
      <TheWall drop={drop} />
      <TakeIt drop={drop} />
    </main>
  );
}
