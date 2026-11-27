"use client";

import React from "react";
import { X, Globe, Smartphone, Clock, Cpu, Link2 } from "lucide-react";
import type { ClickAvora, MemberAvora } from "@/types/avora";
import { formatArDateTimeShort, formatArFullDateTime } from "@/lib/datetime";
import { formatLocationLabel } from "@/lib/geo-labels";

interface Props {
  title: string;
  subtitle?: string;
  data: MemberAvora | ClickAvora | null;
  memberClicks?: ClickAvora[];
  presentationMode?: boolean;
  onClose: () => void;
}

export default function TelemetryModal({
  title,
  subtitle,
  data,
  memberClicks,
  presentationMode = false,
  onClose,
}: Props) {
  if (!data) return null;

  const isMember = "full_name" in data;
  const timestamp = isMember ? data.created_at : data.clicked_at;

  const locationText = formatLocationLabel(
    data.city,
    data.region,
    data.country,
    "Sin datos de ciudad"
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl border border-avora-border bg-avora-surface shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-avora-border px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-white">{title}</h3>
            {subtitle && <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
            aria-label="Cerrar detalle"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {/* Core Telemetry Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-avora-border bg-avora-bg/70 p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-violet-400 font-semibold uppercase tracking-wider text-[11px]">
                <Globe className="w-3.5 h-3.5" />
                <span>Ubicación y Red</span>
              </div>
              <p className="text-zinc-200 font-medium">{locationText}</p>
              <p className="text-zinc-400">
                IP:{" "}
                <span className="font-mono text-zinc-200">
                  {presentationMode ? "•••.•••.•••" : data.ip_address || "N/D"}
                </span>
              </p>
              <p className="text-zinc-400">
                Proveedor / ISP: <span className="text-zinc-200">{data.isp || "No reportado"}</span>
              </p>
              <p className="text-zinc-400">
                Conexión: <span className="text-zinc-200 uppercase">{data.connection_type || "Estándar"}</span>
              </p>
              {(data.latitude !== null || data.longitude !== null) && (
                <p className="text-zinc-400">
                  Coord. Aprox:{" "}
                  <span className="font-mono text-zinc-300">
                    {data.latitude}, {data.longitude}
                  </span>
                </p>
              )}
            </div>

            <div className="rounded-xl border border-avora-border bg-avora-bg/70 p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-cyan-400 font-semibold uppercase tracking-wider text-[11px]">
                <Smartphone className="w-3.5 h-3.5" />
                <span>Dispositivo y Navegador</span>
              </div>
              <p className="text-zinc-200 font-medium">
                {data.os || "OS N/D"} • {data.browser || "Navegador N/D"}
              </p>
              <p className="text-zinc-400">
                Tipo: <span className="text-zinc-200 capitalize">{data.device_type || "N/D"}</span>{" "}
                ({data.platform || "N/D"})
              </p>
              <p className="text-zinc-400">
                Fuente App: <span className="text-emerald-300 font-medium">{data.in_app_source || "Directo"}</span>
              </p>
              <p className="text-zinc-400">
                Pantalla: <span className="font-mono text-zinc-200">{data.screen_resolution || "N/D"}</span>{" "}
                (Viewport: <span className="font-mono text-zinc-300">{data.viewport_size || "N/D"}</span>)
              </p>
            </div>

            <div className="rounded-xl border border-avora-border bg-avora-bg/70 p-3.5 space-y-1.5 sm:col-span-2">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold uppercase tracking-wider text-[11px]">
                <Clock className="w-3.5 h-3.5" />
                <span>Contexto Temporal y Origen</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5">
                <p className="text-zinc-400">
                  Fecha/Hora:{" "}
                  <span className="text-zinc-200">{formatArFullDateTime(timestamp)}</span>
                </p>
                <p className="text-zinc-400">
                  Zona Horaria: <span className="text-zinc-200">{data.timezone || "N/D"}</span>
                </p>
                <p className="text-zinc-400">
                  Idioma: <span className="text-zinc-200">{data.language || "N/D"}</span>
                </p>
              </div>
              {data.referrer && (
                <p className="text-zinc-400 break-all pt-1">
                  Referrer: <span className="text-zinc-300">{data.referrer}</span>
                </p>
              )}
              {isMember && (data.utm_source || data.utm_medium || data.utm_campaign) && (
                <p className="text-zinc-400 pt-1">
                  UTMs:{" "}
                  <span className="font-mono text-violet-300">
                    {[data.utm_source, data.utm_medium, data.utm_campaign].filter(Boolean).join(" / ")}
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* Member's Clicked Purchase Links History */}
          {isMember && memberClicks && (
            <div className="rounded-xl border border-avora-border bg-avora-bg/70 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-violet-300 font-semibold uppercase tracking-wider text-[11px]">
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Links de Compra Visitados por este Miembro ({memberClicks.length})</span>
                </div>
              </div>
              {memberClicks.length === 0 ? (
                <p className="text-zinc-500">Todavía no registró clics identificados en links de compra.</p>
              ) : (
                <div className="divide-y divide-avora-border/60 max-h-40 overflow-y-auto">
                  {memberClicks.map((c) => (
                    <div key={c.id} className="py-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-zinc-200 font-medium">
                          {c.links_avora?.title || "Link de Evento"}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          /{c.links_avora?.slug} •{" "}
                          {formatLocationLabel(c.city, c.region, c.country, "Ubicación N/D")} •{" "}
                          {c.os || "Dispositivo"}
                        </p>
                      </div>
                      <span className="text-[11px] font-mono text-zinc-400 shrink-0">
                        {formatArDateTimeShort(c.clicked_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* User-Agent & Raw JSON */}
          <div className="rounded-xl border border-avora-border bg-avora-bg/70 p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 text-zinc-300 font-semibold uppercase tracking-wider text-[11px]">
              <Cpu className="w-3.5 h-3.5" />
              <span>User-Agent y Metadatos Técnicos</span>
            </div>
            <p className="font-mono text-[11px] text-zinc-400 break-all bg-black/40 rounded-lg p-2.5 border border-zinc-800/80">
              {data.user_agent || "Sin User-Agent"}
            </p>
            {data.raw_telemetry && Object.keys(data.raw_telemetry).length > 0 && (
              <pre className="font-mono text-[11px] text-zinc-400 bg-black/40 rounded-lg p-2.5 border border-zinc-800/80 overflow-x-auto">
                {JSON.stringify(data.raw_telemetry, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
