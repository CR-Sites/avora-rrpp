import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AVORA_MEMBER_COOKIE } from "@/lib/cookies";
import { normalizeWhatsappPhone, parseUserAgent, resolveServerGeo } from "@/lib/telemetry";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const slug = String(body.slug || "").trim();
    const category = String(body.category || "").trim();
    const firstName = String(body.first_name || "").trim();
    const lastName = String(body.last_name || "").trim();
    const dniDigits = String(body.dni || "").replace(/\D/g, "");
    const bomboEmail = String(body.bombo_email || "").trim().toLowerCase();
    const rawPhone = String(body.whatsapp_phone || "").trim();
    const normalizedPhone = rawPhone ? normalizeWhatsappPhone(rawPhone) : "";
    const rrppOverride = String(body.rrpp_override || "").trim();

    const cookieVid = request.cookies.get(AVORA_MEMBER_COOKIE)?.value;
    const visitorToken = cookieVid || (typeof body.visitor_token === "string" ? body.visitor_token : undefined);

    const ua = request.headers.get("user-agent") || "";
    const referer = request.headers.get("referer") || "";

    const [geo, uaInfo] = await Promise.all([
      resolveServerGeo(request.headers, 350),
      Promise.resolve(parseUserAgent(ua, referer)),
    ]);

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.rpc("register_guestlist_entry_avora", {
      p_payload: {
        slug,
        category,
        first_name: firstName,
        last_name: lastName,
        dni: dniDigits,
        bombo_email: bomboEmail,
        whatsapp_phone: normalizedPhone,
        rrpp_override: rrppOverride || null,
        visitor_token: visitorToken || null,
        ip_address: geo.ip_address,
        country: geo.country,
        region: geo.region,
        city: geo.city,
        latitude: geo.latitude,
        longitude: geo.longitude,
        os: uaInfo.os,
        browser: uaInfo.browser,
        device_type: uaInfo.device_type,
        in_app_source: uaInfo.in_app_source,
      },
    });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || "No pudimos confirmar tu lugar en lista." },
        { status: 400 }
      );
    }

    return NextResponse.json(data);
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
