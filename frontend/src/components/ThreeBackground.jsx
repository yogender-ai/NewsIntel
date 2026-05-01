import React, { useMemo } from 'react';

const STREAMS = [
  { top: '14%', width: '46%', delay: '-8s', speed: '32s' },
  { top: '28%', width: '62%', delay: '-19s', speed: '44s' },
  { top: '43%', width: '38%', delay: '-4s', speed: '37s' },
  { top: '61%', width: '58%', delay: '-27s', speed: '48s' },
  { top: '77%', width: '42%', delay: '-13s', speed: '41s' },
];

export default function ThreeBackground() {
  const nodes = useMemo(
    () =>
      Array.from({ length: 22 }, (_, index) => ({
        left: `${8 + ((index * 17) % 84)}%`,
        top: `${10 + ((index * 29) % 78)}%`,
        delay: `${-(index * 1.7).toFixed(1)}s`,
        scale: (0.75 + ((index % 5) * 0.12)).toFixed(2),
      })),
    [],
  );

  return (
    <div className="ni-bg" aria-hidden="true">
      <div className="ni-bg__field" />
      <div className="ni-bg__grid" />
      <div className="ni-bg__contours" />
      <div className="ni-bg__streams">
        {STREAMS.map((stream, index) => (
          <span
            key={index}
            style={{
              top: stream.top,
              width: stream.width,
              animationDelay: stream.delay,
              animationDuration: stream.speed,
            }}
          />
        ))}
      </div>
      <div className="ni-bg__nodes">
        {nodes.map((node, index) => (
          <i
            key={index}
            style={{
              left: node.left,
              top: node.top,
              animationDelay: node.delay,
              transform: `scale(${node.scale})`,
            }}
          />
        ))}
      </div>
      <div className="ni-bg__vignette" />

      <style>{`
        .ni-bg {
          position: fixed;
          inset: 0;
          z-index: -8;
          pointer-events: none;
          overflow: hidden;
          background:
            linear-gradient(180deg, #040814 0%, #061020 44%, #030712 100%),
            #040814;
        }

        .ni-bg__field,
        .ni-bg__grid,
        .ni-bg__contours,
        .ni-bg__streams,
        .ni-bg__nodes,
        .ni-bg__vignette {
          position: absolute;
          inset: 0;
        }

        .ni-bg__field {
          background:
            linear-gradient(115deg, rgba(94, 234, 212, calc(0.055 + var(--pulse-intensity, 0) * 0.045)), transparent 28%),
            linear-gradient(235deg, rgba(255, 211, 138, 0.052), transparent 31%),
            linear-gradient(315deg, rgba(141, 162, 255, calc(0.05 + var(--pulse-intensity, 0) * 0.055)), transparent 38%),
            linear-gradient(20deg, rgba(255, 155, 169, 0.035), transparent 34%);
          opacity: 0.92;
          animation: niFieldBreathe 26s ease-in-out infinite alternate;
        }

        .ni-bg__grid {
          opacity: 0.34;
          background-image:
            linear-gradient(rgba(126, 231, 196, 0.055) 1px, transparent 1px),
            linear-gradient(90deg, rgba(141, 162, 255, 0.05) 1px, transparent 1px);
          background-size: 72px 72px;
          transform: perspective(900px) rotateX(58deg) translateY(-18%);
          transform-origin: 50% 0;
          mask-image: linear-gradient(180deg, transparent 0%, #000 26%, #000 78%, transparent 100%);
          animation: niGridDrift 36s linear infinite;
        }

        .ni-bg__contours {
          opacity: 0.28;
          background:
            repeating-linear-gradient(112deg, transparent 0 58px, rgba(94, 234, 212, 0.035) 59px, transparent 60px),
            repeating-linear-gradient(23deg, transparent 0 92px, rgba(255, 211, 138, 0.026) 93px, transparent 94px);
          mix-blend-mode: screen;
          animation: niContourShift 54s linear infinite;
        }

        .ni-bg__streams span {
          position: absolute;
          left: -72%;
          height: 1px;
          border-radius: 999px;
          background: linear-gradient(90deg, transparent, rgba(94, 234, 212, 0.12), rgba(141, 162, 255, 0.16), transparent);
          box-shadow: 0 0 18px rgba(94, 234, 212, 0.08);
          animation-name: niStreamPass;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }

        .ni-bg__nodes i {
          position: absolute;
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: rgba(205, 245, 255, 0.76);
          box-shadow: 0 0 10px rgba(94, 234, 212, 0.42);
          animation: niNodePulse 7.5s ease-in-out infinite;
        }

        .ni-bg__vignette {
          background:
            linear-gradient(90deg, rgba(3, 7, 18, 0.78), transparent 21%, transparent 76%, rgba(3, 7, 18, 0.7)),
            linear-gradient(180deg, rgba(3, 7, 18, 0.08), transparent 42%, rgba(3, 7, 18, 0.72));
        }

        @keyframes niFieldBreathe {
          from { filter: saturate(0.9) brightness(0.88); transform: scale(1); }
          to { filter: saturate(1.08) brightness(1.04); transform: scale(1.025); }
        }

        @keyframes niGridDrift {
          from { background-position: 0 0, 0 0; }
          to { background-position: 0 72px, 72px 0; }
        }

        @keyframes niContourShift {
          from { background-position: 0 0, 0 0; }
          to { background-position: 180px 120px, -120px 180px; }
        }

        @keyframes niStreamPass {
          from { transform: translateX(0); opacity: 0; }
          12% { opacity: 1; }
          72% { opacity: 0.45; }
          to { transform: translateX(260vw); opacity: 0; }
        }

        @keyframes niNodePulse {
          0%, 100% { opacity: 0.18; }
          45% { opacity: 0.78; }
        }

        @media (max-width: 760px) {
          .ni-bg__grid { background-size: 52px 52px; opacity: 0.24; }
          .ni-bg__nodes i:nth-child(n + 13) { display: none; }
          .ni-bg__contours { opacity: 0.18; }
        }

        @media (prefers-reduced-motion: reduce) {
          .ni-bg__field,
          .ni-bg__grid,
          .ni-bg__contours,
          .ni-bg__streams span,
          .ni-bg__nodes i {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
