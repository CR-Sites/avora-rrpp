"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Link2,
  Sliders,
  RefreshCw,
  LogOut,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import type {
  AdminAvora,
  ClickAvora,
  InterestOption,
  LinkAvora,
  MemberAvora,
  SettingsAvora,
} from "@/types/avora";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { AvoraLogoMark } from "@/components/AvoraIcons";
import MembersPanel from "./MembersPanel";
import LinksPanel from "./LinksPanel";
import SettingsPanel from "./SettingsPanel";

interface Props {
  userEmail: string;
  settings: SettingsAvora;
  interests: InterestOption[];
  members: MemberAvora[];
  links: LinkAvora[];
  clicks: ClickAvora[];
  admins: AdminAvora[];
}

type ActiveTab = "members" | "links" | "settings";

export default function AdminDashboard({
  userEmail,
  settings,
  interests,
  members,
  links,
  clicks,
  admins,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>("members");
  const [copiedGate, setCopiedGate] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const handleCopyGateLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/unirse`);
      setCopiedGate(true);
      setTimeout(() => setCopiedGate(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  };

  const humanClicksCount = clicks.filter((c) => !c.is_bot).length;

  return (
    <div className="min-h-screen bg-avora-bg text-zinc-100 flex flex-col">
      {/* Top Command Header */}
      <header className="sticky top-0 z-30 border-b border-avora-border bg-avora-surface/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Brand + Gate Quick Link */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <AvoraLogoMark className="w-8 h-8" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold tracking-wider uppercase text-white">
                    {settings.brand_name || "AVORA"}
                  </span>
                  <span className="rounded-md bg-violet-500/15 border border-violet-500/30 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-violet-300">
                    PR Hub
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 hidden sm:block">{userEmail}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 md:hidden">
              <button
                type="button"
                onClick={handleRefresh}
                className="rounded-lg border border-avora-border bg-avora-bg p-2 text-zinc-300"
                aria-label="Actualizar datos"
              >
                <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-lg border border-avora-border bg-avora-bg p-2 text-zinc-400"
                aria-label="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Primary Panel Switcher (Grupo <-> Links de Compra <-> Ajustes) */}
          <nav className="flex items-center gap-1.5 rounded-xl border border-avora-border bg-avora-bg p-1 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab("members")}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === "members"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Grupo & Base</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-mono ${
                  activeTab === "members" ? "bg-white/20 text-white" : "bg-zinc-800 text-zinc-400"
                }`}
              >
                {members.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("links")}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === "links"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Links de Compra</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-mono ${
                  activeTab === "links" ? "bg-white/20 text-white" : "bg-zinc-800 text-zinc-400"
                }`}
              >
                {humanClicksCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("settings")}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === "settings"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Configuración</span>
            </button>
          </nav>

          {/* Right Quick Actions */}
          <div className="hidden md:flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyGateLink}
              className="inline-flex items-center gap-1.5 rounded-xl border border-avora-border bg-avora-bg hover:bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-200 transition-colors"
            >
              {copiedGate ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Link Grupo Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-violet-400" />
                  <span>Copiar /unirse</span>
                </>
              )}
            </button>

            <Link
              href="/unirse"
              target="_blank"
              title="Ver formulario público"
              className="rounded-xl border border-avora-border bg-avora-bg hover:bg-zinc-900 p-2 text-zinc-300 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </Link>

            <button
              type="button"
              onClick={handleRefresh}
              title="Actualizar métricas en vivo"
              className="rounded-xl border border-avora-border bg-avora-bg hover:bg-zinc-900 p-2 text-zinc-300 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin text-violet-400" : ""}`} />
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              title="Cerrar sesión"
              className="rounded-xl border border-avora-border bg-avora-bg hover:border-red-500/40 hover:text-red-400 p-2 text-zinc-400 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === "members" && (
          <MembersPanel
            members={members}
            interests={interests}
            clicks={clicks}
            onRefresh={handleRefresh}
          />
        )}

        {activeTab === "links" && (
          <LinksPanel links={links} clicks={clicks} onRefresh={handleRefresh} />
        )}

        {activeTab === "settings" && (
          <SettingsPanel
            settings={settings}
            interests={interests}
            admins={admins}
            onRefresh={handleRefresh}
          />
        )}
      </main>
    </div>
  );
}
