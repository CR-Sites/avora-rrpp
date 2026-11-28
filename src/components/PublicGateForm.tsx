"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Check, ShieldCheck, ArrowRight, Sparkles, Lock, AlertCircle } from "lucide-react";
import { SonicPulseSvg, WhatsAppSvg } from "./AvoraIcons";
import type { PublicFormConfig } from "@/types/avora";
import { AVORA_ANON_COOKIE, AVORA_COOKIE_MAX_AGE } from "@/lib/cookies";

interface Props {
  config: PublicFormConfig;
}

interface NavigatorConnection {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

function getOrCreateAnonCookie(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(?:^|; )${AVORA_ANON_COOKIE}=([^;]*)`));
  if (match && match[1]) return decodeURIComponent(match[1]);
  const generated =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  document.cookie = `${AVORA_ANON_COOKIE}=${encodeURIComponent(generated)}; path=/; max-age=${AVORA_COOKIE_MAX_AGE}; SameSite=Lax`;
  return generated;
}

function previewPhone(input: string): string {
  const raw = input.trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.length === 10 && (digits.startsWith("11") || digits.startsWith("2") || digits.startsWith("3"))) {
    return `+549${digits}`;
  }
  return `+${digits}`;
}

export default function PublicGateForm({ config }: Props) {
  const [fullName, setFullName] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [bomboEmail, setBomboEmail] = useState("");
  const [instagram, setInstagram] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>(() =>
    config.interests.map((i) => i.id)
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedUrl, setCompletedUrl] = useState<string | null>(null);
  const [registrationComplete, setRegistrationComplete] = useState(false);

  useEffect(() => {
    getOrCreateAnonCookie();
  }, []);

  const normalizedPreview = useMemo(() => previewPhone(whatsappPhone), [whatsappPhone]);

  const toggleInterest = (id: string) => {
    setSelectedInterests((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const allInterestIds = useMemo(() => config.interests.map((i) => i.id), [config.interests]);
  const allSelected =
    allInterestIds.length > 0 && allInterestIds.every((id) => selectedInterests.includes(id));

  const toggleAllInterests = () => {
    setSelectedInterests(allSelected ? [] : allInterestIds);
  };

  const toggleCategoryInterests = (catIds: string[]) => {
    const allCatSelected = catIds.every((id) => selectedInterests.includes(id));
    if (allCatSelected) {
      setSelectedInterests((prev) => prev.filter((id) => !catIds.includes(id)));
    } else {
      setSelectedInterests((prev) => Array.from(new Set([...prev, ...catIds])));
    }
  };

  const groupedInterests = useMemo(() => {
    const categoryNames: Record<string, string> = {
      musica: "Música",
      experiencia: "Experiencia",
      general: "General",
    };
    const groups = new Map<string, typeof config.interests>();
    for (const item of config.interests) {
      const cat = item.category || "general";
      const list = groups.get(cat) || [];
      list.push(item);
      groups.set(cat, list);
    }
    return Array.from(groups.entries()).map(([key, items]) => ({
      key,
      label: categoryNames[key] || key,
      items,
      ids: items.map((i) => i.id),
    }));
  }, [config.interests]);

  const hasValidInviteDestination = (url: string | null): boolean => {
    if (!url) return false;
    const trimmed = url.trim();
    if (!trimmed.startsWith("http")) return false;
    if (trimmed === "https://chat.whatsapp.com/" || trimmed === "https://chat.whatsapp.com") {
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const nav = navigator as Navigator & {
        connection?: NavigatorConnection;
        deviceMemory?: number;
      };
      const params = new URLSearchParams(window.location.search);
      const anonId = getOrCreateAnonCookie();
      const storedVid = window.localStorage.getItem("avora_vid") || undefined;

      const payload = {
        full_name: fullName,
        whatsapp_phone: whatsappPhone,
        bombo_email: bomboEmail,
        instagram_handle: instagram,
        interest_ids: selectedInterests,
        anon_visitor_id: anonId,
        visitor_token: storedVid,
        telemetry: {
          screen_resolution: `${window.screen.width}x${window.screen.height}`,
          viewport_size: `${window.innerWidth}x${window.innerHeight}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: navigator.language,
          connection_type: nav.connection?.effectiveType || undefined,
          platform: navigator.platform || undefined,
          referrer: document.referrer || undefined,
          utm_source: params.get("utm_source") || undefined,
          utm_medium: params.get("utm_medium") || undefined,
          utm_campaign: params.get("utm_campaign") || undefined,
          extra: {
            languages: navigator.languages,
            hardware_concurrency: navigator.hardwareConcurrency,
            device_memory: nav.deviceMemory,
            max_touch_points: navigator.maxTouchPoints,
            pixel_ratio: window.devicePixelRatio,
            color_depth: window.screen.colorDepth,
            downlink_mbps: nav.connection?.downlink,
            rtt_ms: nav.connection?.rtt,
            entry_url: window.location.href,
            client_timestamp: new Date().toISOString(),
          },
        },
      };

      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "No pudimos procesar tu registro. Revisá los datos.");
      }

      if (data.visitor_token) {
        try {
          window.localStorage.setItem("avora_vid", data.visitor_token);
        } catch {
          // Ignore storage quota / private mode issues
        }
      }

      setCompletedUrl(data.whatsapp_invite_url || null);
      setRegistrationComplete(true);

      if (hasValidInviteDestination(data.whatsapp_invite_url)) {
        setTimeout(() => {
          window.location.href = data.whatsapp_invite_url;
        }, 950);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado al registrar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="avora-mesh min-h-screen flex flex-col justify-between px-4 py-6 sm:py-10">
      <div className="w-full max-w-md mx-auto my-auto">
        {/* Top Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          {config.brand_name && config.brand_name.trim().length > 0 && (
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-violet-500/30 bg-violet-950/25 mb-4">
              <SonicPulseSvg className="w-5 h-5 text-violet-400" />
              <span className="text-xs font-semibold tracking-[0.22em] uppercase text-violet-200">
                {config.brand_name}
              </span>
            </div>
          )}

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
            {config.form_title}
          </h1>
          {config.form_subtitle && (
            <p className="mt-2 text-sm text-zinc-400 leading-relaxed max-w-sm">
              {config.form_subtitle}
            </p>
          )}
        </div>

        {/* Gate Card */}
        <div className="rounded-2xl border border-avora-border bg-avora-surface/90 backdrop-blur-xl shadow-2xl shadow-black/60 p-5 sm:p-6">
          {!config.is_registration_open ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
                <Lock className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-semibold text-white">Admisión Temporalmente Cerrada</h2>
              <p className="text-sm text-zinc-400">
                El cupo actual de ingreso al grupo exclusivo se encuentra completo. Volvé a consultar
                próximamente.
              </p>
            </div>
          ) : registrationComplete ? (
            <div className="py-6 text-center space-y-5">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-xl font-bold text-white">Acceso Habilitado</h2>
                <p className="text-sm text-zinc-400">
                  {hasValidInviteDestination(completedUrl)
                    ? "Tus datos quedaron verificados. Redirigiendo automáticamente al grupo exclusivo de WhatsApp..."
                    : "Tus datos y tu usuario de Bombo quedaron registrados en la lista oficial."}
                </p>
              </div>

              {hasValidInviteDestination(completedUrl) && (
                <a
                  href={completedUrl!}
                  className="w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold py-3.5 px-5 text-sm transition-all shadow-lg shadow-emerald-500/20"
                >
                  <WhatsAppSvg className="w-5 h-5" />
                  <span>Unirme al Grupo de WhatsApp</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-500/40 bg-red-950/30 px-3.5 py-3 text-xs text-red-200">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Full Name */}
              <div>
                <label
                  htmlFor="fullName"
                  className="block text-xs font-medium uppercase tracking-wider text-zinc-300 mb-1.5"
                >
                  Nombre y Apellido
                </label>
                <input
                  id="fullName"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Ej: Valentín Morales"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-avora-border bg-avora-bg/90 px-3.5 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-colors"
                />
              </div>

              {/* WhatsApp Phone */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="whatsappPhone"
                    className="block text-xs font-medium uppercase tracking-wider text-zinc-300"
                  >
                    Teléfono de WhatsApp
                  </label>
                  {normalizedPreview && (
                    <span className="text-[11px] font-mono text-cyan-400">{normalizedPreview}</span>
                  )}
                </div>
                <input
                  id="whatsappPhone"
                  type="tel"
                  inputMode="tel"
                  required
                  autoComplete="tel"
                  placeholder="Ej: 11 2345 6789"
                  value={whatsappPhone}
                  onChange={(e) => setWhatsappPhone(e.target.value)}
                  className="w-full rounded-xl border border-avora-border bg-avora-bg/90 px-3.5 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-colors"
                />
              </div>

              {/* Bombo Email */}
              <div>
                <label
                  htmlFor="bomboEmail"
                  className="block text-xs font-medium uppercase tracking-wider text-zinc-300 mb-1.5"
                >
                  Mail de Bombo {config.require_bombo_email ? "" : "(Opcional)"}
                </label>
                <input
                  id="bomboEmail"
                  type="email"
                  inputMode="email"
                  required={config.require_bombo_email}
                  autoComplete="email"
                  placeholder="tuemail@ejemplo.com"
                  value={bomboEmail}
                  onChange={(e) => setBomboEmail(e.target.value)}
                  className="w-full rounded-xl border border-avora-border bg-avora-bg/90 px-3.5 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-colors"
                />
                <p className="mt-1.5 text-[11px] text-zinc-500 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                  <span>Usá el mismo correo registrado en tu cuenta de Bombo.</span>
                </p>
              </div>

              {/* Instagram Handle */}
              <div>
                <label
                  htmlFor="instagramHandle"
                  className="block text-xs font-medium uppercase tracking-wider text-zinc-300 mb-1.5"
                >
                  Cuenta de Instagram (Opcional)
                </label>
                <input
                  id="instagramHandle"
                  type="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="Ej: @tuusuario"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  className="w-full rounded-xl border border-avora-border bg-avora-bg/90 px-3.5 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-colors"
                />
              </div>

              {/* Configurable Interests Checkboxes */}
              {config.interests.length > 0 && (
                <div className="pt-1 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-xs font-medium uppercase tracking-wider text-zinc-300">
                      Tus Intereses ({selectedInterests.length}/{config.interests.length})
                    </label>
                    <button
                      type="button"
                      onClick={toggleAllInterests}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-avora-border bg-avora-bg/80 hover:border-violet-500/50 px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:text-white transition-colors"
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-colors ${
                          allSelected
                            ? "border-violet-400 bg-violet-500 text-white"
                            : "border-zinc-600 bg-zinc-900 text-transparent"
                        }`}
                      >
                        <Check className="w-2.5 h-2.5" strokeWidth={3} />
                      </span>
                      <span>{allSelected ? "Quitar todos" : "Marcar todos"}</span>
                    </button>
                  </div>

                  {groupedInterests.length > 1 ? (
                    <div className="space-y-3">
                      {groupedInterests.map((group) => {
                        const allCatSelected = group.ids.every((id) =>
                          selectedInterests.includes(id)
                        );
                        return (
                          <div key={group.key} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                                {group.label}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleCategoryInterests(group.ids)}
                                className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-violet-300 transition-colors"
                              >
                                <span
                                  className={`w-3 h-3 rounded-[3px] flex items-center justify-center border transition-colors ${
                                    allCatSelected
                                      ? "border-violet-400 bg-violet-500 text-white"
                                      : "border-zinc-700 bg-zinc-900 text-transparent"
                                  }`}
                                >
                                  <Check className="w-2 h-2" strokeWidth={3} />
                                </span>
                                <span>{allCatSelected ? "Quitar" : "Todos"}</span>
                              </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {group.items.map((interest) => {
                                const active = selectedInterests.includes(interest.id);
                                return (
                                  <button
                                    key={interest.id}
                                    type="button"
                                    onClick={() => toggleInterest(interest.id)}
                                    className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-all ${
                                      active
                                        ? "border-violet-500 bg-violet-500/15 text-white shadow-sm shadow-violet-500/10"
                                        : "border-avora-border bg-avora-bg/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                                    }`}
                                  >
                                    <span className="truncate">{interest.label}</span>
                                    <span
                                      className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 border transition-colors ${
                                        active
                                          ? "border-violet-400 bg-violet-500 text-white"
                                          : "border-zinc-700 bg-zinc-900/80 text-transparent"
                                      }`}
                                    >
                                      <Check className="w-3 h-3" strokeWidth={3} />
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {config.interests.map((interest) => {
                        const active = selectedInterests.includes(interest.id);
                        return (
                          <button
                            key={interest.id}
                            type="button"
                            onClick={() => toggleInterest(interest.id)}
                            className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-all ${
                              active
                                ? "border-violet-500 bg-violet-500/15 text-white shadow-sm shadow-violet-500/10"
                                : "border-avora-border bg-avora-bg/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                            }`}
                          >
                            <span className="truncate">{interest.label}</span>
                            <span
                              className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 border transition-colors ${
                                active
                                  ? "border-violet-400 bg-violet-500 text-white"
                                  : "border-zinc-700 bg-zinc-900/80 text-transparent"
                              }`}
                            >
                              <Check className="w-3 h-3" strokeWidth={3} />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 disabled:opacity-60 text-white font-semibold py-3.5 px-5 text-sm transition-all shadow-lg shadow-violet-600/25"
              >
                <WhatsAppSvg className="w-4 h-4" />
                <span>{submitting ? "Verificando acceso..." : config.welcome_button_label}</span>
                {!submitting && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
