"use client";

import React, { useEffect } from "react";
import { ArrowUpRight } from "lucide-react";
import { SonicPulseSvg } from "./AvoraIcons";
import { AVORA_ANON_COOKIE, AVORA_COOKIE_MAX_AGE } from "@/lib/cookies";

interface Props {
  clickId: string | null;
  targetUrl: string;
  title: string;
  anonVisitorId: string;
}

interface NavigatorConnection {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

export default function RedirectBridgeClient({
  clickId,
  targetUrl,
  title,
  anonVisitorId,
}: Props) {
  useEffect(() => {
    // 1. Persist anonymous device cookie for unique visitor deduplication & retroactive attribution
    try {
      document.cookie = `${AVORA_ANON_COOKIE}=${encodeURIComponent(
        anonVisitorId
      )}; path=/; max-age=${AVORA_COOKIE_MAX_AGE}; SameSite=Lax`;
    } catch {
      // Ignore cookie write restrictions
    }

    // 2. Fire ultra-fast non-blocking client telemetry beacon (includes localStorage avora_vid fallback)
    if (clickId) {
      try {
        const nav = navigator as Navigator & {
          connection?: NavigatorConnection;
          deviceMemory?: number;
        };
        const localVid = window.localStorage.getItem("avora_vid") || undefined;
        const payload = JSON.stringify({
          click_id: clickId,
          visitor_token: localVid,
          screen_resolution: `${window.screen.width}x${window.screen.height}`,
          viewport_size: `${window.innerWidth}x${window.innerHeight}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: navigator.language,
          connection_type: nav.connection?.effectiveType || undefined,
          platform: navigator.platform || undefined,
          raw_telemetry: {
            client_enriched_at: new Date().toISOString(),
            hardware_concurrency: navigator.hardwareConcurrency,
            device_memory: nav.deviceMemory,
            max_touch_points: navigator.maxTouchPoints,
            pixel_ratio: window.devicePixelRatio,
            downlink_mbps: nav.connection?.downlink,
            rtt_ms: nav.connection?.rtt,
            client_referrer: document.referrer || undefined,
          },
        });

        let sent = false;
        if (typeof navigator.sendBeacon === "function") {
          const blob = new Blob([payload], { type: "application/json" });
          sent = navigator.sendBeacon("/api/telemetry/enrich", blob);
        }
        if (!sent) {
          fetch("/api/telemetry/enrich", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            keepalive: true,
          }).catch(() => {});
        }
      } catch {
        // Never block destination redirect
      }
    }

    // 3. Immediate redirect to Bombo / Event Ticket URL
    const timer = window.setTimeout(() => {
      window.location.replace(targetUrl);
    }, 85);

    return () => window.clearTimeout(timer);
  }, [clickId, targetUrl, anonVisitorId]);

  return (
    <main className="avora-mesh min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-sm w-full space-y-5">
        <div className="text-violet-400 animate-pulse flex justify-center">
          <SonicPulseSvg className="w-14 h-14" />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300/80">
            Redirigiendo a Acceso Oficial
          </p>
          <h1 className="text-lg font-semibold text-white truncate">{title}</h1>
        </div>
        <div className="pt-2">
          <a
            href={targetUrl}
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white underline underline-offset-4 transition-colors"
          >
            <span>Continuar manualmente si no redirige en 1 segundo</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </main>
  );
}
