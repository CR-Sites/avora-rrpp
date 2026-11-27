"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Save,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Check,
  Pencil,
  X,
  Shield,
  Sliders,
  ListChecks,
  AlertTriangle,
} from "lucide-react";
import type { AdminAvora, InterestOption, SettingsAvora } from "@/types/avora";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface Props {
  settings: SettingsAvora;
  interests: InterestOption[];
  admins: AdminAvora[];
  onRefresh: () => void;
}

export default function SettingsPanel({ settings, interests, admins, onRefresh }: Props) {
  // Gate & WhatsApp Settings state
  const [brandName, setBrandName] = useState(settings.brand_name);
  const [formTitle, setFormTitle] = useState(settings.form_title);
  const [formSubtitle, setFormSubtitle] = useState(settings.form_subtitle);
  const [whatsappUrl, setWhatsappUrl] = useState(settings.whatsapp_invite_url);
  const [welcomeBtn, setWelcomeBtn] = useState(settings.welcome_button_label);
  const [isOpen, setIsOpen] = useState(settings.is_registration_open);
  const [requireBombo, setRequireBombo] = useState(settings.require_bombo_email);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Reactive Interests CRUD state
  const [interestList, setInterestList] = useState<InterestOption[]>(interests);
  const [newInterestLabel, setNewInterestLabel] = useState("");
  const [newInterestCat, setNewInterestCat] = useState("musica");
  const [addingInterest, setAddingInterest] = useState(false);
  const [interestFeedback, setInterestFeedback] = useState<{ ok: boolean; msg: string } | null>(
    null
  );
  const newInterestInputRef = useRef<HTMLInputElement>(null);

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editCategory, setEditCategory] = useState("musica");
  const [savingEdit, setSavingEdit] = useState(false);

  // Bulk & row busy state
  const [bulkUpdating, setBulkUpdating] = useState(false);

  // Operator / Staff Provisioning state
  const [opEmail, setOpEmail] = useState("");
  const [opPassword, setOpPassword] = useState("");
  const [opRole, setOpRole] = useState("operator");
  const [savingOp, setSavingOp] = useState(false);
  const [opFeedback, setOpFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    setInterestList(interests);
  }, [interests]);

  const isPlaceholderWa =
    !whatsappUrl.trim() ||
    whatsappUrl.trim() === "https://chat.whatsapp.com/" ||
    whatsappUrl.includes("ejemplo");

  const refreshInterestsFromDb = async () => {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("interests_avora")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (!error && data) {
      setInterestList(data as InterestOption[]);
    }
    onRefresh();
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSaved(false);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("settings_avora")
        .update({
          brand_name: brandName.trim(),
          form_title: formTitle.trim(),
          form_subtitle: formSubtitle.trim(),
          whatsapp_invite_url: whatsappUrl.trim(),
          welcome_button_label: welcomeBtn.trim() || "Solicitar Acceso al Grupo",
          is_registration_open: isOpen,
          require_bombo_email: requireBombo,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);

      if (!error) {
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 2200);
        onRefresh();
      }
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAddInterest = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newInterestLabel.trim();
    if (!trimmed) {
      setInterestFeedback({
        ok: false,
        msg: "Escribí el nombre de la opción arriba antes de tocar Agregar.",
      });
      newInterestInputRef.current?.focus();
      return;
    }

    setInterestFeedback(null);
    setAddingInterest(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const nextOrder =
        interestList.length > 0 ? Math.max(...interestList.map((i) => i.sort_order)) + 1 : 1;
      const { error } = await supabase.from("interests_avora").insert({
        label: trimmed,
        category: newInterestCat,
        is_active: true,
        sort_order: nextOrder,
      });

      if (error) {
        throw new Error(error.message || "No se pudo agregar la opción.");
      }

      setNewInterestLabel("");
      setInterestFeedback({ ok: true, msg: `Opción "${trimmed}" agregada al formulario.` });
      await refreshInterestsFromDb();
    } catch (err) {
      setInterestFeedback({
        ok: false,
        msg: err instanceof Error ? err.message : "Error al agregar la opción.",
      });
    } finally {
      setAddingInterest(false);
    }
  };

  const startEditInterest = (item: InterestOption) => {
    setInterestFeedback(null);
    setEditingId(item.id);
    setEditLabel(item.label);
    setEditCategory(item.category || "musica");
  };

  const cancelEditInterest = () => {
    setEditingId(null);
    setEditLabel("");
  };

  const handleSaveEditInterest = async (itemId: string) => {
    const trimmed = editLabel.trim();
    if (!trimmed) {
      setInterestFeedback({ ok: false, msg: "El nombre de la opción no puede quedar vacío." });
      return;
    }
    setSavingEdit(true);
    setInterestFeedback(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("interests_avora")
        .update({
          label: trimmed,
          category: editCategory,
        })
        .eq("id", itemId);

      if (error) {
        throw new Error(error.message || "No se pudo guardar la edición.");
      }

      setEditingId(null);
      setInterestFeedback({ ok: true, msg: `Opción actualizada a "${trimmed}".` });
      await refreshInterestsFromDb();
    } catch (err) {
      setInterestFeedback({
        ok: false,
        msg: err instanceof Error ? err.message : "Error al editar la opción.",
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleInterest = async (item: InterestOption) => {
    setInterestFeedback(null);
    const nextActive = item.is_active === false;
    setInterestList((prev) =>
      prev.map((row) => (row.id === item.id ? { ...row, is_active: nextActive } : row))
    );
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("interests_avora")
      .update({ is_active: nextActive })
      .eq("id", item.id);

    if (error) {
      setInterestFeedback({ ok: false, msg: error.message || "Error al cambiar estado." });
      await refreshInterestsFromDb();
      return;
    }
    await refreshInterestsFromDb();
  };

  const allInterestsActive =
    interestList.length > 0 && interestList.every((item) => item.is_active !== false);

  const handleToggleAllInterests = async () => {
    if (interestList.length === 0) return;
    const nextActive = !allInterestsActive;
    setBulkUpdating(true);
    setInterestFeedback(null);
    setInterestList((prev) => prev.map((row) => ({ ...row, is_active: nextActive })));
    try {
      const supabase = createSupabaseBrowserClient();
      const ids = interestList.map((i) => i.id);
      const { error } = await supabase
        .from("interests_avora")
        .update({ is_active: nextActive })
        .in("id", ids);

      if (error) throw new Error(error.message || "Error al actualizar todos.");
      setInterestFeedback({
        ok: true,
        msg: nextActive
          ? "Todas las opciones quedaron habilitadas."
          : "Todas las opciones quedaron deshabilitadas.",
      });
      await refreshInterestsFromDb();
    } catch (err) {
      setInterestFeedback({
        ok: false,
        msg: err instanceof Error ? err.message : "Error al actualizar en lote.",
      });
      await refreshInterestsFromDb();
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleMoveInterest = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= interestList.length) return;
    setInterestFeedback(null);

    const reordered = [...interestList];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    const normalized = reordered.map((item, idx) => ({ ...item, sort_order: idx + 1 }));
    setInterestList(normalized);

    const supabase = createSupabaseBrowserClient();
    const results = await Promise.all(
      normalized.map((item) =>
        supabase.from("interests_avora").update({ sort_order: item.sort_order }).eq("id", item.id)
      )
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      setInterestFeedback({ ok: false, msg: failed.error.message || "Error al reordenar." });
    }
    await refreshInterestsFromDb();
  };

  const handleDeleteInterest = async (item: InterestOption) => {
    if (!window.confirm(`¿Eliminar la opción "${item.label}" del formulario?`)) return;
    setInterestFeedback(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("interests_avora").delete().eq("id", item.id);
    if (error) {
      setInterestFeedback({ ok: false, msg: error.message || "No se pudo eliminar la opción." });
      return;
    }
    setInterestFeedback({ ok: true, msg: `Opción "${item.label}" eliminada.` });
    await refreshInterestsFromDb();
  };

  const handleSaveOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    setOpFeedback(null);
    setSavingOp(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.rpc("upsert_operator_avora", {
        p_email: opEmail.trim(),
        p_password: opPassword,
        p_role: opRole,
      });
      if (error) throw error;
      setOpFeedback({
        ok: true,
        msg: `Acceso habilitado para ${opEmail.trim()}. Ya puede iniciar sesión en /admin.`,
      });
      setOpEmail("");
      setOpPassword("");
      onRefresh();
    } catch (err) {
      setOpFeedback({
        ok: false,
        msg: err instanceof Error ? err.message : "No se pudo actualizar el operador.",
      });
    } finally {
      setSavingOp(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column: Gate & WhatsApp Invite Configuration */}
      <div className="rounded-2xl border border-avora-border bg-avora-surface p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-avora-border pb-3.5">
          <Sliders className="w-4 h-4 text-violet-400" />
          <div>
            <h3 className="text-sm font-bold text-white">Grupo Exclusivo y Formulario</h3>
            <p className="text-[11px] text-zinc-400">
              Configurá el link real de invitación a WhatsApp y los textos públicos
            </p>
          </div>
        </div>

        {isPlaceholderWa && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-950/25 p-3 text-xs text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              Pegá abajo el link real de invitación al grupo (`https://chat.whatsapp.com/...`) para
              que los registrados salten directo al grupo al completar el formulario.
            </span>
          </div>
        )}

        <form onSubmit={handleSaveSettings} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
              Link de Invitación al Grupo de WhatsApp
            </label>
            <input
              type="url"
              required
              placeholder="https://chat.whatsapp.com/TuCodigoDeGrupo"
              value={whatsappUrl}
              onChange={(e) => setWhatsappUrl(e.target.value)}
              className="w-full rounded-xl border border-avora-border bg-avora-bg px-3.5 py-2.5 text-sm font-mono text-emerald-300 focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                Nombre Marca / Productora
              </label>
              <input
                type="text"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                className="w-full rounded-xl border border-avora-border bg-avora-bg px-3.5 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                Texto del Botón Principal
              </label>
              <input
                type="text"
                value={welcomeBtn}
                onChange={(e) => setWelcomeBtn(e.target.value)}
                className="w-full rounded-xl border border-avora-border bg-avora-bg px-3.5 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
              Título del Formulario
            </label>
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="w-full rounded-xl border border-avora-border bg-avora-bg px-3.5 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
              Subtítulo / Bajada
            </label>
            <textarea
              rows={2}
              value={formSubtitle}
              onChange={(e) => setFormSubtitle(e.target.value)}
              className="w-full rounded-xl border border-avora-border bg-avora-bg px-3.5 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isOpen}
                onChange={(e) => setIsOpen(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-900 text-violet-600"
              />
              <span className="text-zinc-200">Permitir nuevos ingresos al grupo</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={requireBombo}
                onChange={(e) => setRequireBombo(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-900 text-violet-600"
              />
              <span className="text-zinc-200">Exigir Mail de Bombo obligatorio</span>
            </label>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={savingSettings}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-4 py-2.5 text-xs font-semibold text-white transition-colors"
            >
              {settingsSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              <span>
                {savingSettings
                  ? "Guardando..."
                  : settingsSaved
                  ? "Configuración Guardada"
                  : "Guardar Configuración"}
              </span>
            </button>
          </div>
        </form>
      </div>

      {/* Right Column: Dynamic Interests Checkboxes + Staff Access */}
      <div className="space-y-6">
        {/* Dynamic Checkboxes Manager */}
        <div className="rounded-2xl border border-avora-border bg-avora-surface p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-avora-border pb-3.5">
            <div className="flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-cyan-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Checkboxes de Intereses</h3>
                <p className="text-[11px] text-zinc-400">
                  Agregá, editá, ordená o habilitá las opciones del formulario público
                </p>
              </div>
            </div>

            {interestList.length > 0 && (
              <button
                type="button"
                disabled={bulkUpdating}
                onClick={handleToggleAllInterests}
                className="inline-flex items-center gap-1.5 rounded-lg border border-avora-border bg-avora-bg hover:border-cyan-500/50 px-2.5 py-1.5 text-[11px] font-medium text-zinc-200 transition-colors shrink-0"
              >
                <span
                  className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                    allInterestsActive
                      ? "border-violet-400 bg-violet-500 text-white"
                      : "border-zinc-600 bg-zinc-900 text-transparent"
                  }`}
                >
                  <Check className="w-2.5 h-2.5" strokeWidth={3} />
                </span>
                <span>{allInterestsActive ? "Desactivar todos" : "Activar todos"}</span>
              </button>
            )}
          </div>

          {interestFeedback && (
            <div
              className={`rounded-xl border px-3 py-2 text-xs ${
                interestFeedback.ok
                  ? "border-emerald-500/40 bg-emerald-950/25 text-emerald-200"
                  : "border-red-500/40 bg-red-950/25 text-red-200"
              }`}
            >
              {interestFeedback.msg}
            </div>
          )}

          <form onSubmit={handleAddInterest} className="space-y-1.5">
            <label
              htmlFor="newInterestInput"
              className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-300"
            >
              Nueva opción de interés
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                ref={newInterestInputRef}
                id="newInterestInput"
                type="text"
                placeholder="Ej: Progressive / Mesas VIP / Afters..."
                value={newInterestLabel}
                onChange={(e) => setNewInterestLabel(e.target.value)}
                className="flex-1 rounded-xl border border-avora-border bg-avora-bg px-3.5 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
              />
              <select
                value={newInterestCat}
                onChange={(e) => setNewInterestCat(e.target.value)}
                className="rounded-xl border border-avora-border bg-avora-bg px-3 py-2 text-xs text-zinc-200"
              >
                <option value="musica">Música</option>
                <option value="experiencia">Experiencia</option>
                <option value="general">General</option>
              </select>
              <button
                type="submit"
                disabled={addingInterest}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 px-3.5 py-2 text-xs font-semibold text-white transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{addingInterest ? "Agregando..." : "Agregar"}</span>
              </button>
            </div>
          </form>

          <div className="divide-y divide-avora-border/60 max-h-72 overflow-y-auto">
            {interestList.length === 0 ? (
              <p className="py-6 text-center text-xs text-zinc-500">
                No hay opciones creadas. Agregá la primera arriba.
              </p>
            ) : (
              interestList.map((item, idx) => {
                const isEditing = editingId === item.id;
                return (
                  <div key={item.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                    {isEditing ? (
                      <div className="flex flex-1 flex-wrap sm:flex-nowrap items-center gap-2">
                        <input
                          type="text"
                          autoFocus
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleSaveEditInterest(item.id);
                            } else if (e.key === "Escape") {
                              cancelEditInterest();
                            }
                          }}
                          className="flex-1 min-w-[140px] rounded-lg border border-violet-500 bg-avora-bg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                        />
                        <select
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          className="rounded-lg border border-avora-border bg-avora-bg px-2 py-1.5 text-xs text-zinc-200"
                        >
                          <option value="musica">Música</option>
                          <option value="experiencia">Experiencia</option>
                          <option value="general">General</option>
                        </select>
                        <div className="inline-flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={savingEdit}
                            onClick={() => handleSaveEditInterest(item.id)}
                            title="Guardar cambios"
                            className="rounded-lg bg-emerald-600 hover:bg-emerald-500 p-1.5 text-white"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditInterest}
                            title="Cancelar"
                            className="rounded-lg border border-avora-border bg-avora-bg hover:bg-zinc-800 p-1.5 text-zinc-400"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={item.is_active !== false}
                            onChange={() => handleToggleInterest(item)}
                            className="rounded border-zinc-700 bg-zinc-900 text-violet-600 cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => startEditInterest(item)}
                            title="Clic para editar nombre o categoría"
                            className={`truncate text-left hover:text-violet-300 transition-colors ${
                              item.is_active !== false
                                ? "text-zinc-100 font-medium"
                                : "text-zinc-500 line-through"
                            }`}
                          >
                            {item.label}
                          </button>
                          <span className="text-[10px] uppercase tracking-wider text-zinc-500 px-1.5 py-0.5 rounded bg-avora-bg border border-avora-border shrink-0">
                            {item.category}
                          </span>
                        </div>

                        <div className="inline-flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => startEditInterest(item)}
                            title="Editar opción"
                            className="rounded p-1 text-zinc-400 hover:text-violet-300 hover:bg-zinc-800"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveInterest(idx, -1)}
                            title="Subir"
                            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 disabled:opacity-25"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === interestList.length - 1}
                            onClick={() => handleMoveInterest(idx, 1)}
                            title="Bajar"
                            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 disabled:opacity-25"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteInterest(item)}
                            title="Eliminar"
                            className="rounded p-1 text-zinc-500 hover:text-red-400 hover:bg-zinc-800"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Staff / Jefe de Públicas Account Manager */}
        <div className="rounded-2xl border border-avora-border bg-avora-surface p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-avora-border pb-3.5">
            <Shield className="w-4 h-4 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Acceso Jefe de Públicas / Staff</h3>
              <p className="text-[11px] text-zinc-400">
                Creá o actualizá la contraseña del usuario administrador del panel
              </p>
            </div>
          </div>

          {opFeedback && (
            <div
              className={`rounded-xl border p-3 text-xs ${
                opFeedback.ok
                  ? "border-emerald-500/40 bg-emerald-950/25 text-emerald-200"
                  : "border-red-500/40 bg-red-950/25 text-red-200"
              }`}
            >
              {opFeedback.msg}
            </div>
          )}

          <form onSubmit={handleSaveOperator} className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <input
              type="email"
              required
              placeholder="jefe@productora.com"
              value={opEmail}
              onChange={(e) => setOpEmail(e.target.value)}
              className="rounded-xl border border-avora-border bg-avora-bg px-3 py-2 text-white focus:border-violet-500 focus:outline-none"
            />
            <input
              type="password"
              required
              minLength={8}
              placeholder="Contraseña (mín 8)"
              value={opPassword}
              onChange={(e) => setOpPassword(e.target.value)}
              className="rounded-xl border border-avora-border bg-avora-bg px-3 py-2 text-white focus:border-violet-500 focus:outline-none"
            />
            <div className="flex gap-2">
              <select
                value={opRole}
                onChange={(e) => setOpRole(e.target.value)}
                className="rounded-xl border border-avora-border bg-avora-bg px-2.5 py-2 text-zinc-200"
              >
                <option value="operator">Operador</option>
                <option value="owner">Admin</option>
              </select>
              <button
                type="submit"
                disabled={savingOp}
                className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-3 py-2 font-semibold text-white"
              >
                {savingOp ? "..." : "Habilitar"}
              </button>
            </div>
          </form>

          <div className="space-y-1.5 pt-1">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
              Usuarios con Acceso ({admins.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {admins.map((a) => (
                <span
                  key={a.user_id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-avora-border bg-avora-bg px-2.5 py-1 text-[11px] text-zinc-300"
                >
                  <span>{a.email}</span>
                  <span className="text-[10px] uppercase text-violet-400">{a.role}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
