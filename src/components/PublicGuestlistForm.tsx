"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Lock,
  Sparkles,
  UserCheck,
} from "lucide-react";
import type { GuestlistCategory, PublicGuestlistConfig } from "@/types/avora";
import { formatArDateOnly } from "@/lib/datetime";
import { SonicPulseSvg, WhatsAppSvg } from "./AvoraIcons";

interface Props {
  config: PublicGuestlistConfig;
  rrppOverride?: string;
}

function splitFullName(fullName: string | undefined | null): { first: string; last: string } {
  const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export default function PublicGuestlistForm({ config, rrppOverride }: Props) {
  const prefilled = useMemo(() => splitFullName(config.prefill?.full_name), [config.prefill]);

  const womenFull = config.women_cap !== null && config.women_count >= config.women_cap;
  const menFull = config.men_cap !== null && config.men_count >= config.men_cap;

  const [category, setCategory] = useState<GuestlistCategory>(
    womenFull && !menFull ? "hombre_consumo" : "dama_free"
  );
  const [firstName, setFirstName] = useState(prefilled.first);
  const [lastName, setLastName] = useState(prefilled.last);
  const [dni, setDni] = useState("");
  const [bomboEmail, setBomboEmail] = useState(config.prefill?.bombo_email || "");
  const [instagram, setInstagram] = useState(config.prefill?.instagram_handle || "");
  const [whatsappPhone, setWhatsappPhone] = useState(config.prefill?.whatsapp_phone || "");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    alreadyRegistered: boolean;
    categoryLabel: string;
    rrppName: string;
    dniClean: string;
    fullName: string;
    instagramHandle: string;
  } | null>(null);

  const cleanDniPreview = useMemo(() => dni.replace(/\D/g, ""), [dni]);
  const cleanIgPreview = useMemo(() => {
    const clean = instagram
      .trim()
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
      .split(/[?#]/)[0]
      .replace(/\/+$/, "")
      .replace(/^@+/, "")
      .replace(/\s+/g, "");
    return clean ? `@${clean.toLowerCase()}` : "";
  }, [instagram]);

  const womenRemaining =
    config.women_cap !== null ? Math.max(0, config.women_cap - config.women_count) : null;
  const menRemaining =
    config.men_cap !== null ? Math.max(0, config.men_cap - config.men_count) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      let storedVid: string | undefined;
      try {
        storedVid = window.localStorage.getItem("avora_vid") || undefined;
      } catch {
        storedVid = undefined;
      }

      const res = await fetch("/api/guestlist/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: config.slug,
          category,
          first_name: firstName,
          last_name: lastName,
          dni,
          bombo_email: bomboEmail,
          instagram_handle: instagram,
          whatsapp_phone: whatsappPhone,
          rrpp_override: rrppOverride || undefined,
          visitor_token: storedVid,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "No pudimos confirmar tu lugar en la lista.");
      }

      setConfirmation({
        alreadyRegistered: Boolean(data.already_registered),
        categoryLabel: category === "dama_free" ? config.women_label : config.men_label,
        rrppName: data.rrpp_name || rrppOverride || config.rrpp_name,
        dniClean: cleanDniPreview,
        fullName: `${firstName.trim()} ${lastName.trim()}`,
        instagramHandle: cleanIgPreview,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado al enviar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="avora-mesh min-h-screen flex flex-col justify-center px-4 py-8">
      <div className="w-full max-w-md mx-auto">
        {/* Top Event Header */}
        <div className="flex flex-col items-center text-center mb-6">
          {config.brand_name && config.brand_name.trim().length > 0 && (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-violet-500/30 bg-violet-950/25 mb-3">
              <SonicPulseSvg className="w-4 h-4 text-violet-400" />
              <span className="text-xs font-semibold tracking-[0.2em] uppercase text-violet-200">
                {rrppOverride || config.brand_name}
              </span>
            </div>
          )}

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
            {config.title}
          </h1>

          {config.event_date && (
            <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-mono text-cyan-300 bg-cyan-950/30 border border-cyan-500/30 rounded-full px-3 py-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatArDateOnly(config.event_date)}</span>
            </div>
          )}

          {config.description && (
            <p className="mt-2.5 text-sm text-zinc-400 leading-relaxed max-w-sm">
              {config.description}
            </p>
          )}
        </div>

        {/* Form Card */}
        <div className="rounded-2xl border border-avora-border bg-avora-surface/90 backdrop-blur-xl shadow-2xl shadow-black/60 p-5 sm:p-6">
          {!config.is_open ? (
            <div className="py-7 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
                <Lock className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-lg font-semibold text-white">Lista Cerrada</h2>
                <p className="text-sm text-zinc-400">
                  El cierre de lista para este evento ya finalizó o se completó el cupo.
                </p>
              </div>
              <Link
                href="/unirse"
                className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold py-3 px-4 text-sm transition-colors"
              >
                <WhatsAppSvg className="w-4 h-4" />
                <span>Unirme al Grupo para Próximas Fechas</span>
              </Link>
            </div>
          ) : confirmation ? (
            <div className="py-5 text-center space-y-5">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-xl font-bold text-white">
                  {confirmation.alreadyRegistered ? "Datos Actualizados en Lista" : "Confirmado en Lista"}
                </h2>
                <p className="text-sm text-zinc-400">
                  Tus datos quedaron registrados para pasar por lista en puerta.
                </p>
              </div>

              <div className="rounded-xl border border-avora-border bg-avora-bg/80 p-4 text-left space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Invitado</span>
                  <span className="font-semibold text-white">{confirmation.fullName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">DNI</span>
                  <span className="font-mono text-cyan-300">{confirmation.dniClean}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Instagram</span>
                  <span className="font-mono text-violet-300">{confirmation.instagramHandle}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Lista</span>
                  <span className="font-semibold text-emerald-300">{confirmation.categoryLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">RRPP</span>
                  <span className="text-zinc-200">{confirmation.rrppName}</span>
                </div>
              </div>

              {!config.prefill && (
                <Link
                  href="/unirse"
                  className="inline-flex items-center justify-center gap-2 w-full rounded-xl border border-avora-border bg-avora-bg hover:border-violet-500/50 text-zinc-200 font-medium py-3 px-4 text-xs transition-colors"
                >
                  <WhatsAppSvg className="w-4 h-4 text-emerald-400" />
                  <span>¿Todavía no estás en el grupo VIP? Entrá acá</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {config.prefill && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200">
                  <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Reconocimos tu cuenta del grupo. Solo completá tu DNI y confirmá.</span>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-500/40 bg-red-950/30 px-3.5 py-3 text-xs text-red-200">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Category Toggle */}
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-zinc-300 mb-2">
                  Tipo de Ingreso
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={womenFull}
                    onClick={() => setCategory("dama_free")}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      womenFull
                        ? "border-zinc-800 bg-zinc-900/40 text-zinc-600 cursor-not-allowed"
                        : category === "dama_free"
                        ? "border-violet-500 bg-violet-500/15 text-white shadow-sm shadow-violet-500/15"
                        : "border-avora-border bg-avora-bg/70 text-zinc-300 hover:border-zinc-700"
                    }`}
                  >
                    <p className="text-xs font-bold">{config.women_label}</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {womenFull
                        ? "Cupo completo"
                        : womenRemaining !== null
                        ? `${womenRemaining} lugares`
                        : "Disponible"}
                    </p>
                  </button>

                  <button
                    type="button"
                    disabled={menFull}
                    onClick={() => setCategory("hombre_consumo")}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      menFull
                        ? "border-zinc-800 bg-zinc-900/40 text-zinc-600 cursor-not-allowed"
                        : category === "hombre_consumo"
                        ? "border-cyan-500 bg-cyan-500/15 text-white shadow-sm shadow-cyan-500/15"
                        : "border-avora-border bg-avora-bg/70 text-zinc-300 hover:border-zinc-700"
                    }`}
                  >
                    <p className="text-xs font-bold">{config.men_label}</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {menFull
                        ? "Cupo completo"
                        : menRemaining !== null
                        ? `${menRemaining} lugares • Consumición en barra`
                        : "Abonando consumición en barra"}
                    </p>
                  </button>
                </div>
              </div>

              {/* First & Last Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="guestFirstName"
                    className="block text-xs font-medium uppercase tracking-wider text-zinc-300 mb-1.5"
                  >
                    Nombre
                  </label>
                  <input
                    id="guestFirstName"
                    type="text"
                    required
                    autoComplete="given-name"
                    placeholder="Ej: Valentín"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-xl border border-avora-border bg-avora-bg/90 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="guestLastName"
                    className="block text-xs font-medium uppercase tracking-wider text-zinc-300 mb-1.5"
                  >
                    Apellido
                  </label>
                  <input
                    id="guestLastName"
                    type="text"
                    required
                    autoComplete="family-name"
                    placeholder="Ej: Morales"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-xl border border-avora-border bg-avora-bg/90 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* DNI */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="guestDni"
                    className="block text-xs font-medium uppercase tracking-wider text-zinc-300"
                  >
                    DNI (Sin puntos)
                  </label>
                  {cleanDniPreview && (
                    <span className="text-[11px] font-mono text-cyan-400">{cleanDniPreview}</span>
                  )}
                </div>
                <input
                  id="guestDni"
                  type="text"
                  inputMode="numeric"
                  required
                  placeholder="Ej: 43200487"
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  className="w-full rounded-xl border border-avora-border bg-avora-bg/90 px-3.5 py-2.5 text-sm font-mono text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
                />
              </div>

              {/* Bombo Email */}
              <div>
                <label
                  htmlFor="guestBomboEmail"
                  className="block text-xs font-medium uppercase tracking-wider text-zinc-300 mb-1.5"
                >
                  Mail de Bombo
                </label>
                <input
                  id="guestBomboEmail"
                  type="email"
                  inputMode="email"
                  required
                  autoComplete="email"
                  placeholder="tuemail@ejemplo.com"
                  value={bomboEmail}
                  onChange={(e) => setBomboEmail(e.target.value)}
                  className="w-full rounded-xl border border-avora-border bg-avora-bg/90 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-zinc-500 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                  <span>Obligatorio para acreditación en puerta por Bombo.</span>
                </p>
              </div>

              {/* Instagram Account */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="guestInstagram"
                    className="block text-xs font-medium uppercase tracking-wider text-zinc-300"
                  >
                    Cuenta de Instagram
                  </label>
                  {cleanIgPreview && (
                    <span className="text-[11px] font-mono text-violet-300">{cleanIgPreview}</span>
                  )}
                </div>
                <input
                  id="guestInstagram"
                  type="text"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="Ej: @tuusuario"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  className="w-full rounded-xl border border-avora-border bg-avora-bg/90 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
                />
              </div>

              {/* Optional WhatsApp */}
              <div>
                <label
                  htmlFor="guestWhatsapp"
                  className="block text-xs font-medium uppercase tracking-wider text-zinc-300 mb-1.5"
                >
                  WhatsApp (Opcional si ya estás en el grupo)
                </label>
                <input
                  id="guestWhatsapp"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="Ej: 11 2345 6789"
                  value={whatsappPhone}
                  onChange={(e) => setWhatsappPhone(e.target.value)}
                  className="w-full rounded-xl border border-avora-border bg-avora-bg/90 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || (womenFull && menFull)}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 disabled:opacity-50 text-white font-semibold py-3.5 px-5 text-sm transition-all shadow-lg shadow-violet-600/25"
              >
                <span>{submitting ? "Registrando en lista..." : "Confirmar Lugar en Lista"}</span>
                {!submitting && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
