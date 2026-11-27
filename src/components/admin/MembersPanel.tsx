"use client";

import React, { useMemo, useState } from "react";
import {
  Search,
  Download,
  Eye,
  Users,
  Smartphone,
  MapPin,
  Sparkles,
  Trash2,
  Mail,
} from "lucide-react";
import type { ClickAvora, InterestOption, MemberAvora } from "@/types/avora";
import { buildWaMeUrl } from "@/lib/telemetry";
import { downloadCsv } from "@/lib/csv";
import { WhatsAppSvg } from "@/components/AvoraIcons";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import TelemetryModal from "./TelemetryModal";

interface Props {
  members: MemberAvora[];
  interests: InterestOption[];
  clicks: ClickAvora[];
  onRefresh: () => void;
}

export default function MembersPanel({ members, interests, clicks, onRefresh }: Props) {
  const [search, setSearch] = useState("");
  const [interestFilter, setInterestFilter] = useState<string>("all");
  const [onlyWithClicks, setOnlyWithClicks] = useState(false);
  const [inspectingMember, setInspectingMember] = useState<MemberAvora | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Map member_id -> human clicks list
  const clicksByMember = useMemo(() => {
    const map = new Map<string, ClickAvora[]>();
    for (const c of clicks) {
      if (c.is_bot || !c.member_id) continue;
      const list = map.get(c.member_id) || [];
      list.push(c);
      map.set(c.member_id, list);
    }
    return map;
  }, [clicks]);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (onlyWithClicks && !(clicksByMember.get(m.id)?.length)) return false;
      if (
        interestFilter !== "all" &&
        !m.interest_ids.includes(interestFilter) &&
        !m.interest_labels.includes(interestFilter)
      ) {
        return false;
      }
      if (!q) return true;
      return (
        m.full_name.toLowerCase().includes(q) ||
        m.whatsapp_phone.toLowerCase().includes(q) ||
        m.bombo_email.toLowerCase().includes(q) ||
        (m.city || "").toLowerCase().includes(q) ||
        m.interest_labels.some((lbl) => lbl.toLowerCase().includes(q))
      );
    });
  }, [members, search, interestFilter, onlyWithClicks, clicksByMember]);

  // Quick KPIs
  const stats = useMemo(() => {
    const now = Date.now();
    const last7d = members.filter(
      (m) => now - new Date(m.created_at).getTime() <= 7 * 24 * 3600 * 1000
    ).length;

    const cityCounts = new Map<string, number>();
    const interestCounts = new Map<string, number>();
    let mobileCount = 0;

    for (const m of members) {
      if (m.device_type === "mobile") mobileCount++;
      const city = m.city || m.country || "Sin ciudad";
      cityCounts.set(city, (cityCounts.get(city) || 0) + 1);
      for (const lbl of m.interest_labels) {
        interestCounts.set(lbl, (interestCounts.get(lbl) || 0) + 1);
      }
    }

    const topCity =
      Array.from(cityCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/D";
    const topInterest =
      Array.from(interestCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/D";
    const mobilePct = members.length > 0 ? Math.round((mobileCount / members.length) * 100) : 0;

    return { last7d, topCity, topInterest, mobilePct };
  }, [members]);

  const handleExportFullCsv = () => {
    downloadCsv(
      `avora-miembros-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Nombre Completo",
        "WhatsApp",
        "Mail de Bombo",
        "Intereses",
        "Clics en Links de Compra",
        "Ciudad",
        "Provincia/Region",
        "Pais",
        "OS",
        "Navegador",
        "Fuente",
        "IP",
        "Fecha Ingreso",
      ],
      filteredMembers.map((m) => [
        m.full_name,
        m.whatsapp_phone,
        m.bombo_email,
        m.interest_labels.join(" | "),
        clicksByMember.get(m.id)?.length || 0,
        m.city,
        m.region,
        m.country,
        m.os,
        m.browser,
        m.in_app_source,
        m.ip_address,
        new Date(m.created_at).toLocaleString("es-AR"),
      ])
    );
  };

  const handleExportBomboEmails = () => {
    const withEmail = filteredMembers.filter((m) => m.bombo_email);
    downloadCsv(
      `avora-mails-bombo-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Mail de Bombo", "Nombre Completo", "WhatsApp", "Intereses"],
      withEmail.map((m) => [
        m.bombo_email,
        m.full_name,
        m.whatsapp_phone,
        m.interest_labels.join(" | "),
      ])
    );
  };

  const handleDeleteMember = async (member: MemberAvora) => {
    if (!window.confirm(`¿Eliminar a ${member.full_name} de la base registrada?`)) return;
    setDeletingId(member.id);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.from("members_avora").delete().eq("id", member.id);
      onRefresh();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-avora-border bg-avora-surface p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span>Miembros Registrados</span>
            <Users className="w-4 h-4 text-violet-400" />
          </div>
          <p className="text-2xl font-bold text-white">{members.length}</p>
          <p className="text-[11px] text-emerald-400 mt-1">+{stats.last7d} en los últimos 7 días</p>
        </div>

        <div className="rounded-2xl border border-avora-border bg-avora-surface p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span>Interés Principal</span>
            <Sparkles className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-base font-bold text-white truncate">{stats.topInterest}</p>
          <p className="text-[11px] text-zinc-500 mt-1">Tendencia actual del grupo</p>
        </div>

        <div className="rounded-2xl border border-avora-border bg-avora-surface p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span>Ubicación Principal</span>
            <MapPin className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-base font-bold text-white truncate">{stats.topCity}</p>
          <p className="text-[11px] text-zinc-500 mt-1">Detectada por sesión pasiva</p>
        </div>

        <div className="rounded-2xl border border-avora-border bg-avora-surface p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span>Acceso desde Celular</span>
            <Smartphone className="w-4 h-4 text-violet-400" />
          </div>
          <p className="text-2xl font-bold text-white">{stats.mobilePct}%</p>
          <p className="text-[11px] text-zinc-500 mt-1">Tráfico móvil verificado</p>
        </div>
      </div>

      {/* Filters & Export Bar */}
      <div className="rounded-2xl border border-avora-border bg-avora-surface p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nombre, WhatsApp, mail de Bombo o ciudad..."
              className="w-full rounded-xl border border-avora-border bg-avora-bg pl-9 pr-3.5 py-2 text-xs text-white placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none"
            />
          </div>

          <select
            value={interestFilter}
            onChange={(e) => setInterestFilter(e.target.value)}
            className="rounded-xl border border-avora-border bg-avora-bg px-3 py-2 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none"
          >
            <option value="all">Todos los intereses</option>
            {interests.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setOnlyWithClicks((v) => !v)}
            className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
              onlyWithClicks
                ? "border-violet-500 bg-violet-500/15 text-violet-200"
                : "border-avora-border bg-avora-bg text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Con clics en compra
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportBomboEmails}
            disabled={filteredMembers.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-avora-border bg-avora-bg hover:bg-zinc-900 disabled:opacity-40 px-3 py-2 text-xs font-medium text-zinc-200 transition-colors"
          >
            <Mail className="w-3.5 h-3.5 text-cyan-400" />
            <span>CSV Mails Bombo</span>
          </button>
          <button
            type="button"
            onClick={handleExportFullCsv}
            disabled={filteredMembers.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 px-3.5 py-2 text-xs font-semibold text-white transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Base ({filteredMembers.length})</span>
          </button>
        </div>
      </div>

      {/* Members Table */}
      <div className="rounded-2xl border border-avora-border bg-avora-surface overflow-hidden">
        {filteredMembers.length === 0 ? (
          <div className="py-14 text-center space-y-2 px-4">
            <p className="text-sm font-medium text-zinc-300">No hay miembros que coincidan con el filtro</p>
            <p className="text-xs text-zinc-500">
              Compartí el enlace público de acceso al grupo para empezar a poblar tu base verificada.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-avora-border text-[11px] uppercase tracking-wider text-zinc-400 bg-avora-bg/50">
                  <th className="py-3 px-4 font-medium">Miembro</th>
                  <th className="py-3 px-4 font-medium">WhatsApp / Bombo</th>
                  <th className="py-3 px-4 font-medium">Intereses</th>
                  <th className="py-3 px-4 font-medium">Sesión & Ubicación</th>
                  <th className="py-3 px-4 font-medium">Actividad</th>
                  <th className="py-3 px-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-avora-border/60 text-xs">
                {filteredMembers.map((member) => {
                  const mClicks = clicksByMember.get(member.id) || [];
                  const locationStr = [member.city, member.region].filter(Boolean).join(", ") || member.country || "N/D";
                  return (
                    <tr key={member.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-white">{member.full_name}</p>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          Ingreso:{" "}
                          {new Date(member.created_at).toLocaleString("es-AR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 space-y-1">
                        <a
                          href={buildWaMeUrl(member.whatsapp_phone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 font-mono text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                          <WhatsAppSvg className="w-3.5 h-3.5" />
                          <span>{member.whatsapp_phone}</span>
                        </a>
                        <p className="text-zinc-300 truncate max-w-[210px]" title={member.bombo_email}>
                          {member.bombo_email || "Sin mail"}
                        </p>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1 max-w-[240px]">
                          {member.interest_labels.length === 0 ? (
                            <span className="text-zinc-600">—</span>
                          ) : (
                            member.interest_labels.map((lbl) => (
                              <span
                                key={lbl}
                                className="rounded-md bg-violet-500/10 border border-violet-500/25 px-2 py-0.5 text-[11px] text-violet-200"
                              >
                                {lbl}
                              </span>
                            ))
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="text-zinc-200">{locationStr}</p>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          {member.os || "OS"} • {member.browser || "Browser"} •{" "}
                          <span className="text-zinc-400">{member.in_app_source || "Directo"}</span>
                        </p>
                      </td>

                      <td className="py-3.5 px-4">
                        {mClicks.length > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-cyan-500/15 border border-cyan-500/30 px-2.5 py-0.5 text-[11px] font-medium text-cyan-300">
                            {mClicks.length} {mClicks.length === 1 ? "clic compra" : "clics compra"}
                          </span>
                        ) : (
                          <span className="text-[11px] text-zinc-600">Sin rebotes aún</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <a
                            href={buildWaMeUrl(
                              member.whatsapp_phone,
                              `Hola ${member.full_name.split(" ")[0]}, te escribo del grupo oficial de eventos.`
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Abrir chat de WhatsApp"
                            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 p-1.5 text-emerald-400 transition-colors"
                          >
                            <WhatsAppSvg className="w-3.5 h-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => setInspectingMember(member)}
                            title="Ver toda la telemetría de sesión"
                            className="rounded-lg border border-avora-border bg-avora-bg hover:bg-zinc-800 p-1.5 text-zinc-300 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === member.id}
                            onClick={() => handleDeleteMember(member)}
                            title="Eliminar registro"
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

      <TelemetryModal
        title={inspectingMember ? inspectingMember.full_name : ""}
        subtitle={
          inspectingMember
            ? `${inspectingMember.whatsapp_phone} • Bombo: ${inspectingMember.bombo_email}`
            : undefined
        }
        data={inspectingMember}
        memberClicks={inspectingMember ? clicksByMember.get(inspectingMember.id) || [] : []}
        onClose={() => setInspectingMember(null)}
      />
    </div>
  );
}
