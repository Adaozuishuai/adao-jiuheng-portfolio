import paths from './jiuheng-paths.json';

// Georgia Regular outlines, retaining the original 1120-unit text length
// and baseline (270) within the 1280 × 370 viewBox.
export function HeroIntro({ split = false }: { split?: boolean }) {
  if (split)
    return (
      <h1
        id="hero-title"
        className="hero-lettering editorial-lettering"
        aria-label="Jiuheng"
      >
        {[
          { name: 'jiu', box: '78 90 407 189', letters: paths.slice(0, 3) },
          { name: 'heng', box: '490 90 712 189', letters: paths.slice(3) },
        ].map((word) => (
          <svg
            key={word.name}
            className={`word-${word.name}`}
            viewBox={word.box}
            aria-hidden="true"
          >
            <g className="hero-fill">
              {word.letters.map((d, i) => (
                <path key={i} d={d} />
              ))}
            </g>
            <g className="hero-outline">
              {word.letters.map((d, i) => (
                <path
                  key={i}
                  d={d}
                  pathLength={1}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>
          </svg>
        ))}
      </h1>
    );
  return (
    <h1
      id="hero-title"
      className="hero-lettering"
      aria-label="Jiuheng"
      data-basketball-collider
    >
      <svg viewBox="0 0 1280 370" role="presentation" aria-hidden="true">
        <g className="hero-fill">
          {paths.map((d, index) => (
            <path key={index} d={d} />
          ))}
        </g>
        <g className="hero-outline">
          {paths.map((d, index) => (
            <path
              key={index}
              d={d}
              pathLength={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
      </svg>
    </h1>
  );
}
