/**
 * The left rail: index, ticks, rotated chapter name (docs/10, parts). Purely
 * presentational and server-renderable; the page tells it which chapter is
 * active. Decorative — the chapters carry their own headings.
 */
export function ChapterRail({
  index,
  total,
  label,
}: {
  index: number;
  total: number;
  label: string;
}) {
  return (
    <div className="nc-rail" aria-hidden="true">
      <span className="nc-rail-index">{String(index).padStart(2, '0')}</span>
      <span className="nc-rail-total">/ {String(total).padStart(2, '0')}</span>
      <span className="nc-rail-ticks">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className="nc-rail-tick"
            data-active={i === index ? '' : undefined}
          />
        ))}
      </span>
      <span className="nc-rail-label">{label}</span>
    </div>
  );
}
