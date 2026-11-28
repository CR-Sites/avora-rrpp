import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  extractRequestSnapshot,
  normalizeInstagramHandle,
  normalizeWhatsappPhone,
  parseUserAgent,
  resolveServerGeo,
} from "@/lib/telemetry";
import { AVORA_COOKIE_MAX_AGE, AVORA_MEMBER_COOKIE } from "@/lib/cookies";
import type { ClientTelemetryPayload } from "@/types/avora";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const fullName = String(body.full_name || "").trim();
    const rawPhone = String(body.whatsapp_phone || "").trim();
    const normalizedPhone = normalizeWhatsappPhone(rawPhone);
    const bomboEmail = String(body.bombo_email || "").trim().toLowerCase();
    const instagramHandle = normalizeInstagramHandle(String(body.instagram_handle || ""));
    const interestIds = Array.isArray(body.interest_ids) ? body.interest_ids : [];
    const telemetry = (body.telemetry || {}) as ClientTelemetryPayload;

    const existingCookieVid = request.cookies.get(AVORA_MEMBER_COOKIE)?.value;
    const visitorToken = existingCookieVid || body.visitor_token || undefined;
    const anonVisitorId = body.anon_visitor_id || undefined;

    const ua = request.headers.get("user-agent") || "";
    const referer = telemetry.referrer || request.headers.get("referer") || "";

    const [geo, uaInfo] = await Promise.all([
      resolveServerGeo(request.headers, 360),
      Promise.resolve(parseUserAgent(ua, referer)),
    ]);

    const supabase = await createSupabaseServerClient();

    const rpcPayload = {
      full_name: fullName,
      whatsapp_phone: normalizedPhone,
      whatsapp_raw: rawPhone,
      bombo_email: bomboEmail,
      instagram_handle: instagramHandle || null,
      interest_ids: interestIds,
      visitor_token: visitorToken,
      anon_visitor_id: anonVisitorId,
      ip_address: geo.ip_address,
      country: geo.country,
      country_code: geo.country_code,
      region: geo.region,
      city: geo.city,
      latitude: geo.latitude,
      longitude: geo.longitude,
      isp: geo.isp,
      timezone: telemetry.timezone || geo.timezone,
      language: telemetry.language || request.headers.get("accept-language")?.split(",")[0] || null,
      user_agent: ua,
      browser: uaInfo.browser,
      os: uaInfo.os,
      device_type: uaInfo.device_type,
      in_app_source: uaInfo.in_app_source,
      screen_resolution: telemetry.screen_resolution || null,
      viewport_size: telemetry.viewport_size || null,
      connection_type: telemetry.connection_type || null,
      platform: telemetry.platform || null,
      referrer: referer || null,
      utm_source: telemetry.utm_source || null,
      utm_medium: telemetry.utm_medium || null,
      utm_campaign: telemetry.utm_campaign || null,
      raw_telemetry: {
        ...(telemetry.extra || {}),
        headers_snapshot: extractRequestSnapshot(request),
      },
    };

    const { data, error } = await supabase.rpc("register_member_avora", {
      p_payload: rpcPayload,
    });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || "Error al validar tus datos." },
        { status: 400 }
      );
    }

    const result = data as {
      ok: boolean;
      member_id: string;
      visitor_token: string;
      whatsapp_invite_url: string;
    };

    const response = NextResponse.json({
      ok: true,
      member_id: result.member_id,
      visitor_token: result.visitor_token,
      whatsapp_invite_url: result.whatsapp_invite_url,
    });

    // Persist 400-day first-party identity cookie so future Bombo link bounces identify this member!
    response.cookies.set(AVORA_MEMBER_COOKIE, result.visitor_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: AVORA_COOKIE_MAX_AGE,
    });

    return response;
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Error interno del servidor.",
      },
      { status: 500 }
    );
  }
}
