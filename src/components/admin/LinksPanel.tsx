"use client";

import React, { useMemo, useState } from "react";
import {
  Plus,
  Copy,
  Check,
  ExternalLink,
  BarChart3,
  MousePointerClick,
  Users,
  UserCheck,
  Bot,
  Eye,
  Pencil,
  Trash2,
  Download,
  ArrowLeft,
  Power,
  Search,
  Globe,
  Smartphone,
  Share2,
  X,
} from "lucide-react";
import type { ClickAvora, LinkAvora } from "@/types/avora";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { buildWaMeUrl } from "@/lib/telemetry";
import { downloadCsv } from "@/lib/csv";
import { WhatsAppSvg } from "@/components/AvoraIcons";
import TelemetryModal from "./TelemetryModal";

interface Props {
  links: LinkAvora[];
  clicks: ClickAvora[];
  onRefresh: () => void;
}

function slugifyText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export default function LinksPanel({ links, clicks, onRefresh }: Props) {
  // "all" = Vista General de todos los links | link.id = Vista Individual
  const [selectedLinkId, setSelectedLinkId] = useState<string>("all");
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [clickFilterMode, setClickFilterMode] = useState<"humans" | "identified" | "all">("humans");
  const [searchClicks, setSearchClicks] = useState("");
  const [inspectingClick, setInspectingClick] = useState<ClickAvora | null>(null);

  // Modal state for Create / Edit Link
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<LinkAvora | null>(null);
  const [title, setTitle] = useState("");
  const [eventName, setEventName] = useState("");
  const [slug, setSlug] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [ogTitle, setOgTitle] = useState("");
  const [ogDescription, setOgDescription] = useState("");
  const [ogImageUrl, setOgImageUrl] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedLink = useMemo(
    () => (selectedLinkId === "all" ? null : links.find((l) => l.id === selectedLinkId) || null),
    [selectedLinkId, links]
  );

  // Scoped clicks (All links vs Single selected link)
  const scopedClicks = useMemo(() => {
    if (selectedLinkId === "all") return clicks;
    return clicks.filter((c) => c.link_id === selectedLinkId);
  }, [clicks, selectedLinkId]);

  const humanClicks = useMemo(() => scopedClicks.filter((c) => !c.is_bot), [scopedClicks]);
  const botClicksCount = scopedClicks.length - humanClicks.length;

  // Per-link summary counts for the Links Directory Table
  const linkMetricsMap = useMemo(() => {
    const map = new Map<
      string,
      { totalHumans: number; uniqueVisitors: number; identifiedMembers: number; bots: number }
    >();
    for (const l of links) {
      map.set(l.id, { totalHumans: 0, uniqueVisitors: 0, identifiedMembers: 0, bots: 0 });
    }

    const uniqueSets = new Map<string, Set<string>>();
    for (const c of clicks) {
      const entry = map.get(c.link_id);
      if (!entry) continue;
      if (c.is_bot) {
        entry.bots++;
        continue;
      }
      entry.totalHumans++;
      if (c.member_id) entry.identifiedMembers++;
      const uSet = uniqueSets.get(c.link_id) || new Set<string>();
      const uKey = c.member_id || c.anon_visitor_id || `${c.ip_address}-${c.user_agent}`;
      uSet.add(uKey);
      uniqueSets.set(c.link_id, uSet);
    }

    for (const [linkId, uSet] of uniqueSets.entries()) {
      const entry = map.get(linkId);
      if (entry) entry.uniqueVisitors = uSet.size;
    }

    return map;
  }, [links, clicks]);

  // Scoped Analytics Breakdowns (KPIs + 24h Curve + Top Cities + Top OS + Top Sources)
  const analytics = useMemo(() => {
    const uniqueSet = new Set<string>();
    const identifiedMembersSet = new Set<string>();
    let identifiedClicks = 0;
    const hours = Array.from({ length: 24 }, () => 0);
    const cityMap = new Map<string, number>();
    const osMap = new Map<string, number>();
    const sourceMap = new Map<string, number>();

    for (const c of humanClicks) {
      const uKey = c.member_id || c.anon_visitor_id || `${c.ip_address}-${c.user_agent}`;
      uniqueSet.add(uKey);
      if (c.member_id) {
        identifiedClicks++;
        identifiedMembersSet.add(c.member_id);
      }
      const hr = new Date(c.clicked_at).getHours();
      if (hr >= 0 && hr < 24) hours[hr]++;

      const cityLabel = [c.city, c.region].filter(Boolean).join(", ") || c.country || "No detectada";
      cityMap.set(cityLabel, (cityMap.get(cityLabel) || 0) + 1);

      const osLabel = c.os || "Otro";
      osMap.set(osLabel, (osMap.get(osLabel) || 0) + 1);

      const srcLabel = c.in_app_source || "Directo";
      sourceMap.set(srcLabel, (sourceMap.get(srcLabel) || 0) + 1);
    }

    const toTopList = (m: Map<string, number>) =>
      Array.from(m.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const maxHourVal = Math.max(...hours, 1);

    return {
      totalHumans: humanClicks.length,
      uniqueVisitors: uniqueSet.size,
      identifiedClicks,
      identifiedUniqueMembers: identifiedMembersSet.size,
      hours,
      maxHourVal,
      topCities: toTopList(cityMap),
      topOs: toTopList(osMap),
      topSources: toTopList(sourceMap),
    };
  }, [humanClicks]);

  // Filtered clicks table
  const visibleClicks = useMemo(() => {
    const q = searchClicks.trim().toLowerCase();
    return scopedClicks.filter((c) => {
      if (clickFilterMode === "humans" && c.is_bot) return false;
      if (clickFilterMode === "identified" && (c.is_bot || !c.member_id)) return false;
      if (!q) return true;
      const memberName = c.members_avora?.full_name?.toLowerCase() || "";
      const memberEmail = c.members_avora?.bombo_email?.toLowerCase() || "";
      const memberPhone = c.members_avora?.whatsapp_phone?.toLowerCase() || "";
      const linkTitle = c.links_avora?.title?.toLowerCase() || "";
      return (
        memberName.includes(q) ||
        memberEmail.includes(q) ||
        memberPhone.includes(q) ||
        linkTitle.includes(q) ||
        (c.city || "").toLowerCase().includes(q) ||
        (c.os || "").toLowerCase().includes(q) ||
        (c.browser || "").toLowerCase().includes(q)
      );
    });
  }, [scopedClicks, clickFilterMode, searchClicks]);

  const buildShortUrl = (linkSlug: string) => {
    if (typeof window === "undefined") return `/go/${linkSlug}`;
    return `${window.location.origin}/go/${linkSlug}`;
  };

  const handleCopyShortUrl = async (linkSlug: string) => {
    try {
      await navigator.clipboard.writeText(buildShortUrl(linkSlug));
      setCopiedSlug(linkSlug);
      setTimeout(() => setCopiedSlug(null), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const openCreateModal = () => {
    setEditingLink(null);
    setTitle("");
    setEventName("");
    setSlug("");
    setTargetUrl("");
    setOgTitle("");
    setOgDescription("");
    setOgImageUrl("");
    setIsActive(true);
    setFormError(null);
    setEditorOpen(true);
  };

  const openEditModal = (link: LinkAvora) => {
    setEditingLink(link);
    setTitle(link.title);
    setEventName(link.event_name || "");
    setSlug(link.slug);
    setTargetUrl(link.target_url);
    setOgTitle(link.og_title || "");
    setOgDescription(link.og_description || "");
    setOgImageUrl(link.og_image_url || "");
    setIsActive(link.is_active);
    setFormError(null);
    setEditorOpen(true);
  };

  const handleSaveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanSlug = slugifyText(slug || title);
    if (!cleanSlug) {
      setFormError("Definí un identificador corto válido para el link.");
      return;
    }

    let normalizedTarget = targetUrl.trim();
    if (normalizedTarget && !/^https?:\/\//i.test(normalizedTarget)) {
      normalizedTarget = `https://${normalizedTarget}`;
    }

    try {
      new URL(normalizedTarget);
    } catch {
      setFormError("La URL de destino (Bombo / boletería) no es válida.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const payload = {
        slug: cleanSlug,
        title: title.trim(),
        event_name: eventName.trim() || null,
        target_url: normalizedTarget,
        og_title: ogTitle.trim() || null,
        og_description: ogDescription.trim() || null,
        og_image_url: ogImageUrl.trim() || null,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      };

      if (editingLink) {
        const { error } = await supabase
          .from("links_avora")
          .update(payload)
          .eq("id", editingLink.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("links_avora").insert(payload);
        if (error) throw error;
      }

      setEditorOpen(false);
      onRefresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al guardar el link.";
      setFormError(
        msg.includes("duplicate") || msg.includes("unique")
          ? "Ese identificador corto (/go/...) ya existe. Elegí otro."
          : msg
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (link: LinkAvora) => {
    const supabase = createSupabaseBrowserClient();
    await supabase
      .from("links_avora")
      .update({ is_active: !link.is_active, updated_at: new Date().toISOString() })
      .eq("id", link.id);
    onRefresh();
  };

  const handleDeleteLink = async (link: LinkAvora) => {
    if (
      !window.confirm(
        `¿Eliminar el link "${link.title}" (/go/${link.slug}) y todo su historial de sesiones?`
      )
    ) {
      return;
    }
    const supabase = createSupabaseBrowserClient();
    await supabase.from("links_avora").delete().eq("id", link.id);
    if (selectedLinkId === link.id) setSelectedLinkId("all");
    onRefresh();
  };

  const handleExportClicksCsv = () => {
    const scopeName = selectedLink ? selectedLink.slug : "global";
    downloadCsv(
      `avora-rebotes-${scopeName}-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Fecha y Hora",
        "Link",
        "Slug",
        "Miembro Identificado",
        "WhatsApp Miembro",
        "Mail Bombo Miembro",
        "Es Bot Preview",
        "Ciudad",
        "Region",
        "Pais",
        "ISP",
        "OS",
        "Navegador",
        "Dispositivo",
        "Fuente App",
        "Resolucion",
        "Red",
        "IP",
      ],
      visibleClicks.map((c) => [
        new Date(c.clicked_at).toLocaleString("es-AR"),
        c.links_avora?.title || selectedLink?.title || "",
        c.links_avora?.slug || selectedLink?.slug || "",
        c.members_avora?.full_name || "Anónimo",
        c.members_avora?.whatsapp_phone || "",
        c.members_avora?.bombo_email || "",
        c.is_bot ? c.bot_name || "Sí" : "No",
        c.city,
        c.region,
        c.country,
        c.isp,
        c.os,
        c.browser,
        c.device_type,
        c.in_app_source,
        c.screen_resolution,
        c.connection_type,
        c.ip_address,
      ])
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Action & Scope Switcher Bar */}
      <div className="rounded-2xl border border-avora-border bg-avora-surface p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {selectedLink && (
            <button
              type="button"
              onClick={() => setSelectedLinkId("all")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-avora-border bg-avora-bg hover:bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-200 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Vista General</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-violet-400 shrink-0" />
            <select
              value={selectedLinkId}
              onChange={(e) => setSelectedLinkId(e.target.value)}
              className="rounded-xl border border-avora-border bg-avora-bg px-3.5 py-2 text-xs font-medium text-white focus:border-violet-500 focus:outline-none"
            >
              <option value="all">Vista General — Todos los Links ({links.length})</option>
              {links.map((l) => (
                <option key={l.id} value={l.id}>
                  Individual: {l.title} (/go/{l.slug})
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-violet-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Crear Link de Redirección</span>
        </button>
      </div>

      {/* Individual Selected Link Header Banner */}
      {selectedLink && (
        <div className="rounded-2xl border border-violet-500/35 bg-violet-950/15 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  selectedLink.is_active
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                    : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                }`}
              >
                {selectedLink.is_active ? "Activo" : "Pausado"}
              </span>
              {selectedLink.event_name && (
                <span className="text-xs text-violet-300 font-medium">
                  {selectedLink.event_name}
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-white">{selectedLink.title}</h2>
            <p className="text-xs text-zinc-400 break-all">
              Destino oficial:{" "}
              <a
                href={selectedLink.target_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:underline"
              >
                {selectedLink.target_url}
              </a>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleCopyShortUrl(selectedLink.slug)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors"
            >
              {copiedSlug === selectedLink.slug ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar /go/{selectedLink.slug}</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => openEditModal(selectedLink)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-avora-border bg-avora-bg hover:bg-zinc-900 px-3 py-2 text-xs text-zinc-200 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Editar</span>
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards (Global or Individual) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-avora-border bg-avora-surface p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span>Clics Reales (Humanos)</span>
            <MousePointerClick className="w-4 h-4 text-violet-400" />
          </div>
          <p className="text-2xl font-bold text-white">{analytics.totalHumans}</p>
          <p className="text-[11px] text-zinc-500 mt-1">
            {selectedLink ? "En este link específico" : `Acumulado en ${links.length} links`}
          </p>
        </div>

        <div className="rounded-2xl border border-avora-border bg-avora-surface p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span>Personas Únicas</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-bold text-white">{analytics.uniqueVisitors}</p>
          <p className="text-[11px] text-zinc-500 mt-1">Dispositivos distintos detectados</p>
        </div>

        <div className="rounded-2xl border border-avora-border bg-avora-surface p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span>Miembros Identificados</span>
            <UserCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400">{analytics.identifiedUniqueMembers}</p>
          <p className="text-[11px] text-zinc-400 mt-1">
            {analytics.identifiedClicks} clics con Nombre + WhatsApp
          </p>
        </div>

        <div className="rounded-2xl border border-avora-border bg-avora-surface p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span>Bots Filtrados (WhatsApp)</span>
            <Bot className="w-4 h-4 text-zinc-400" />
          </div>
          <p className="text-2xl font-bold text-zinc-300">{botClicksCount}</p>
          <p className="text-[11px] text-zinc-500 mt-1">Excluidos de tus métricas reales</p>
        </div>
      </div>

      {/* Analytics Visuals: 24h Curve + Geo/OS/Source Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 24h Hourly SVG Chart */}
        <div className="rounded-2xl border border-avora-border bg-avora-surface p-4 lg:col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                Distribución Horaria de Clics (00h – 23h)
              </h3>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Identificá el horario pico de mayor respuesta en el grupo
              </p>
            </div>
          </div>

          <div className="h-36 flex items-end gap-1.5 pt-4">
            {analytics.hours.map((count, hour) => {
              const heightPct = count === 0 ? 4 : Math.max(10, Math.round((count / analytics.maxHourVal) * 100));
              return (
                <div key={hour} className="flex-1 flex flex-col items-center gap-1.5 group">
                  <div className="w-full h-28 flex items-end justify-center relative">
                    {count > 0 && (
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-5 text-[10px] font-mono text-violet-300">
                        {count}
                      </span>
                    )}
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t-md transition-all ${
                        count > 0
                          ? "bg-gradient-to-t from-violet-600/80 to-cyan-400/90 group-hover:from-violet-500 group-hover:to-cyan-300"
                          : "bg-zinc-800/70"
                      }`}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-zinc-500">
                    {hour % 3 === 0 ? `${String(hour).padStart(2, "0")}h` : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Breakdowns Column */}
        <div className="rounded-2xl border border-avora-border bg-avora-surface p-4 space-y-4">
          {/* Top Cities */}
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-300 mb-2">
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>Top Ubicaciones</span>
            </div>
            {analytics.topCities.length === 0 ? (
              <p className="text-xs text-zinc-600">Sin datos aún</p>
            ) : (
              <div className="space-y-1.5">
                {analytics.topCities.slice(0, 3).map(([label, cnt]) => (
                  <div key={label} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 truncate pr-2">{label}</span>
                    <span className="font-mono text-zinc-400">{cnt}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Devices / OS */}
          <div className="border-t border-avora-border/60 pt-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-300 mb-2">
              <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
              <span>Sistemas Operativos</span>
            </div>
            {analytics.topOs.length === 0 ? (
              <p className="text-xs text-zinc-600">Sin datos aún</p>
            ) : (
              <div className="space-y-1.5">
                {analytics.topOs.slice(0, 3).map(([label, cnt]) => (
                  <div key={label} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 truncate pr-2">{label}</span>
                    <span className="font-mono text-zinc-400">{cnt}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Traffic Source */}
          <div className="border-t border-avora-border/60 pt-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-300 mb-2">
              <Share2 className="w-3.5 h-3.5 text-violet-400" />
              <span>Origen del Rebote</span>
            </div>
            {analytics.topSources.length === 0 ? (
              <p className="text-xs text-zinc-600">Sin datos aún</p>
            ) : (
              <div className="space-y-1.5">
                {analytics.topSources.slice(0, 3).map(([label, cnt]) => (
                  <div key={label} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 truncate pr-2">{label}</span>
                    <span className="font-mono text-zinc-400">{cnt}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Global View: Directory of All Created Redirect Links */}
      {selectedLinkId === "all" && (
        <div className="rounded-2xl border border-avora-border bg-avora-surface overflow-hidden">
          <div className="px-4 py-3.5 border-b border-avora-border flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
              Links de Compra y Eventos ({links.length})
            </h3>
            <span className="text-[11px] text-zinc-500">
              Tocá un link para ver su panel individual
            </span>
          </div>

          {links.length === 0 ? (
            <div className="py-12 text-center space-y-3 px-4">
              <p className="text-sm font-medium text-zinc-300">Todavía no creaste ningún link de redirección</p>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">
                Antes de mandar el link de Bombo al grupo de WhatsApp, crealo acá para capturar
                quién entra, desde dónde y a qué hora.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-avora-border text-[11px] uppercase tracking-wider text-zinc-400 bg-avora-bg/50">
                    <th className="py-3 px-4 font-medium">Evento / Título</th>
                    <th className="py-3 px-4 font-medium">Link Corto</th>
                    <th className="py-3 px-4 font-medium">Clics Humanos</th>
                    <th className="py-3 px-4 font-medium">Únicos</th>
                    <th className="py-3 px-4 font-medium">Identificados</th>
                    <th className="py-3 px-4 font-medium">Estado</th>
                    <th className="py-3 px-4 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-avora-border/60 text-xs">
                  {links.map((link) => {
                    const m = linkMetricsMap.get(link.id) || {
                      totalHumans: 0,
                      uniqueVisitors: 0,
                      identifiedMembers: 0,
                      bots: 0,
                    };
                    return (
                      <tr key={link.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => setSelectedLinkId(link.id)}
                            className="text-left group"
                          >
                            <p className="font-semibold text-white group-hover:text-violet-300 transition-colors">
                              {link.title}
                            </p>
                            <p className="text-[11px] text-zinc-500 truncate max-w-[230px]">
                              {link.target_url}
                            </p>
                          </button>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="inline-flex items-center gap-1.5">
                            <span className="font-mono text-cyan-400">/go/{link.slug}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyShortUrl(link.slug)}
                              title="Copiar URL para WhatsApp"
                              className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                            >
                              {copiedSlug === link.slug ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-mono font-semibold text-white">
                          {m.totalHumans}
                        </td>

                        <td className="py-3.5 px-4 font-mono text-zinc-300">{m.uniqueVisitors}</td>

                        <td className="py-3.5 px-4">
                          {m.identifiedMembers > 0 ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
                              {m.identifiedMembers} del grupo
                            </span>
                          ) : (
                            <span className="text-zinc-600">0</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              link.is_active
                                ? "bg-emerald-500/15 text-emerald-300"
                                : "bg-zinc-800 text-zinc-400"
                            }`}
                          >
                            {link.is_active ? "Activo" : "Pausado"}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedLinkId(link.id)}
                              className="rounded-lg border border-violet-500/35 bg-violet-500/15 hover:bg-violet-500/25 px-2.5 py-1 text-[11px] font-medium text-violet-200 transition-colors"
                            >
                              Ver Detalle
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(link)}
                              title="Editar link o preview"
                              className="rounded-lg border border-avora-border bg-avora-bg hover:bg-zinc-800 p-1.5 text-zinc-300 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleActive(link)}
                              title={link.is_active ? "Pausar link" : "Reactivar link"}
                              className="rounded-lg border border-avora-border bg-avora-bg hover:bg-zinc-800 p-1.5 text-zinc-300 transition-colors"
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLink(link)}
                              title="Eliminar link"
                              className="rounded-lg border border-avora-border bg-avora-bg hover:border-red-500/40 hover:text-red-400 p-1.5 text-zinc-500 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Detailed Bounce Sessions Log (Global or Scoped to Individual Link) */}
      <div className="rounded-2xl border border-avora-border bg-avora-surface overflow-hidden">
        <div className="p-4 border-b border-avora-border flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
              {selectedLink
                ? `Registro Individual de Sesiones — ${selectedLink.title}`
                : "Registro Global de Sesiones de Rebote"}
            </h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Detalle técnico y cruce de identidad de cada persona que abrió el link
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchClicks}
                onChange={(e) => setSearchClicks(e.target.value)}
                placeholder="Buscar persona, ciudad, OS..."
                className="rounded-xl border border-avora-border bg-avora-bg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none"
              />
            </div>

            <select
              value={clickFilterMode}
              onChange={(e) => setClickFilterMode(e.target.value as "humans" | "identified" | "all")}
              className="rounded-xl border border-avora-border bg-avora-bg px-3 py-1.5 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none"
            >
              <option value="humans">Humanos reales ({humanClicks.length})</option>
              <option value="identified">
                Solo miembros identificados ({analytics.identifiedClicks})
              </option>
              <option value="all">Incluir bots preview ({scopedClicks.length})</option>
            </select>

            <button
              type="button"
              onClick={handleExportClicksCsv}
              disabled={visibleClicks.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-avora-border bg-avora-bg hover:bg-zinc-900 disabled:opacity-40 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV ({visibleClicks.length})</span>
            </button>
          </div>
        </div>

        {visibleClicks.length === 0 ? (
          <div className="py-12 text-center px-4">
            <p className="text-xs text-zinc-500">No hay sesiones registradas para este filtro todavía.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-avora-border text-[11px] uppercase tracking-wider text-zinc-400 bg-avora-bg/50">
                  <th className="py-3 px-4 font-medium">Hora</th>
                  {selectedLinkId === "all" && <th className="py-3 px-4 font-medium">Link</th>}
                  <th className="py-3 px-4 font-medium">Quién Accedió</th>
                  <th className="py-3 px-4 font-medium">Ubicación</th>
                  <th className="py-3 px-4 font-medium">Dispositivo & Sesión</th>
                  <th className="py-3 px-4 font-medium text-right">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-avora-border/60 text-xs">
                {visibleClicks.slice(0, 200).map((click) => {
                  const m = click.members_avora;
                  const loc =
                    [click.city, click.region].filter(Boolean).join(", ") || click.country || "N/D";
                  return (
                    <tr key={click.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-zinc-300 whitespace-nowrap">
                        {new Date(click.clicked_at).toLocaleString("es-AR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>

                      {selectedLinkId === "all" && (
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => setSelectedLinkId(click.link_id)}
                            className="font-medium text-violet-300 hover:underline text-left"
                          >
                            {click.links_avora?.title || "Link"}
                          </button>
                        </td>
                      )}

                      <td className="py-3 px-4">
                        {click.is_bot ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">
                            <Bot className="w-3 h-3" />
                            <span>{click.bot_name || "Bot Preview"}</span>
                          </span>
                        ) : m ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-emerald-300">{m.full_name}</span>
                              <a
                                href={buildWaMeUrl(m.whatsapp_phone)}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Hablar por WhatsApp"
                                className="text-emerald-400 hover:text-emerald-300"
                              >
                                <WhatsAppSvg className="w-3.5 h-3.5" />
                              </a>
                            </div>
                            <p className="text-[11px] text-zinc-400">{m.bombo_email}</p>
                          </div>
                        ) : (
                          <div>
                            <span className="text-zinc-300">Visitante sin formulario</span>
                            <p className="text-[10px] font-mono text-zinc-500">
                              ID: {(click.anon_visitor_id || click.id).slice(0, 8)}
                            </p>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <p className="text-zinc-200">{loc}</p>
                        {click.isp && (
                          <p className="text-[11px] text-zinc-500 truncate max-w-[170px]">
                            {click.isp}
                          </p>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <p className="text-zinc-200">
                          {click.os || "OS"} • {click.browser || "Navegador"}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          {click.in_app_source || "Directo"}
                          {click.screen_resolution ? ` • ${click.screen_resolution}` : ""}
                          {click.connection_type ? ` • ${click.connection_type.toUpperCase()}` : ""}
                        </p>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setInspectingClick(click)}
                          title="Inspeccionar sesión completa"
                          className="rounded-lg border border-avora-border bg-avora-bg hover:bg-zinc-800 p-1.5 text-zinc-300 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Redirect Link Modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border border-avora-border bg-avora-surface shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-avora-border px-5 py-4">
              <h3 className="text-base font-bold text-white">
                {editingLink ? "Editar Link de Redirección" : "Nuevo Link de Compra / Evento"}
              </h3>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLink} className="p-5 overflow-y-auto space-y-4 text-xs">
              {formError && (
                <div className="rounded-xl border border-red-500/40 bg-red-950/30 p-3 text-red-200">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                    Nombre Interno del Link
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Bombo - Afterlife Tanda 1"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (!editingLink && !slug) {
                        // Auto-hint slug cleanly
                      }
                    }}
                    className="w-full rounded-xl border border-avora-border bg-avora-bg px-3.5 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                    Slug Corto (/go/...)
                  </label>
                  <input
                    type="text"
                    placeholder={slugifyText(title) || "ej: tanda1-sabado"}
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full rounded-xl border border-avora-border bg-avora-bg px-3.5 py-2.5 text-sm font-mono text-cyan-300 focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                    Fiesta / Fecha (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Sábado 14/12 Mandarine"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    className="w-full rounded-xl border border-avora-border bg-avora-bg px-3.5 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                    URL Destino (Link de Bombo / Mesas / Entradas)
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://wearebombo.com/..."
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    className="w-full rounded-xl border border-avora-border bg-avora-bg px-3.5 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* WhatsApp OpenGraph Card Section */}
              <div className="rounded-xl border border-avora-border bg-avora-bg/60 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold uppercase tracking-wider text-violet-300 text-[11px]">
                    Vista Previa en WhatsApp (Opcional)
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-violet-400" />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">Título en tarjeta de WhatsApp</label>
                  <input
                    type="text"
                    placeholder={title || "Ej: Últimos Early Birds Oficiales"}
                    value={ogTitle}
                    onChange={(e) => setOgTitle(e.target.value)}
                    className="w-full rounded-lg border border-avora-border bg-avora-bg px-3 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">Bajada / Descripción corta</label>
                  <input
                    type="text"
                    placeholder="Ej: Acceso oficial por lista de públicas — Cupos limitados"
                    value={ogDescription}
                    onChange={(e) => setOgDescription(e.target.value)}
                    className="w-full rounded-lg border border-avora-border bg-avora-bg px-3 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">URL de Imagen / Flyer (Opcional)</label>
                  <input
                    type="url"
                    placeholder="https://.../flyer.jpg"
                    value={ogImageUrl}
                    onChange={(e) => setOgImageUrl(e.target.value)}
                    className="w-full rounded-lg border border-avora-border bg-avora-bg px-3 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-violet-600 focus:ring-violet-500"
                />
                <span className="text-zinc-200 font-medium">Link habilitado y redirigiendo</span>
              </label>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-avora-border">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="rounded-xl border border-avora-border px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-5 py-2 text-xs font-semibold text-white"
                >
                  {saving ? "Guardando..." : editingLink ? "Guardar Cambios" : "Crear Link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <TelemetryModal
        title={
          inspectingClick?.members_avora?.full_name ||
          (inspectingClick?.is_bot ? inspectingClick.bot_name || "Bot Preview" : "Sesión de Rebote")
        }
        subtitle={
          inspectingClick
            ? `Link: ${inspectingClick.links_avora?.title || selectedLink?.title || ""} (/go/${
                inspectingClick.links_avora?.slug || selectedLink?.slug || ""
              })`
            : undefined
        }
        data={inspectingClick}
        onClose={() => setInspectingClick(null)}
      />
    </div>
  );
}
