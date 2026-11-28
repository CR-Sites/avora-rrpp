import type { NextRequest } from "next/server";

export interface ParsedUserAgent {
  browser: string;
  os: string;
  device_type: "mobile" | "tablet" | "desktop";
  in_app_source: string;
  is_bot: boolean;
  bot_name: string | null;
}

const BOT_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /WhatsApp/i, name: "WhatsApp Preview" },
  { pattern: /facebookexternalhit|Facebot|meta-externalagent/i, name: "Meta Crawler" },
  { pattern: /TelegramBot/i, name: "Telegram Preview" },
  { pattern: /Twitterbot/i, name: "X / Twitter Preview" },
  { pattern: /Discordbot/i, name: "Discord Preview" },
  { pattern: /Slackbot/i, name: "Slack Preview" },
  { pattern: /LinkedInBot/i, name: "LinkedIn Preview" },
  { pattern: /Googlebot|AdsBot-Google/i, name: "Googlebot" },
  { pattern: /bingbot/i, name: "Bingbot" },
  { pattern: /HeadlessChrome|Playwright|Puppeteer/i, name: "Headless Browser" },
  { pattern: /\b(bot|crawler|spider|preview)\b/i, name: "Generic Crawler" },
];

export function parseUserAgent(uaRaw: string | null | undefined, referer?: string | null): ParsedUserAgent {
  const ua = (uaRaw || "").trim();
  if (!ua) {
    return {
      browser: "Desconocido",
      os: "Desconocido",
      device_type: "desktop",
      in_app_source: "Directo",
      is_bot: false,
      bot_name: null,
    };
  }

  // Note: WhatsApp link preview crawler sends "WhatsApp/2.x" WITHOUT "Mozilla/5.0" browser tokens,
  // whereas an in-app webview has "Mozilla/5.0 ...". Distinguish cleanly!
  let isBot = false;
  let botName: string | null = null;

  if (/^WhatsApp\//i.test(ua) || (/WhatsApp/i.test(ua) && !/AppleWebKit|Chrome|Gecko/i.test(ua))) {
    isBot = true;
    botName = "WhatsApp Preview";
  } else {
    for (const b of BOT_PATTERNS) {
      if (b.name === "WhatsApp Preview") continue;
      if (b.name === "Headless Browser") continue; // Don't mark automated QA or legitimate Chrome previews as preview bots unless desired
      if (b.pattern.test(ua)) {
        isBot = true;
        botName = b.name;
        break;
      }
    }
  }

  // Detect In-App / Traffic Source
  let inAppSource = "Directo / Navegador";
  if (/Instagram/i.test(ua) || (referer && /instagram\.com/i.test(referer))) {
    inAppSource = "Instagram";
  } else if (/WhatsApp|WAiOS|WAA/i.test(ua) || (referer && /whatsapp\.com/i.test(referer))) {
    inAppSource = "WhatsApp";
  } else if (/FBAN|FBAV|FB_IAB/i.test(ua) || (referer && /facebook\.com|fb\.com/i.test(referer))) {
    inAppSource = "Facebook";
  } else if (/BytedanceWebview|musical_ly|TikTok/i.test(ua) || (referer && /tiktok\.com/i.test(referer))) {
    inAppSource = "TikTok";
  } else if (/Telegram/i.test(ua) || (referer && /t\.me|telegram\.org/i.test(referer))) {
    inAppSource = "Telegram";
  } else if (referer) {
    try {
      const host = new URL(referer).hostname.replace(/^www\./, "");
      if (host) inAppSource = host;
    } catch {
      inAppSource = "Referido";
    }
  }

  // Detect OS + Version
  let os = "Otro OS";
  const iosMatch = ua.match(/OS (\d+)[._](\d+)/i);
  const androidMatch = ua.match(/Android (\d+(?:\.\d+)?)/i);
  if (/iPhone|iPod/i.test(ua)) {
    os = iosMatch ? `iOS ${iosMatch[1]}.${iosMatch[2]}` : "iOS";
  } else if (/iPad/i.test(ua)) {
    os = iosMatch ? `iPadOS ${iosMatch[1]}.${iosMatch[2]}` : "iPadOS";
  } else if (androidMatch) {
    os = `Android ${androidMatch[1]}`;
  } else if (/Windows NT 10\.0/i.test(ua)) {
    os = "Windows 10/11";
  } else if (/Windows/i.test(ua)) {
    os = "Windows";
  } else if (/Mac OS X (\d+)[._](\d+)/i.test(ua)) {
    const m = ua.match(/Mac OS X (\d+)[._](\d+)/i);
    os = m ? `macOS ${m[1]}.${m[2]}` : "macOS";
  } else if (/Linux/i.test(ua)) {
    os = "Linux";
  }

  // Detect Device Type
  let deviceType: "mobile" | "tablet" | "desktop" = "desktop";
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) {
    deviceType = "tablet";
  } else if (/Mobile|iPhone|iPod|Android|IEMobile|Opera Mini/i.test(ua)) {
    deviceType = "mobile";
  }

  // Detect Browser
  let browser = "Navegador";
  if (/Instagram/i.test(ua)) {
    browser = "Instagram In-App";
  } else if (/FBAN|FBAV/i.test(ua)) {
    browser = "Facebook In-App";
  } else if (/SamsungBrowser\/(\d+)/i.test(ua)) {
    browser = "Samsung Internet";
  } else if (/EdgA?\/(\d+)/i.test(ua)) {
    browser = "Edge";
  } else if (/OPR\/(\d+)|Opera/i.test(ua)) {
    browser = "Opera";
  } else if (/CriOS\/(\d+)/i.test(ua)) {
    browser = "Chrome (iOS)";
  } else if (/FxiOS\/(\d+)/i.test(ua)) {
    browser = "Firefox (iOS)";
  } else if (/Chrome\/(\d+)/i.test(ua) && !/Edg/i.test(ua)) {
    browser = deviceType === "mobile" ? "Chrome Mobile" : "Chrome";
  } else if (/Firefox\/(\d+)/i.test(ua)) {
    browser = "Firefox";
  } else if (/Safari\/(\d+)/i.test(ua) && /Version\/(\d+)/i.test(ua)) {
    browser = deviceType === "mobile" ? "Mobile Safari" : "Safari";
  } else if (isBot && botName) {
    browser = botName;
  }

  return {
    browser,
    os,
    device_type: deviceType,
    in_app_source: inAppSource,
    is_bot: isBot,
    bot_name: botName,
  };
}

