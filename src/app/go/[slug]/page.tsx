import type { Metadata } from "next";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { randomUUID } from "crypto";
import { ArrowRight, Compass } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseUserAgent, resolveServerGeo } from "@/lib/telemetry";
import { AVORA_ANON_COOKIE, AVORA_MEMBER_COOKIE } from "@/lib/cookies";
import RedirectBridgeClient from "@/components/RedirectBridgeClient";
import { SonicPulseSvg } from "@/components/AvoraIcons";

export const dynamic = "force-dynamic";

interface ResolvedLink {
  id: string;
  slug: string;
  title: string;
  event_name: string | null;
  target_url: string;
  og_title: string;
  og_description: string;
  og_image_url: string | null;
}

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("resolve_link_avora", { p_slug: slug });
  const link = data as ResolvedLink | null;

  if (!link) {
    return {
      title: "Enlace Finalizado",
      description: "Este enlace ya no se encuentra activo.",
    };
  }

  const images = link.og_image_url ? [{ url: link.og_image_url }] : undefined;

  return {
    title: link.og_title || link.title,
    description: link.og_description || "Acceso oficial verificado",
    openGraph: {
      title: link.og_title || link.title,
      description: link.og_description || "Acceso oficial verificado",
      type: "website",
      images,
    },
    twitter: {
      card: link.og_image_url ? "summary_large_image" : "summary",
      title: link.og_title || link.title,
      description: link.og_description || "Acceso oficial verificado",
      images: link.og_image_url ? [link.og_image_url] : undefined,
    },
  };
}

export default async function GoRedirectPage({ params, searchParams }: PageProps) {
  const [{ slug }, queryObj, hdrs, cookieStore] = await Promise.all([
    params,
    searchParams,
    headers(),
    cookies(),
  ]);

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("resolve_link_avora", { p_slug: slug });
  const link = data as ResolvedLink | null;

  if (!link) {
    return (
      <main className="avora-mesh min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-avora-border bg-avora-surface p-7 text-center space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center mx-auto text-violet-400">
            <Compass className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-white">Tanda o Enlace Finalizado</h1>
            <p className="text-sm text-zinc-400">
              Este link de compra ya no está disponible o cambió de tanda. Unite al grupo oficial
              para acceder al link actualizado.
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

  const ua = hdrs.get("user-agent") || "";
  const referer = hdrs.get("referer") || "";
  const acceptLang = hdrs.get("accept-language")?.split(",")[0] || null;
  const visitorToken = cookieStore.get(AVORA_MEMBER_COOKIE)?.value || null;
  const anonVisitorId = cookieStore.get(AVORA_ANON_COOKIE)?.value || randomUUID();

  const flatQuery: Record<string, string> = {};
  for (const [k, v] of Object.entries(queryObj || {})) {
    if (typeof v === "string") flatQuery[k] = v;
    else if (Array.isArray(v) && v[0]) flatQuery[k] = v[0];
  }

  const [geo, uaInfo] = await Promise.all([
    resolveServerGeo(hdrs, 280),
    Promise.resolve(parseUserAgent(ua, referer)),
  ]);

  let clickId: string | null = null;
  try {
    const { data: clickResult } = await supabase.rpc("record_click_avora", {
      p_payload: {
        link_id: link.id,
        visitor_token: visitorToken,
        anon_visitor_id: anonVisitorId,
        is_bot: uaInfo.is_bot,
        bot_name: uaInfo.bot_name,
        ip_address: geo.ip_address,
        country: geo.country,
        country_code: geo.country_code,
        region: geo.region,
        city: geo.city,
        latitude: geo.latitude,
        longitude: geo.longitude,
        isp: geo.isp,
        timezone: geo.timezone,
        language: acceptLang,
        user_agent: ua,
        browser: uaInfo.browser,
        os: uaInfo.os,
        device_type: uaInfo.device_type,
        in_app_source: uaInfo.in_app_source,
        referrer: referer || null,
        query_params: flatQuery,
        raw_telemetry: {
          accept_language: hdrs.get("accept-language"),
          sec_ch_ua: hdrs.get("sec-ch-ua"),
          sec_ch_ua_mobile: hdrs.get("sec-ch-ua-mobile"),
          sec_ch_ua_platform: hdrs.get("sec-ch-ua-platform"),
        },
      },
    });
    if (clickResult && typeof clickResult === "object" && "click_id" in clickResult) {
      clickId = String((clickResult as { click_id: string }).click_id);
    }
  } catch {
    // Never fail redirect even if DB telemetry encounters transient network glitch
  }

  // WhatsApp / Social Preview Bots: Serve static OpenGraph preview page without JS redirect
  if (uaInfo.is_bot) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-avora-bg text-white p-6">
        <div className="max-w-sm text-center space-y-3">
          <SonicPulseSvg className="w-10 h-10 mx-auto text-violet-400" />
          <h1 className="text-xl font-bold">{link.og_title || link.title}</h1>
          <p className="text-sm text-zinc-400">{link.og_description}</p>
        </div>
      </main>
    );
  }

  return (
    <>
      <noscript>
        <meta httpEquiv="refresh" content={`0;url=${link.target_url}`} />
      </noscript>
      <RedirectBridgeClient
        clickId={clickId}
        targetUrl={link.target_url}
        title={link.og_title || link.title}
        anonVisitorId={anonVisitorId}
      />
    </>
  );
}
