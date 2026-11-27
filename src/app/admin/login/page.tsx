"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Lock, LogIn } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { AvoraLogoMark } from "@/components/AvoraIcons";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError || !data.user) {
        throw new Error("Credenciales inválidas. Verificá tu email y contraseña.");
      }

      const { data: adminCheck } = await supabase
        .from("admins_avora")
        .select("user_id")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (!adminCheck) {
        await supabase.auth.signOut();
        throw new Error("Esta cuenta no tiene permisos de administración en Avora.");
      }

      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="avora-mesh min-h-screen flex flex-col justify-center px-4 py-10">
      <div className="w-full max-w-sm mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-3">
            <AvoraLogoMark className="w-11 h-11" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Panel de Control AVORA</h1>
          <p className="text-xs text-zinc-400">
            Ingresá con tu cuenta de administrador o Jefe de Públicas
          </p>
        </div>

        <div className="rounded-2xl border border-avora-border bg-avora-surface/95 p-6 shadow-2xl shadow-black/60">
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-950/30 p-3 text-xs text-red-200">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-zinc-300 mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@avora.app"
                className="w-full rounded-xl border border-avora-border bg-avora-bg px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-zinc-300 mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-avora-border bg-avora-bg px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-semibold py-3 px-4 text-sm transition-colors"
            >
              {loading ? <Lock className="w-4 h-4 animate-pulse" /> : <LogIn className="w-4 h-4" />}
              <span>{loading ? "Validando acceso..." : "Ingresar al Panel"}</span>
            </button>
          </form>
        </div>

        <div className="text-center">
          <Link
            href="/unirse"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Volver al formulario público</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
