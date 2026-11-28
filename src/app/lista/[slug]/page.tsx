import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight, ClipboardX } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AVORA_MEMBER_COOKIE } from "@/lib/cookies";
import PublicGuestlistForm from "@/components/PublicGuestlistForm";
import type { PublicGuestlistConfig } from "@/types/avora";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("get_public_guestlist_avora", {
    p_slug: slug,
    p_visitor_token: null,
  });

  const list = data as PublicGuestlistConfig | null;
  if (!list) {
    return {
      title: "Lista no disponible",
      description: "Esta lista ya finalizó o no existe.",
    };
  }

  const brand = list.brand_name?.trim();
  const pageTitle = brand ? `Lista ${list.title} — ${brand}` : `Lista ${list.title}`;
  const pageDesc =
    list.description?.trim() || `${list.women_label} / ${list.men_label}`;

  return {
    title: pageTitle,
    description: pageDesc,
    openGraph: {
      title: pageTitle,
      description: pageDesc,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: pageTitle,
      description: pageDesc,
    },
  };
}

export default async function PublicGuestlistPage({ params, searchParams }: PageProps) {
  const [{ slug }, queryObj, cookieStore] = await Promise.all([
    params,
    searchParams,
    cookies(),
  ]);

  const visitorToken = cookieStore.get(AVORA_MEMBER_COOKIE)?.value || null;
  const rrppParam =
    typeof queryObj?.rrpp === "string"
      ? queryObj.rrpp.trim()
      : Array.isArray(queryObj?.rrpp) && queryObj.rrpp[0]
      ? queryObj.rrpp[0].trim()
      : undefined;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("get_public_guestlist_avora", {
    p_slug: slug,
    p_visitor_token: visitorToken,
  });

  const config = data as PublicGuestlistConfig | null;

  if (!config) {
    return (
      <main className="avora-mesh min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-avora-border bg-avora-surface p-7 text-center space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center mx-auto text-violet-400">
            <ClipboardX className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-white">Lista No Encontrada</h1>
            <p className="text-sm text-zinc-400">
              Este enlace de lista ya no está disponible. Unite al grupo oficial para enterarte de las
              próximas fechas.
            </p>
          </div>
          <Link
            href="/unirse"
            className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold py-3 px-4 text-sm transition-colors"
          >
            <span>Ir al Grupo Oficial</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    );
  }

  return <PublicGuestlistForm config={config} rrppOverride={rrppParam} />;
}
