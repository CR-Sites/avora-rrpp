const AR_PROVINCES: Record<string, string> = {
  B: "Buenos Aires",
  C: "CABA",
  K: "Catamarca",
  H: "Chaco",
  U: "Chubut",
  X: "Córdoba",
  W: "Corrientes",
  E: "Entre Ríos",
  P: "Formosa",
  Y: "Jujuy",
  L: "La Pampa",
  F: "La Rioja",
  M: "Mendoza",
  N: "Misiones",
  Q: "Neuquén",
  R: "Río Negro",
  A: "Salta",
  J: "San Juan",
  D: "San Luis",
  Z: "Santa Cruz",
  S: "Santa Fe",
  G: "Santiago del Estero",
  V: "Tierra del Fuego",
  T: "Tucumán",
};

export function formatRegion(
  region: string | null | undefined,
  country: string | null | undefined
): string {
  const r = (region || "").trim();
  if (!r) return "";
  const c = (country || "").trim().toUpperCase();
  if ((c === "AR" || c === "ARGENTINA" || c === "") && r.length === 1) {
    return AR_PROVINCES[r.toUpperCase()] || r;
  }
  return r;
}

export function formatLocationLabel(
  city: string | null | undefined,
  region: string | null | undefined,
  country: string | null | undefined,
  fallback = "Sin ubicación"
): string {
  const cleanCity = (city || "").trim();
  const cleanRegion = formatRegion(region, country);
  const parts = [cleanCity, cleanRegion].filter(Boolean);
  if (parts.length > 0) return parts.join(", ");
  const cleanCountry = (country || "").trim();
  return cleanCountry || fallback;
}

export function maskPhone(phone: string | null | undefined): string {
  const p = (phone || "").trim();
  if (!p) return "••••";
  if (p.length <= 6) return "••••" + p.slice(-2);
  return `${p.slice(0, 6)}••••${p.slice(-2)}`;
}

export function maskEmail(email: string | null | undefined): string {
  const e = (email || "").trim();
  if (!e || !e.includes("@")) return "••••";
  const [local, domain] = e.split("@");
  const prefix = local.slice(0, Math.min(2, local.length));
  return `${prefix}•••@${domain}`;
}

export function maskName(name: string | null | undefined): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Miembro";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0].toUpperCase()}.`;
}
