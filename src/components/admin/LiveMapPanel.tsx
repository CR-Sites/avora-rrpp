"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Crosshair, Globe, Layers, MapPin, MousePointerClick, Users } from "lucide-react";
import type { ClickAvora, InterestOption, LinkAvora, MemberAvora } from "@/types/avora";
import { formatLocationLabel, maskEmail, maskName, maskPhone } from "@/lib/geo-labels";
import { formatArDateTimeShort } from "@/lib/datetime";
import { buildWaMeUrl } from "@/lib/telemetry";
import { WhatsAppSvg } from "@/components/AvoraIcons";

interface Props {
  members: MemberAvora[];
  clicks: ClickAvora[];
  interests: InterestOption[];
  links: LinkAvora[];
  presentationMode?: boolean;
}

type LayerMode = "all" | "members" | "clicks";

interface ZoneItem {
  id: string;
  kind: "member" | "click";
  name: string;
  subtitle: string;
  phone: string | null;
  timestamp: string;
  extra: string;
}

interface LocationCluster {
  key: string;
  lat: number;
  lon: number;
  label: string;
  membersCount: number;
  clicksCount: number;
  totalCount: number;
  recentItems: ZoneItem[];
}

const CARTO_API_KEY = process.env.NEXT_PUBLIC_CARTO_API_KEY?.trim() || "";
const OPENFREEMAP_DARK_STYLE = "https://tiles.openfreemap.org/styles/dark";

