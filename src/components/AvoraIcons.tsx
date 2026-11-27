import React from "react";

export function AvoraLogoMark({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="1.5"
        y="1.5"
        width="37"
        height="37"
        rx="11"
        className="stroke-violet-500/50 fill-violet-950/30"
        strokeWidth="1.5"
      />
      <path
        d="M11 27L20 11L29 27"
        stroke="url(#avora_grad)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 22.5H25"
        stroke="#06B6D4"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="20" cy="11" r="2" fill="#A78BFA" />
      <defs>
        <linearGradient id="avora_grad" x1="11" y1="11" x2="29" y2="27" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A78BFA" />
          <stop offset="1" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function WhatsAppSvg({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
      <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" />
    </svg>
  );
}

export function SonicPulseSvg({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="20" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="13" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5" />
      <path
        d="M14 24h3l2.5-7 4.5 14 4-10 2.5 3H34"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
