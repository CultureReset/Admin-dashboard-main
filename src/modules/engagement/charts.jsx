/**
 * Two tiny inline charts, drawn as SVG with no library.
 *
 * Deliberately plain. These exist to show shape and relative size — a trend
 * line and a ranked breakdown — not to be a charting toolkit. Anything more
 * elaborate would be a dependency and a build-size cost for two screens.
 *
 * Both scale to their container so they work at 390px as well as 1440px.
 */

import './charts.css';

/** A trend line over time. `points` is [{ label, value }] in chronological order. */
export function Sparkline({ points = [], height = 120 }) {
  if (!points.length) return null;

  const values = points.map((p) => Number(p.value) || 0);
  const max = Math.max(...values, 1);
  const stepX = points.length > 1 ? 100 / (points.length - 1) : 0;

  const coords = values.map((v, i) => [i * stepX, 100 - (v / max) * 100]);
  const line = coords.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const area = `${line} L100,100 L0,100 Z`;

  const total = values.reduce((n, v) => n + v, 0);
  const peak = points[values.indexOf(max)];

  return (
    <div className="spark">
      <svg
        className="spark__svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ height }}
        role="img"
        aria-label={`${total} total, peak ${max} on ${peak?.label}`}
      >
        <path className="spark__area" d={area} />
        <path className="spark__line" d={line} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="spark__meta">
        <span>{points[0].label}</span>
        <span className="spark__peak">peak {max} · {peak?.label}</span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  );
}

/** A ranked breakdown. `items` is [{ name, count }], already sorted. */
export function BreakdownBars({ items = [], limit = 8 }) {
  if (!items.length) return null;
  const shown = items.slice(0, limit);
  const max = Math.max(...shown.map((i) => i.count), 1);

  return (
    <ul className="bars">
      {shown.map((item) => (
        <li className="bars__row" key={item.name}>
          <span className="bars__label" title={String(item.name)}>{String(item.name)}</span>
          <span className="bars__track">
            <span className="bars__fill" style={{ width: `${(item.count / max) * 100}%` }} />
          </span>
          <span className="bars__count">{item.count}</span>
        </li>
      ))}
      {items.length > limit && (
        <li className="bars__more">+{items.length - limit} more</li>
      )}
    </ul>
  );
}
