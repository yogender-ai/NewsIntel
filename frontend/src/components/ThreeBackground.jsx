import React from 'react';

export default function ThreeBackground() {
  return (
    <div className="ni-bg" aria-hidden="true">
      <div className="ni-bg__aurora" />
      <div className="ni-bg__orbs">
        <i /><i /><i /><i /><i />
      </div>
      <div className="ni-bg__grid" />
      <div className="ni-bg__scan" />
      <div className="ni-bg__ring" />
      <div className="ni-bg__vignette" />

      <style>{`
        .ni-bg {
          position: fixed;
          inset: 0;
          z-index: -8;
          pointer-events: none;
          overflow: hidden;
        }
        .ni-bg__aurora,
        .ni-bg__grid,
        .ni-bg__scan,
        .ni-bg__ring,
        .ni-bg__vignette,
        .ni-bg__orbs {
          position: absolute;
          inset: 0;
        }
        .ni-bg__aurora {
          background:
            radial-gradient(900px 520px at 8% -8%, rgba(0, 229, 160, 0.22), transparent 58%),
            radial-gradient(760px 480px at 96% 6%, rgba(139, 92, 246, 0.24), transparent 52%),
            radial-gradient(640px 420px at 70% 110%, rgba(6, 182, 212, 0.18), transparent 56%);
          animation: niAurora 12s ease-in-out infinite;
        }
        .ni-bg__orbs i {
          position: absolute;
          border-radius: 50%;
          filter: blur(36px);
          opacity: 0.55;
          animation: niOrb 16s ease-in-out infinite;
        }
        .ni-bg__orbs i:nth-child(1) { width: 280px; height: 280px; left: 8%; top: 18%; background: rgba(0,229,160,0.22); }
        .ni-bg__orbs i:nth-child(2) { width: 340px; height: 340px; right: 6%; top: 8%; background: rgba(139,92,246,0.22); animation-delay: -3s; }
        .ni-bg__orbs i:nth-child(3) { width: 220px; height: 220px; left: 42%; bottom: 6%; background: rgba(6,182,212,0.2); animation-delay: -7s; }
        .ni-bg__orbs i:nth-child(4) { width: 160px; height: 160px; left: 22%; bottom: 22%; background: rgba(245,158,11,0.12); animation-delay: -11s; }
        .ni-bg__orbs i:nth-child(5) { width: 180px; height: 180px; right: 28%; bottom: 18%; background: rgba(94,234,212,0.14); animation-delay: -5s; }
        .ni-bg__grid {
          opacity: 0.28;
          background-image:
            linear-gradient(rgba(0,229,160,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139,92,246,0.05) 1px, transparent 1px);
          background-size: 64px 64px;
          transform: perspective(1100px) rotateX(62deg) translateY(-14%);
          transform-origin: 50% 0;
          mask-image: linear-gradient(180deg, transparent, #000 22%, #000 72%, transparent);
          animation: niGrid 18s linear infinite;
        }
        .ni-bg__scan {
          height: 22%;
          background: linear-gradient(180deg, transparent, rgba(0,229,160,0.08), transparent);
          animation: niScan 8s linear infinite;
        }
        .ni-bg__ring {
          left: 50%;
          top: 28%;
          width: 46vmax;
          height: 46vmax;
          margin: -23vmax 0 0 -23vmax;
          border-radius: 50%;
          border: 1px solid rgba(0,229,160,0.08);
          box-shadow: 0 0 80px rgba(139,92,246,0.08) inset;
          animation: niRing 10s ease-in-out infinite;
        }
        .ni-bg__vignette {
          background:
            linear-gradient(90deg, rgba(10,11,15,0.72), transparent 18%, transparent 82%, rgba(10,11,15,0.7)),
            linear-gradient(180deg, rgba(10,11,15,0.12), transparent 36%, rgba(10,11,15,0.78));
        }
        @keyframes niAurora {
          0%, 100% { filter: hue-rotate(0deg) saturate(1); transform: scale(1); }
          50% { filter: hue-rotate(24deg) saturate(1.25); transform: scale(1.06); }
        }
        @keyframes niOrb {
          50% { transform: translate3d(40px, -28px, 0) scale(1.12); }
        }
        @keyframes niGrid { to { background-position: 64px 64px; } }
        @keyframes niScan { from { top: -24%; } to { top: 110%; } }
        @keyframes niRing {
          0%, 100% { transform: scale(0.92); opacity: 0.35; }
          50% { transform: scale(1.08); opacity: 0.7; }
        }
        @media (max-width: 760px) {
          .ni-bg__grid { background-size: 48px 48px; opacity: 0.18; }
          .ni-bg__orbs i:nth-child(4), .ni-bg__orbs i:nth-child(5) { display: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ni-bg__aurora, .ni-bg__orbs i, .ni-bg__grid, .ni-bg__scan, .ni-bg__ring { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