export default function LiveMapPanel({
  members,
  clicks,
  interests,
  links,
  presentationMode = false,
}: Props) {
  const [layerMode, setLayerMode] = useState<LayerMode>("all");
  const [interestFilter, setInterestFilter] = useState<string>("all");
  const [linkFilter, setLinkFilter] = useState<string>("all");
  const [selectedClusterKey, setSelectedClusterKey] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  // Filter & cluster geo-located members + human clicks
  const clusters = useMemo<LocationCluster[]>(() => {
    const map = new Map<string, LocationCluster>();

    const includeMembers = layerMode === "all" || layerMode === "members";
    const includeClicks = layerMode === "all" || layerMode === "clicks";

    if (includeMembers) {
      for (const m of members) {
        if (m.latitude === null || m.longitude === null) continue;
        if (
          interestFilter !== "all" &&
          !m.interest_ids.includes(interestFilter) &&
          !m.interest_labels.includes(interestFilter)
        ) {
          continue;
        }
        const key = `${m.latitude.toFixed(3)},${m.longitude.toFixed(3)}`;
        const label = formatLocationLabel(m.city, m.region, m.country, "Zona sin nombre");
        const existing = map.get(key) || {
          key,
          lat: m.latitude,
          lon: m.longitude,
          label,
          membersCount: 0,
          clicksCount: 0,
          totalCount: 0,
          recentItems: [],
        };
        existing.membersCount++;
        existing.totalCount++;
        if (existing.recentItems.length < 25) {
          existing.recentItems.push({
            id: `m-${m.id}`,
            kind: "member",
            name: presentationMode ? maskName(m.full_name) : m.full_name,
            subtitle: presentationMode ? maskEmail(m.bombo_email) : m.bombo_email,
            phone: m.whatsapp_phone,
            timestamp: m.created_at,
            extra: m.interest_labels.slice(0, 2).join(" • ") || "Miembro del grupo",
          });
        }
        map.set(key, existing);
      }
    }

    if (includeClicks) {
      for (const c of clicks) {
        if (c.is_bot) continue;
        if (c.latitude === null || c.longitude === null) continue;
        if (linkFilter !== "all" && c.link_id !== linkFilter) continue;

        const key = `${c.latitude.toFixed(3)},${c.longitude.toFixed(3)}`;
        const label = formatLocationLabel(c.city, c.region, c.country, "Zona sin nombre");
        const existing = map.get(key) || {
          key,
          lat: c.latitude,
          lon: c.longitude,
          label,
          membersCount: 0,
          clicksCount: 0,
          totalCount: 0,
          recentItems: [],
        };
        existing.clicksCount++;
        existing.totalCount++;
        if (existing.recentItems.length < 25) {
          const memberName = c.members_avora?.full_name;
          existing.recentItems.push({
            id: `c-${c.id}`,
            kind: "click",
            name: memberName
              ? presentationMode
                ? maskName(memberName)
                : memberName
              : `Clic ${c.os || "Móvil"}`,
            subtitle: c.links_avora?.title || "Link de Compra",
            phone: c.members_avora?.whatsapp_phone || null,
            timestamp: c.clicked_at,
            extra: `${c.in_app_source || "Directo"} • ${c.browser || "Navegador"}`,
          });
        }
        map.set(key, existing);
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalCount - a.totalCount);
  }, [members, clicks, layerMode, interestFilter, linkFilter, presentationMode]);

  const totalPoints = useMemo(
    () => clusters.reduce((acc, c) => acc + c.totalCount, 0),
    [clusters]
  );

  const selectedCluster = useMemo(() => {
    if (clusters.length === 0) return null;
    if (selectedClusterKey) {
      const found = clusters.find((c) => c.key === selectedClusterKey);
      if (found) return found;
    }
    return clusters[0];
  }, [clusters, selectedClusterKey]);

  const fitMapToClusters = useCallback(
    (targetClusters: LocationCluster[]) => {
      const map = mapInstanceRef.current;
      if (!map) return;

      if (targetClusters.length === 0) {
        map.flyTo({ center: [-58.2, -34.75], zoom: 8, duration: 700 });
        return;
      }
      if (targetClusters.length === 1) {
        map.flyTo({
          center: [targetClusters[0].lon, targetClusters[0].lat],
          zoom: 11,
          duration: 750,
        });
        return;
      }
      const bounds = new maplibregl.LngLatBounds();
      for (const c of targetClusters) {
        bounds.extend([c.lon, c.lat]);
      }
      map.fitBounds(bounds, { padding: 64, maxZoom: 12, duration: 750 });
    },
    []
  );

  // Initialize MapLibre instance once
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapInstanceRef.current) return;

    const encodedKey = CARTO_API_KEY ? encodeURIComponent(CARTO_API_KEY) : "";
    const styleUrl = encodedKey
      ? `https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json?key=${encodedKey}`
      : OPENFREEMAP_DARK_STYLE;

    const map = new maplibregl.Map({
      container,
      style: styleUrl,
      center: [-58.2, -34.75],
      zoom: 8,
      attributionControl: false,
      transformRequest: encodedKey
        ? (url) => {
            if (url.includes("cartocdn.com") && !url.includes("key=")) {
              const sep = url.includes("?") ? "&" : "?";
              return { url: `${url}${sep}key=${encodedKey}` };
            }
            return { url };
          }
        : undefined,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    map.on("load", () => {
      if (!map.getSource("avora-heat")) {
        map.addSource("avora-heat", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }

      if (!map.getLayer("avora-heatmap-layer")) {
        map.addLayer({
          id: "avora-heatmap-layer",
          type: "heatmap",
          source: "avora-heat",
          paint: {
            "heatmap-weight": ["interpolate", ["linear"], ["get", "weight"], 1, 0.35, 15, 1],
            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 13, 2.2],
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0,
              "rgba(139, 92, 246, 0)",
              0.25,
              "rgba(139, 92, 246, 0.42)",
              0.55,
              "rgba(6, 182, 212, 0.72)",
              0.85,
              "rgba(167, 139, 250, 0.9)",
              1,
              "rgba(244, 244, 248, 0.95)",
            ],
            "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 3, 22, 11, 48],
            "heatmap-opacity": 0.85,
          },
        });
      }

      setMapReady(true);
    });

    mapInstanceRef.current = map;

    return () => {
      for (const m of markersRef.current) {
        m.remove();
      }
      markersRef.current = [];
      map.remove();
      mapInstanceRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Sync GeoJSON heatmap + interactive DOM markers whenever clusters or selection change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    const src = map.getSource("avora-heat") as maplibregl.GeoJSONSource | undefined;
    if (src) {
      src.setData({
        type: "FeatureCollection",
        features: clusters.map((c) => ({
          type: "Feature",
          properties: { weight: c.totalCount, label: c.label },
          geometry: { type: "Point", coordinates: [c.lon, c.lat] },
        })),
      });
    }

    for (const marker of markersRef.current) {
      marker.remove();
    }
    markersRef.current = [];

    const activeKey = selectedCluster?.key || null;

    for (const cluster of clusters) {
      const isSelected = cluster.key === activeKey;
      const sizePx = Math.min(54, Math.max(30, 26 + Math.round(Math.sqrt(cluster.totalCount) * 6)));

      const el = document.createElement("button");
      el.type = "button";
      el.title = `${cluster.label}: ${cluster.totalCount}`;
      el.style.width = `${sizePx}px`;
      el.style.height = `${sizePx}px`;
      el.className =
        "relative flex items-center justify-center rounded-full font-mono text-xs font-bold text-white cursor-pointer transition-transform hover:scale-110 focus:outline-none";

      if (isSelected) {
        const pulse = document.createElement("span");
        pulse.className =
          "absolute inset-0 rounded-full bg-cyan-400/45 animate-ping pointer-events-none";
        el.appendChild(pulse);
      }

      const circle = document.createElement("span");
      circle.className = isSelected
        ? "relative z-10 flex items-center justify-center w-full h-full rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 border-2 border-white shadow-lg shadow-cyan-500/40"
        : "relative z-10 flex items-center justify-center w-full h-full rounded-full bg-violet-600/90 border border-violet-300/70 shadow-md shadow-violet-900/60";
      circle.textContent = String(cluster.totalCount);
      el.appendChild(circle);

      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        setSelectedClusterKey(cluster.key);
        map.flyTo({
          center: [cluster.lon, cluster.lat],
          zoom: Math.max(map.getZoom(), 11),
          duration: 650,
        });
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([cluster.lon, cluster.lat])
        .addTo(map);
      markersRef.current.push(marker);
    }
  }, [clusters, mapReady, selectedCluster]);

  // Fit bounds on initial data load or filter changes
  useEffect(() => {
    if (!mapReady) return;
    fitMapToClusters(clusters);
  }, [mapReady, layerMode, interestFilter, linkFilter, fitMapToClusters]);

  const handleSelectZoneFromRanking = (cluster: LocationCluster) => {
    setSelectedClusterKey(cluster.key);
    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo({
        center: [cluster.lon, cluster.lat],
        zoom: Math.max(map.getZoom(), 11),
        duration: 650,
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Map Filter Bar */}
      <div className="rounded-2xl border border-avora-border bg-avora-surface p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-300 mr-1">
            <Layers className="w-4 h-4 text-violet-400" />
            <span>Capas:</span>
          </div>

          <button
            type="button"
            onClick={() => setLayerMode("all")}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
              layerMode === "all"
                ? "bg-violet-600 text-white"
                : "border border-avora-border bg-avora-bg text-zinc-400 hover:text-white"
            }`}
          >
            Todo (Grupo + Clics)
          </button>

          <button
            type="button"
            onClick={() => setLayerMode("members")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
              layerMode === "members"
                ? "bg-violet-600 text-white"
                : "border border-avora-border bg-avora-bg text-zinc-400 hover:text-white"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Miembros Grupo</span>
          </button>

          <button
            type="button"
            onClick={() => setLayerMode("clicks")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
              layerMode === "clicks"
                ? "bg-cyan-600 text-white"
                : "border border-avora-border bg-avora-bg text-zinc-400 hover:text-white"
            }`}
          >
            <MousePointerClick className="w-3.5 h-3.5" />
            <span>Clics de Compra</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {layerMode !== "clicks" && (
            <select
              value={interestFilter}
              onChange={(e) => setInterestFilter(e.target.value)}
              className="rounded-xl border border-avora-border bg-avora-bg px-3 py-1.5 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none"
            >
              <option value="all">Todos los intereses</option>
              {interests.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}

          {layerMode !== "members" && (
            <select
              value={linkFilter}
              onChange={(e) => setLinkFilter(e.target.value)}
              className="rounded-xl border border-avora-border bg-avora-bg px-3 py-1.5 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none"
            >
              <option value="all">Todos los links</option>
              {links.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => fitMapToClusters(clusters)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-avora-border bg-avora-bg hover:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors"
          >
            <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
            <span>Centrar Mapa</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Map Canvas + Ranking & Zone Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map Canvas */}
        <div className="lg:col-span-2 rounded-2xl border border-avora-border bg-avora-surface overflow-hidden relative min-h-[460px] h-[540px]">
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Floating HUD KPIs */}
          <div className="pointer-events-none absolute top-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 z-10">
            <div className="pointer-events-auto inline-flex items-center gap-3 rounded-xl border border-avora-border/90 bg-avora-bg/85 backdrop-blur-md px-3.5 py-2 text-xs shadow-lg">
              <div className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-zinc-400">Zonas:</span>
                <span className="font-mono font-bold text-white">{clusters.length}</span>
              </div>
              <span className="text-zinc-700">|</span>
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-zinc-400">Puntos:</span>
                <span className="font-mono font-bold text-white">{totalPoints}</span>
              </div>
            </div>

            {clusters.length === 0 && (
              <div className="pointer-events-auto rounded-xl border border-avora-border bg-avora-bg/90 backdrop-blur-md px-3.5 py-2 text-xs text-zinc-300">
                Aún no hay coordenadas registradas para este filtro.
              </div>
            )}
          </div>

          {/* Subtle Open Source Map Attribution */}
          <div className="pointer-events-none absolute bottom-2 left-3 z-10 text-[10px] text-zinc-500/80 bg-black/50 px-2 py-0.5 rounded">
            MapLibre • CARTO Dark • OpenStreetMap
          </div>
        </div>

        {/* Right Column: Ranking & Selected Zone Detail */}
        <div className="rounded-2xl border border-avora-border bg-avora-surface p-4 flex flex-col gap-4 max-h-[540px]">
          {/* Zone Ranking */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                Ranking por Ciudad / Zona
              </h3>
              <span className="text-[11px] font-mono text-zinc-500">{clusters.length} zonas</span>
            </div>

            {clusters.length === 0 ? (
              <p className="text-xs text-zinc-500 py-3">Sin zonas geolocalizadas todavía.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {clusters.map((c) => {
                  const pct = totalPoints > 0 ? Math.round((c.totalCount / totalPoints) * 100) : 0;
                  const isActive = selectedCluster?.key === c.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => handleSelectZoneFromRanking(c)}
                      className={`w-full text-left rounded-xl border p-2.5 transition-all ${
                        isActive
                          ? "border-cyan-500/60 bg-cyan-500/10"
                          : "border-avora-border bg-avora-bg/60 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold text-white truncate pr-2">{c.label}</span>
                        <span className="font-mono text-cyan-300 shrink-0">
                          {c.totalCount} ({pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          style={{ width: `${Math.max(6, pct)}%` }}
                          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected Zone Activity Inspector */}
          <div className="border-t border-avora-border pt-3 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-violet-300">
                  {selectedCluster ? selectedCluster.label : "Detalle de Zona"}
                </h4>
                {selectedCluster && (
                  <p className="text-[11px] text-zinc-500">
                    {selectedCluster.membersCount} ingresos • {selectedCluster.clicksCount} clics
                  </p>
                )}
              </div>
            </div>

            {!selectedCluster ? (
              <p className="text-xs text-zinc-500">Tocá una burbuja del mapa para ver actividad.</p>
            ) : (
              <div className="flex-1 overflow-y-auto divide-y divide-avora-border/60 pr-1">
                {selectedCluster.recentItems.map((item) => (
                  <div key={item.id} className="py-2.5 flex items-start justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            item.kind === "member" ? "bg-violet-400" : "bg-cyan-400"
                          }`}
                        />
                        <p className="font-medium text-white truncate">{item.name}</p>
                      </div>
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5">{item.subtitle}</p>
                      <p className="text-[10px] text-zinc-500 truncate">
                        {item.extra} • {formatArDateTimeShort(item.timestamp)}
                      </p>
                    </div>

                    {!presentationMode && item.phone && (
                      <a
                        href={buildWaMeUrl(item.phone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`WhatsApp ${maskPhone(item.phone)}`}
                        className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 p-1.5 text-emerald-400 shrink-0"
                      >
                        <WhatsAppSvg className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