export interface ServerGeoTelemetry {
  ip_address: string | null;
  country: string | null;
  country_code: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  isp: string | null;
  timezone: string | null;
}

function isPrivateOrLocalIp(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
    ip.startsWith("::ffff:127.")
  );
}

export function extractClientIpFromHeaders(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.replace(/^::ffff:/, "");
  }
  const candidates = [
    headers.get("cf-connecting-ip"),
    headers.get("x-real-ip"),
    headers.get("x-vercel-forwarded-for"),
  ];
  for (const c of candidates) {
    if (c && c.trim()) return c.trim().replace(/^::ffff:/, "");
  }
  return null;
}

function safeDecodeHeader(value: string | null): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function resolveServerGeo(headers: Headers, timeoutMs = 320): Promise<ServerGeoTelemetry> {
  const ip = extractClientIpFromHeaders(headers);

  // 1. Zero-latency Edge headers (Vercel / Cloudflare / Reverse Proxy)
  const vercelCountry = headers.get("x-vercel-ip-country") || headers.get("cf-ipcountry");
  const vercelRegion = safeDecodeHeader(headers.get("x-vercel-ip-country-region") || headers.get("cf-region"));
  const vercelCity = safeDecodeHeader(headers.get("x-vercel-ip-city") || headers.get("cf-ipcity"));
  const vercelLat = headers.get("x-vercel-ip-latitude") || headers.get("cf-iplatitude");
  const vercelLon = headers.get("x-vercel-ip-longitude") || headers.get("cf-iplongitude");
  const vercelTz = headers.get("x-vercel-ip-timezone") || headers.get("cf-timezone");

  if (vercelCity || vercelCountry) {
    return {
      ip_address: ip,
      country: vercelCountry,
      country_code: vercelCountry,
      region: vercelRegion,
      city: vercelCity,
      latitude: vercelLat ? Number(vercelLat) : null,
      longitude: vercelLon ? Number(vercelLon) : null,
      isp: null,
      timezone: vercelTz,
    };
  }

  // 2. Self-hosted / VPS fallback via ipwho.is (Free, zero API key, strict timeout so redirects never lag)
  if (ip && !isPrivateOrLocalIp(ip)) {
    try {
      const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?lang=es`, {
        signal: AbortSignal.timeout(timeoutMs),
        cache: "force-cache",
      });
      if (res.ok) {
        const data = (await res.json()) as Record<string, unknown>;
        if (data && data.success !== false) {
          const conn = (data.connection || {}) as Record<string, unknown>;
          const tz = (data.timezone || {}) as Record<string, unknown>;
          return {
            ip_address: ip,
            country: typeof data.country === "string" ? data.country : null,
            country_code: typeof data.country_code === "string" ? data.country_code : null,
            region: typeof data.region === "string" ? data.region : null,
            city: typeof data.city === "string" ? data.city : null,
            latitude: typeof data.latitude === "number" ? data.latitude : null,
            longitude: typeof data.longitude === "number" ? data.longitude : null,
            isp: typeof conn.isp === "string" ? conn.isp : typeof conn.org === "string" ? conn.org : null,
            timezone: typeof tz.id === "string" ? tz.id : null,
          };
        }
      }
    } catch {
      // Never block user flow on GeoIP timeout
    }
  }

  return {
    ip_address: ip || "127.0.0.1",
    country: ip && isPrivateOrLocalIp(ip) ? "Local / Desarrollo" : null,
    country_code: null,
    region: null,
    city: ip && isPrivateOrLocalIp(ip) ? "Localhost" : null,
    latitude: null,
    longitude: null,
    isp: null,
    timezone: null,
  };
}

export function normalizeWhatsappPhone(input: string): string {
  const raw = input.trim();
  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (hasPlus) return `+${digits}`;
  // Smart default for Argentina local numbers (e.g. 11 2345 6789 -> +5491123456789)
  if (digits.length === 10 && (digits.startsWith("11") || digits.startsWith("2") || digits.startsWith("3"))) {
    return `+549${digits}`;
  }
  if (digits.startsWith("54") && digits.length >= 12) {
    return `+${digits}`;
  }
  return `+${digits}`;
}

export function buildWaMeUrl(phone: string, message?: string): string {
  const digits = phone.replace(/\D/g, "");
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function normalizeInstagramHandle(input: string): string {
  let clean = (input || "").trim();
  if (!clean) return "";
  clean = clean
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .split(/[?#]/)[0]
    .replace(/\/+$/, "")
    .replace(/^@+/, "")
    .replace(/\s+/g, "");
  if (!clean) return "";
  return `@${clean.toLowerCase()}`;
}

export function buildInstagramUrl(handle: string): string {
  const clean = handle.replace(/^@+/, "").trim();
  return `https://instagram.com/${encodeURIComponent(clean)}`;
}

export function extractRequestSnapshot(req: NextRequest) {
  const h = req.headers;
  return {
    accept_language: h.get("accept-language"),
    sec_ch_ua: h.get("sec-ch-ua"),
    sec_ch_ua_mobile: h.get("sec-ch-ua-mobile"),
    sec_ch_ua_platform: h.get("sec-ch-ua-platform"),
  };
}
