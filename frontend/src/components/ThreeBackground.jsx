export default function ThreeBackground() {
  return (
    <div className="ni-bg" aria-hidden="true">
      <div className="ni-bg__field" />
      <div className="ni-bg__grid" />
      <div className="ni-bg__vignette" />

      <style>{`
        .ni-bg {
          position: fixed;
          inset: 0;
          z-index: -8;
          pointer-events: none;
          overflow: hidden;
          contain: strict;
        }

        .ni-bg__field,
        .ni-bg__grid,
        .ni-bg__vignette {
          position: absolute;
          inset: 0;
          will-change: auto;
        }

        .ni-bg__field {
          background:
            linear-gradient(115deg, rgba(0, 229, 160, 0.04), transparent 28%),
            linear-gradient(235deg, rgba(6, 182, 212, 0.03), transparent 31%),
            linear-gradient(315deg, rgba(139, 92, 246, 0.04), transparent 38%);
          opacity: 0.9;
        }

        .ni-bg__grid {
          opacity: 0.2;
          background-image:
            linear-gradient(rgba(0, 229, 160, 0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139, 92, 246, 0.03) 1px, transparent 1px);
          background-size: 72px 72px;
          transform: perspective(900px) rotateX(58deg) translateY(-18%);
          transform-origin: 50% 0;
          mask-image: linear-gradient(180deg, transparent 0%, #000 26%, #000 78%, transparent 100%);
        }

        .ni-bg__vignette {
          background:
            linear-gradient(90deg, rgba(10, 11, 15, 0.78), transparent 21%, transparent 76%, rgba(10, 11, 15, 0.7)),
            linear-gradient(180deg, rgba(10, 11, 15, 0.08), transparent 42%, rgba(10, 11, 15, 0.72));
        }

        @media (max-width: 760px) {
          .ni-bg__grid { background-size: 52px 52px; opacity: 0.15; }
        }

        @media (prefers-reduced-motion: reduce) {
          .ni-bg__field, .ni-bg__grid { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
