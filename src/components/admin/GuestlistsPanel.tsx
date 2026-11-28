"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardCopy,
  ClipboardList,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Pencil,
  Plus,
  Power,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import type {
  GuestlistAvora,
  GuestlistEntryAvora,
} from "@/types/avora";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatArDateOnly, formatArDateTimeShort, getArDateIso } from "@/lib/datetime";
import { maskEmail, maskName, maskPhone } from "@/lib/geo-labels";
import { buildWaMeUrl } from "@/lib/telemetry";
import { downloadCsv } from "@/lib/csv";
import { WhatsAppSvg } from "@/components/AvoraIcons";

interface Props {
  guestlists: GuestlistAvora[];
  entries: GuestlistEntryAvora[];
  defaultRrppName: string;
  renderedAt: string;
  presentationMode?: boolean;
  onRefresh: () => void;
}

type DirectoryFilter = "active" | "past" | "all";
type CategoryTab = "dama_free" | "hombre_consumo" | "all";

function slugifyText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function cleanTsvCell(value: string | null | undefined): string {
  return (value || "").replace(/[\t\r\n]+/g, " ").trim();
}

export default function GuestlistsPanel({
  guestlists,
  entries,
  defaultRrppName,
  renderedAt,
  presentationMode = false,
  onRefresh,
}: Props) {
  const [listItems, setListItems] = useState<GuestlistAvora[]>(guestlists);
  const [entryItems, setEntryItems] = useState<GuestlistEntryAvora[]>(entries);

  const [directoryFilter, setDirectoryFilter] = useState<DirectoryFilter>("active");
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [categoryTab, setCategoryTab] = useState<CategoryTab>("dama_free");
  const [searchEntries, setSearchEntries] = useState("");
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [sheetBanner, setSheetBanner] = useState<{ ok: boolean; msg: string } | null>(null);
  const [markingSynced, setMarkingSynced] = useState(false);

  // Create / Edit Event Modal state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingList, setEditingList] = useState<GuestlistAvora | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [rrppName, setRrppName] = useState(defaultRrppName || "");
  const [description, setDescription] = useState("");
  const [womenLabel, setWomenLabel] = useState("Dama - Free");
  const [menLabel, setMenLabel] = useState("Hombre - 100% Consumo");
  const [womenCap, setWomenCap] = useState("");
  const [menCap, setMenCap] = useState("");
  const [isOpen, setIsOpen] = useState(true);
  const [savingList, setSavingList] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setListItems(guestlists);
  }, [guestlists]);

  useEffect(() => {
    setEntryItems(entries);
  }, [entries]);

  const todayArIso = useMemo(() => getArDateIso(renderedAt), [renderedAt]);

  const isEventActive = (list: GuestlistAvora): boolean => {
    if (!list.is_open || list.status !== "active") return false;
    if (list.event_date && todayArIso && list.event_date < todayArIso) return false;
    return true;
  };

  const refreshGuestlistsFromDb = async () => {
    const supabase = createSupabaseBrowserClient();
    const [listsRes, entriesRes] = await Promise.all([
      supabase
        .from("guestlists_avora")
        .select("*")
        .order("event_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("guestlist_entries_avora")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(5000),
    ]);
    if (!listsRes.error && listsRes.data) {
      setListItems(listsRes.data as GuestlistAvora[]);
    }
    if (!entriesRes.error && entriesRes.data) {
      setEntryItems(entriesRes.data as GuestlistEntryAvora[]);
    }
    onRefresh();
  };

  // Per-list entry counts
  const countsByList = useMemo(() => {
    const map = new Map<
      string,
      {
        womenTotal: number;
        womenPending: number;
        menTotal: number;
        menPending: number;
        total: number;
        pending: number;
      }
    >();
    for (const l of listItems) {
      map.set(l.id, {
        womenTotal: 0,
        womenPending: 0,
        menTotal: 0,
        menPending: 0,
        total: 0,
        pending: 0,
      });
    }
    for (const e of entryItems) {
      const m = map.get(e.guestlist_id);
      if (!m) continue;
      m.total++;
      if (!e.synced_to_sheet) m.pending++;
      if (e.category === "dama_free") {
        m.womenTotal++;
        if (!e.synced_to_sheet) m.womenPending++;
      } else {
        m.menTotal++;
        if (!e.synced_to_sheet) m.menPending++;
      }
    }
    return map;
  }, [listItems, entryItems]);

  const activeListsCount = useMemo(
    () => listItems.filter((l) => isEventActive(l)).length,
    [listItems, todayArIso]
  );
  const pastListsCount = listItems.length - activeListsCount;

  const filteredLists = useMemo(() => {
    return listItems.filter((l) => {
      const active = isEventActive(l);
      if (directoryFilter === "active") return active;
      if (directoryFilter === "past") return !active;
      return true;
    });
  }, [listItems, directoryFilter, todayArIso]);

  const selectedList = useMemo(
    () => (selectedListId ? listItems.find((l) => l.id === selectedListId) || null : null),
    [selectedListId, listItems]
  );

  const selectedEntries = useMemo(() => {
    if (!selectedList) return [];
    return entryItems.filter((e) => e.guestlist_id === selectedList.id);
  }, [selectedList, entryItems]);

  const tabStats = useMemo(() => {
    const women = selectedEntries.filter((e) => e.category === "dama_free");
    const men = selectedEntries.filter((e) => e.category === "hombre_consumo");
    return {
      womenTotal: women.length,
      womenPending: women.filter((e) => !e.synced_to_sheet).length,
      menTotal: men.length,
      menPending: men.filter((e) => !e.synced_to_sheet).length,
      allTotal: selectedEntries.length,
      allPending: selectedEntries.filter((e) => !e.synced_to_sheet).length,
    };
  }, [selectedEntries]);

  const visibleEntries = useMemo(() => {
    const q = searchEntries.trim().toLowerCase();
    return selectedEntries.filter((e) => {
      if (categoryTab !== "all" && e.category !== categoryTab) return false;
      if (!q) return true;
      return (
        e.first_name.toLowerCase().includes(q) ||
        e.last_name.toLowerCase().includes(q) ||
        e.dni.includes(q) ||
        e.bombo_email.toLowerCase().includes(q) ||
        e.rrpp_name.toLowerCase().includes(q)
      );
    });
  }, [selectedEntries, categoryTab, searchEntries]);

  const pendingInCurrentTab = useMemo(() => {
    return selectedEntries.filter(
      (e) => !e.synced_to_sheet && (categoryTab === "all" || e.category === categoryTab)
    );
  }, [selectedEntries, categoryTab]);

  const buildPublicListUrl = (listSlug: string) => {
    if (typeof window === "undefined") return `/lista/${listSlug}`;
    return `${window.location.origin}/lista/${listSlug}`;
  };

  const handleCopyPublicUrl = async (listSlug: string) => {
    try {
      await navigator.clipboard.writeText(buildPublicListUrl(listSlug));
      setCopiedSlug(listSlug);
      setTimeout(() => setCopiedSlug(null), 1800);
    } catch {
      // Clipboard ignored
    }
  };

  const openCreateModal = () => {
    setEditingList(null);
    setTitle("");
    setSlug("");
    setEventDate(todayArIso || "");
    setRrppName(defaultRrppName || "RRPP");
    setDescription(
      "Completá tus datos reales y tu mail de Bombo para quedar en lista (Dama Free / Hombre 100% Consumo)."
    );
    setWomenLabel("Dama - Free");
    setMenLabel("Hombre - 100% Consumo");
    setWomenCap("");
    setMenCap("");
    setIsOpen(true);
    setFormError(null);
    setEditorOpen(true);
  };

  const openEditModal = (list: GuestlistAvora) => {
    setEditingList(list);
    setTitle(list.title);
    setSlug(list.slug);
    setEventDate(list.event_date || "");
    setRrppName(list.rrpp_name);
    setDescription(list.description || "");
    setWomenLabel(list.women_label);
    setMenLabel(list.men_label);
    setWomenCap(list.women_cap !== null ? String(list.women_cap) : "");
    setMenCap(list.men_cap !== null ? String(list.men_cap) : "");
    setIsOpen(list.is_open && list.status === "active");
    setFormError(null);
    setEditorOpen(true);
  };

  const handleSaveList = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanSlug = slugifyText(slug || title);
    if (!cleanSlug) {
      setFormError("Ingresá un identificador corto válido para la URL.");
      return;
    }

    const parsedWomenCap = womenCap.trim() ? Number.parseInt(womenCap.trim(), 10) : null;
    const parsedMenCap = menCap.trim() ? Number.parseInt(menCap.trim(), 10) : null;

    setSavingList(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const payload = {
        slug: cleanSlug,
        title: title.trim(),
        event_date: eventDate.trim() || null,
        rrpp_name: rrppName.trim() || defaultRrppName || "RRPP",
        description: description.trim() || null,
        women_label: womenLabel.trim() || "Dama - Free",
        men_label: menLabel.trim() || "Hombre - 100% Consumo",
        women_cap: parsedWomenCap && parsedWomenCap > 0 ? parsedWomenCap : null,
        men_cap: parsedMenCap && parsedMenCap > 0 ? parsedMenCap : null,
        is_open: isOpen,
        status: isOpen ? "active" : "closed",
        updated_at: new Date().toISOString(),
      };

      if (editingList) {
        const { error } = await supabase
          .from("guestlists_avora")
          .update(payload)
          .eq("id", editingList.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("guestlists_avora").insert(payload);
        if (error) throw error;
      }

      setEditorOpen(false);
      await refreshGuestlistsFromDb();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo guardar la lista.";
      setFormError(
        msg.includes("duplicate") || msg.includes("unique")
          ? "Ese identificador (/lista/...) ya existe en otro evento."
          : msg
      );
    } finally {
      setSavingList(false);
    }
  };

  const handleToggleListOpen = async (list: GuestlistAvora) => {
    const nextOpen = !(list.is_open && list.status === "active");
    const supabase = createSupabaseBrowserClient();
    await supabase
      .from("guestlists_avora")
      .update({
        is_open: nextOpen,
        status: nextOpen ? "active" : "closed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", list.id);
    await refreshGuestlistsFromDb();
  };

  const handleDeleteList = async (list: GuestlistAvora) => {
    if (
      !window.confirm(
        `¿Eliminar la lista "${list.title}" y todos los invitados anotados en ella?`
      )
    ) {
      return;
    }
    const supabase = createSupabaseBrowserClient();
    await supabase.from("guestlists_avora").delete().eq("id", list.id);
    if (selectedListId === list.id) setSelectedListId(null);
    await refreshGuestlistsFromDb();
  };

  const buildSheetTsv = (rows: GuestlistEntryAvora[]): string => {
    // Matches exact shared Sheet columns B..F: RRPP | NOMBRE | APELLIDO | DNI | MAIL BOMBO
    return rows
      .map((r) =>
        [
          cleanTsvCell(r.rrpp_name),
          cleanTsvCell(r.first_name),
          cleanTsvCell(r.last_name),
          r.dni.replace(/\D/g, ""),
          cleanTsvCell(r.bombo_email).toLowerCase(),
        ].join("\t")
      )
      .join("\n");
  };

  const handleCopyTsvForSheet = async (onlyPending: boolean) => {
    if (!selectedList) return;
    const rows = onlyPending
      ? pendingInCurrentTab
      : selectedEntries.filter((e) => categoryTab === "all" || e.category === categoryTab);

    if (rows.length === 0) {
      setSheetBanner({
        ok: false,
        msg: onlyPending
          ? "No hay invitados pendientes para volcar en esta pestaña."
          : "No hay invitados cargados en esta pestaña.",
      });
      return;
    }

    try {
      const tsv = buildSheetTsv(rows);
      await navigator.clipboard.writeText(tsv);
      const tabName =
        categoryTab === "dama_free"
          ? "DAMA - FREE"
          : categoryTab === "hombre_consumo"
          ? "HOMBRES - 100% CONSUMO"
          : "la pestaña correspondiente";
      setSheetBanner({
        ok: true,
        msg: `Copiadas ${rows.length} filas en formato exacto. Andá a la pestaña "${tabName}" del Google Sheet, hacé clic en la primera celda libre de la columna B (RRPP) y apretá Ctrl + V.`,
      });
    } catch {
      setSheetBanner({
        ok: false,
        msg: "El navegador bloqueó el portapapeles. Probá exportando el CSV.",
      });
    }
  };

  const handleMarkPendingAsSynced = async () => {
    if (pendingInCurrentTab.length === 0) return;
    setMarkingSynced(true);
    setSheetBanner(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const ids = pendingInCurrentTab.map((e) => e.id);
      const { error } = await supabase
        .from("guestlist_entries_avora")
        .update({ synced_to_sheet: true, synced_at: new Date().toISOString() })
        .in("id", ids);

      if (error) throw error;
      setSheetBanner({
        ok: true,
        msg: `Listo: ${ids.length} invitados quedaron marcados como ya cargados en el Sheet.`,
      });
      await refreshGuestlistsFromDb();
    } catch (err) {
      setSheetBanner({
        ok: false,
        msg: err instanceof Error ? err.message : "No se pudieron marcar como cargados.",
      });
    } finally {
      setMarkingSynced(false);
    }
  };

  const handleToggleSingleSynced = async (entry: GuestlistEntryAvora) => {
    const nextVal = !entry.synced_to_sheet;
    setEntryItems((prev) =>
      prev.map((row) => (row.id === entry.id ? { ...row, synced_to_sheet: nextVal } : row))
    );
    const supabase = createSupabaseBrowserClient();
    await supabase
      .from("guestlist_entries_avora")
      .update({
        synced_to_sheet: nextVal,
        synced_at: nextVal ? new Date().toISOString() : null,
      })
      .eq("id", entry.id);
    await refreshGuestlistsFromDb();
  };

  const handleDeleteEntry = async (entry: GuestlistEntryAvora) => {
    if (
      !window.confirm(
        `¿Quitar de la lista a ${entry.first_name} ${entry.last_name} (DNI ${entry.dni})?`
      )
    ) {
      return;
    }
    const supabase = createSupabaseBrowserClient();
    await supabase.from("guestlist_entries_avora").delete().eq("id", entry.id);
    await refreshGuestlistsFromDb();
  };

  const handleExportListCsv = () => {
    if (!selectedList) return;
    downloadCsv(
      `avora-lista-${selectedList.slug}-${categoryTab}.csv`,
      ["Categoría", "RRPP", "Nombre", "Apellido", "DNI", "Mail Bombo", "WhatsApp", "En Sheet", "Fecha"],
      visibleEntries.map((e) => [
        e.category === "dama_free" ? selectedList.women_label : selectedList.men_label,
        e.rrpp_name,
        e.first_name,
        e.last_name,
        e.dni,
        e.bombo_email,
        e.whatsapp_phone || "",
        e.synced_to_sheet ? "Sí" : "Pendiente",
        formatArDateTimeShort(e.created_at),
      ])
    );
  };

  // =========================================================================
  // RENDER: INDIVIDUAL EVENT GUESTLIST VIEW
  // =========================================================================
  if (selectedList) {
    const active = isEventActive(selectedList);
    return (
      <div className="space-y-5">
        {/* Top Event Header */}
        <div className="rounded-2xl border border-avora-border bg-avora-surface p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedListId(null);
                  setSheetBanner(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-avora-border bg-avora-bg hover:bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-200 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Todas las Listas</span>
              </button>

              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  active
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                    : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                }`}
              >
                {active ? "Evento Activo" : selectedList.is_open ? "Fecha Pasada" : "Lista Cerrada"}
              </span>

              {selectedList.event_date && (
                <span className="inline-flex items-center gap-1 text-xs font-mono text-cyan-300">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{formatArDateOnly(selectedList.event_date)}</span>
                </span>
              )}
            </div>

            <h2 className="text-lg font-bold text-white">{selectedList.title}</h2>
            <p className="text-xs text-zinc-400">
              RRPP predeterminado: <span className="text-zinc-200 font-medium">{selectedList.rrpp_name}</span> •{" "}
              <span className="font-mono text-cyan-400">/lista/{selectedList.slug}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleCopyPublicUrl(selectedList.slug)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors"
            >
              {copiedSlug === selectedList.slug ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Link Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Link Público</span>
                </>
              )}
            </button>

            <a
              href={`/lista/${selectedList.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-avora-border bg-avora-bg hover:bg-zinc-900 px-3 py-2 text-xs text-zinc-200 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Abrir</span>
            </a>

            <button
              type="button"
              onClick={() => openEditModal(selectedList)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-avora-border bg-avora-bg hover:bg-zinc-900 px-3 py-2 text-xs text-zinc-200 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Editar</span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleListOpen(selectedList)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-avora-border bg-avora-bg hover:bg-zinc-900 px-3 py-2 text-xs text-zinc-200 transition-colors"
            >
              <Power className="w-3.5 h-3.5" />
              <span>{selectedList.is_open && selectedList.status === "active" ? "Cerrar" : "Reabrir"}</span>
            </button>
          </div>
        </div>

        {/* Sheet Category Sub-Tabs (DAMA - FREE | HOMBRES - 100% CONSUMO | TODOS) */}
        <div className="rounded-2xl border border-avora-border bg-avora-surface p-4 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-avora-border bg-avora-bg p-1">
              <button
                type="button"
                onClick={() => {
                  setCategoryTab("dama_free");
                  setSheetBanner(null);
                }}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                  categoryTab === "dama_free"
                    ? "bg-violet-600 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <span>{selectedList.women_label}</span>
                <span className="font-mono text-[11px] opacity-85">
                  {tabStats.womenTotal}
                  {tabStats.womenPending > 0 ? ` (${tabStats.womenPending} pend.)` : ""}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCategoryTab("hombre_consumo");
                  setSheetBanner(null);
                }}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                  categoryTab === "hombre_consumo"
                    ? "bg-cyan-600 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <span>{selectedList.men_label}</span>
                <span className="font-mono text-[11px] opacity-85">
                  {tabStats.menTotal}
                  {tabStats.menPending > 0 ? ` (${tabStats.menPending} pend.)` : ""}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCategoryTab("all");
                  setSheetBanner(null);
                }}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                  categoryTab === "all"
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <span>Todos</span>
                <span className="font-mono text-[11px] opacity-85">{tabStats.allTotal}</span>
              </button>
            </div>

            {/* 1-Click Google Sheets Sync Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopyTsvForSheet(true)}
                disabled={pendingInCurrentTab.length === 0}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 px-3.5 py-2 text-xs font-semibold text-white transition-colors"
              >
                <ClipboardCopy className="w-3.5 h-3.5" />
                <span>Copiar pendientes para Sheet ({pendingInCurrentTab.length})</span>
              </button>

              {pendingInCurrentTab.length > 0 && (
                <button
                  type="button"
                  disabled={markingSynced}
                  onClick={handleMarkPendingAsSynced}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-300 transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{markingSynced ? "Marcando..." : "Marcar volcados"}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleCopyTsvForSheet(false)}
                disabled={visibleEntries.length === 0}
                className="inline-flex items-center gap-1.5 rounded-xl border border-avora-border bg-avora-bg hover:bg-zinc-900 disabled:opacity-40 px-3 py-2 text-xs font-medium text-zinc-200 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar todos</span>
              </button>

              <button
                type="button"
                onClick={handleExportListCsv}
                disabled={visibleEntries.length === 0}
                className="inline-flex items-center gap-1.5 rounded-xl border border-avora-border bg-avora-bg hover:bg-zinc-900 disabled:opacity-40 px-3 py-2 text-xs font-medium text-zinc-200 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
            </div>
          </div>

          {sheetBanner && (
            <div
              className={`rounded-xl border px-3.5 py-2.5 text-xs ${
                sheetBanner.ok
                  ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-200"
                  : "border-amber-500/40 bg-amber-950/30 text-amber-200"
              }`}
            >
              {sheetBanner.msg}
            </div>
          )}

          {/* Search inside list */}
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchEntries}
              onChange={(e) => setSearchEntries(e.target.value)}
              placeholder="Buscar por nombre, apellido, DNI o mail de Bombo..."
              className="w-full rounded-xl border border-avora-border bg-avora-bg pl-9 pr-3.5 py-2 text-xs text-white placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Entries Table */}
        <div className="rounded-2xl border border-avora-border bg-avora-surface overflow-hidden">
          {visibleEntries.length === 0 ? (
            <div className="py-12 text-center space-y-2 px-4">
              <p className="text-sm font-medium text-zinc-300">
                Todavía no hay invitados en esta pestaña
              </p>
              <p className="text-xs text-zinc-500">
                Compartí el enlace <span className="font-mono text-cyan-400">/lista/{selectedList.slug}</span> en
                el grupo de WhatsApp para que se anoten solos.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-avora-border text-[11px] uppercase tracking-wider text-zinc-400 bg-avora-bg/50">
                    <th className="py-3 px-4 font-medium">#</th>
                    <th className="py-3 px-4 font-medium">RRPP</th>
                    <th className="py-3 px-4 font-medium">Nombre y Apellido</th>
                    <th className="py-3 px-4 font-medium">DNI</th>
                    <th className="py-3 px-4 font-medium">Mail Bombo</th>
                    {categoryTab === "all" && <th className="py-3 px-4 font-medium">Categoría</th>}
                    <th className="py-3 px-4 font-medium">Estado Sheet</th>
                    <th className="py-3 px-4 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-avora-border/60 text-xs">
                  {visibleEntries.map((entry, idx) => {
                    const full = `${entry.first_name} ${entry.last_name}`;
                    const displayFull = presentationMode ? maskName(full) : full;
                    const displayDni = presentationMode
                      ? `••••${entry.dni.slice(-3)}`
                      : entry.dni;
                    const displayEmail = presentationMode
                      ? maskEmail(entry.bombo_email)
                      : entry.bombo_email;
                    return (
                      <tr key={entry.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4 font-mono text-zinc-500">{idx + 1}</td>
                        <td className="py-3 px-4 text-zinc-300">{entry.rrpp_name}</td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-white">{displayFull}</p>
                          <p className="text-[11px] text-zinc-500">
                            {formatArDateTimeShort(entry.created_at)}
                            {entry.city ? ` • ${entry.city}` : ""}
                          </p>
                        </td>
                        <td className="py-3 px-4 font-mono text-cyan-300">{displayDni}</td>
                        <td className="py-3 px-4 text-zinc-300">{displayEmail}</td>
                        {categoryTab === "all" && (
                          <td className="py-3 px-4">
                            <span
                              className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                                entry.category === "dama_free"
                                  ? "bg-violet-500/15 text-violet-200 border border-violet-500/30"
                                  : "bg-cyan-500/15 text-cyan-200 border border-cyan-500/30"
                              }`}
                            >
                              {entry.category === "dama_free"
                                ? selectedList.women_label
                                : selectedList.men_label}
                            </span>
                          </td>
                        )}
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => handleToggleSingleSynced(entry)}
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium border transition-colors ${
                              entry.synced_to_sheet
                                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                                : "bg-amber-500/15 border-amber-500/35 text-amber-300"
                            }`}
                          >
                            {entry.synced_to_sheet ? "Cargado en Sheet" : "Pendiente"}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {!presentationMode && entry.whatsapp_phone && (
                              <a
                                href={buildWaMeUrl(entry.whatsapp_phone)}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`WhatsApp ${maskPhone(entry.whatsapp_phone)}`}
                                className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 p-1.5 text-emerald-400"
                              >
                                <WhatsAppSvg className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteEntry(entry)}
                              title="Quitar de la lista"
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
      </div>
    );
  }

  // =========================================================================
  // RENDER: EVENTS DIRECTORY (ACTIVE VS PAST / CLOSED)
  // =========================================================================
  return (
    <div className="space-y-6">
      {/* Top Bar: Active vs Past Switcher + New List CTA */}
      <div className="rounded-2xl border border-avora-border bg-avora-surface p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-avora-border bg-avora-bg p-1">
          <button
            type="button"
            onClick={() => setDirectoryFilter("active")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
              directoryFilter === "active"
                ? "bg-emerald-600 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Eventos Activos</span>
            <span className="font-mono text-[11px] opacity-85">{activeListsCount}</span>
          </button>

          <button
            type="button"
            onClick={() => setDirectoryFilter("past")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
              directoryFilter === "past"
                ? "bg-zinc-700 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pasados / Cerrados</span>
            <span className="font-mono text-[11px] opacity-85">{pastListsCount}</span>
          </button>

          <button
            type="button"
            onClick={() => setDirectoryFilter("all")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
              directoryFilter === "all"
                ? "bg-violet-600 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <span>Todos</span>
            <span className="font-mono text-[11px] opacity-85">{listItems.length}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-violet-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Lista de Evento</span>
        </button>
      </div>

      {/* Events Grid */}
      {filteredLists.length === 0 ? (
        <div className="rounded-2xl border border-avora-border bg-avora-surface py-14 text-center space-y-2 px-4">
          <p className="text-sm font-medium text-zinc-300">
            {directoryFilter === "active"
              ? "No tenés eventos activos en curso"
              : "No hay eventos pasados o cerrados todavía"}
          </p>
          <p className="text-xs text-zinc-500">
            Creá una lista por cada fecha nueva para mantener todos los invitados organizados por evento.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredLists.map((list) => {
            const c = countsByList.get(list.id) || {
              womenTotal: 0,
              womenPending: 0,
              menTotal: 0,
              menPending: 0,
              total: 0,
              pending: 0,
            };
            const active = isEventActive(list);
            return (
              <div
                key={list.id}
                className="rounded-2xl border border-avora-border bg-avora-surface p-5 flex flex-col justify-between gap-4 hover:border-violet-500/40 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            active
                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                              : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                          }`}
                        >
                          {active ? "Abierta" : list.is_open ? "Fecha Pasada" : "Cerrada"}
                        </span>

                        {list.event_date && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-cyan-300">
                            <Calendar className="w-3 h-3" />
                            <span>{formatArDateOnly(list.event_date)}</span>
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-white">{list.title}</h3>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        RRPP: <span className="text-zinc-200">{list.rrpp_name}</span> •{" "}
                        <span className="font-mono text-cyan-400">/lista/{list.slug}</span>
                      </p>
                    </div>

                    {c.pending > 0 && (
                      <span className="rounded-full bg-amber-500/15 border border-amber-500/35 px-2.5 py-1 text-[11px] font-semibold text-amber-300 shrink-0">
                        {c.pending} para Sheet
                      </span>
                    )}
                  </div>

                  {/* Category counters */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-xl border border-avora-border bg-avora-bg/70 p-3">
                      <p className="text-[11px] text-zinc-400 truncate">{list.women_label}</p>
                      <p className="text-lg font-bold text-white mt-0.5">
                        {c.womenTotal}
                        {list.women_cap ? (
                          <span className="text-xs font-normal text-zinc-500"> / {list.women_cap}</span>
                        ) : null}
                      </p>
                      {c.womenPending > 0 && (
                        <p className="text-[10px] text-amber-300">{c.womenPending} sin volcar</p>
                      )}
                    </div>

                    <div className="rounded-xl border border-avora-border bg-avora-bg/70 p-3">
                      <p className="text-[11px] text-zinc-400 truncate">{list.men_label}</p>
                      <p className="text-lg font-bold text-white mt-0.5">
                        {c.menTotal}
                        {list.men_cap ? (
                          <span className="text-xs font-normal text-zinc-500"> / {list.men_cap}</span>
                        ) : null}
                      </p>
                      {c.menPending > 0 && (
                        <p className="text-[10px] text-amber-300">{c.menPending} sin volcar</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-avora-border/70">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedListId(list.id);
                      setCategoryTab("dama_free");
                      setSheetBanner(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Ver Invitados ({c.total})</span>
                  </button>

                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleCopyPublicUrl(list.slug)}
                      title="Copiar link público para WhatsApp"
                      className="inline-flex items-center gap-1 rounded-lg border border-avora-border bg-avora-bg hover:bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 transition-colors"
                    >
                      {copiedSlug === list.slug ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-cyan-400" />
                      )}
                      <span>{copiedSlug === list.slug ? "Copiado" : "Link"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditModal(list)}
                      title="Editar evento"
                      className="rounded-lg border border-avora-border bg-avora-bg hover:bg-zinc-800 p-1.5 text-zinc-300"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleListOpen(list)}
                      title={active ? "Cerrar / pasar a pasados" : "Reabrir evento"}
                      className="rounded-lg border border-avora-border bg-avora-bg hover:bg-zinc-800 p-1.5 text-zinc-300"
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteList(list)}
                      title="Eliminar lista"
                      className="rounded-lg border border-avora-border bg-avora-bg hover:border-red-500/40 hover:text-red-400 p-1.5 text-zinc-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Event List Modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border border-avora-border bg-avora-surface shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-avora-border px-5 py-4">
              <h3 className="text-base font-bold text-white">
                {editingList ? "Editar Lista de Evento" : "Nueva Lista de Evento"}
              </h3>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveList} className="p-5 overflow-y-auto space-y-4 text-xs">
              {formError && (
                <div className="rounded-xl border border-red-500/40 bg-red-950/30 p-3 text-red-200">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                    Nombre de la Fiesta / Evento
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Carlos Willengton"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-xl border border-avora-border bg-avora-bg px-3.5 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                    URL (/lista/...)
                  </label>
                  <input
                    type="text"
                    placeholder={slugifyText(title) || "carlos-willengton"}
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full rounded-xl border border-avora-border bg-avora-bg px-3.5 py-2.5 text-sm font-mono text-cyan-300 focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                    Fecha del Evento
                  </label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full rounded-xl border border-avora-border bg-avora-bg px-3.5 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                    Nombre en Columna RRPP (Para el Google Sheet)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Ian Fernández"
                    value={rrppName}
                    onChange={(e) => setRrppName(e.target.value)}
                    className="w-full rounded-xl border border-avora-border bg-avora-bg px-3.5 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                    Etiqueta Pestaña 1 (Mujeres)
                  </label>
                  <input
                    type="text"
                    value={womenLabel}
                    onChange={(e) => setWomenLabel(e.target.value)}
                    className="w-full rounded-xl border border-avora-border bg-avora-bg px-3 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                    Cupo Mujeres (Opcional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Sin límite"
                    value={womenCap}
                    onChange={(e) => setWomenCap(e.target.value)}
                    className="w-full rounded-xl border border-avora-border bg-avora-bg px-3 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                    Etiqueta Pestaña 2 (Hombres)
                  </label>
                  <input
                    type="text"
                    value={menLabel}
                    onChange={(e) => setMenLabel(e.target.value)}
                    className="w-full rounded-xl border border-avora-border bg-avora-bg px-3 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                    Cupo Hombres (Opcional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Sin límite"
                    value={menCap}
                    onChange={(e) => setMenCap(e.target.value)}
                    className="w-full rounded-xl border border-avora-border bg-avora-bg px-3 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                    Texto / Aclaración Pública (Horario límite, etc.)
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full rounded-xl border border-avora-border bg-avora-bg px-3 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={isOpen}
                  onChange={(e) => setIsOpen(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-violet-600"
                />
                <span className="text-zinc-200 font-medium">Lista abierta (recibiendo anotados)</span>
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
                  disabled={savingList}
                  className="rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-5 py-2 text-xs font-semibold text-white"
                >
                  {savingList ? "Guardando..." : editingList ? "Guardar Cambios" : "Crear Lista"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
