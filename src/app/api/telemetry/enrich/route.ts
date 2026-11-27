import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const clickId = body.click_id;

    if (!clickId || typeof clickId !== "string") {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    await supabase.rpc("enrich_click_avora", {
      p_click_id: clickId,
      p_payload: {
        visitor_token: body.visitor_token || null,
        screen_resolution: body.screen_resolution || null,
        viewport_size: body.viewport_size || null,
        timezone: body.timezone || null,
        language: body.language || null,
        connection_type: body.connection_type || null,
        platform: body.platform || null,
        raw_telemetry: body.raw_telemetry || {},
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
