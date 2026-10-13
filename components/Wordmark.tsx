export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
        {/* market awning: scalloped saffron stripes over a green stall */}
        <rect x="3" y="14" width="28" height="17" rx="3" fill="#0f3d2e" />
        <path d="M2 14 L6 4 H28 L32 14 Z" fill="#e8a317" />
        <path d="M2 14 q3.7 5 7.5 0 q3.7 5 7.5 0 q3.7 5 7.5 0 q3.7 5 7.5 0 Z" fill="#fbf6ea" />
        <path d="M9.5 4 L8 14 M17 4 V14 M24.5 4 L26 14" stroke="#b97a00" strokeWidth="1.4" />
        <circle cx="17" cy="23" r="4.2" fill="none" stroke="#e8a317" strokeWidth="2.2" />
      </svg>
      <span className="font-display text-3xl font-semibold tracking-tight text-forest">Oja</span>
    </span>
  );
}
