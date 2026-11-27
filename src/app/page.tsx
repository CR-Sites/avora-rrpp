import type { Metadata } from "next";
import PublicGateForm from "@/components/PublicGateForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PublicFormConfig } from "@/types/avora";

export const dynamic = "force-dynamic";

const FALLBACK_CONFIG: PublicFormConfig = {
  brand_name: "",
  brand_tagline: "",
  form_title: "Acceso Exclusivo al Grupo Oficial",
  form_subtitle:
    "Completá tus datos reales y tu mail de Bombo para ingresar al grupo privado de WhatsApp.",
  is_registration_open: true,
  require_bombo_email: true,
  welcome_button_label: "Solicitar Acceso al Grupo",
  interests: [],
};

async function fetchPublicConfig(): Promise<PublicFormConfig> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("get_public_form_config_avora");
  return (data as PublicFormConfig | null) || FALLBACK_CONFIG;
}

export async function generateMetadata(): Promise<Metadata> {
  const config = await fetchPublicConfig();
  const formTitle = config.form_title?.trim() || "";
  const brandName = config.brand_name?.trim() || "";

  let pageTitle = "Acceso Oficial";
  if (formTitle && brandName) {
    pageTitle = `${formTitle} — ${brandName}`;
  } else if (formTitle) {
    pageTitle = formTitle;
  } else if (brandName) {
    pageTitle = brandName;
  }

  const pageDesc = config.form_subtitle?.trim() || "";

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

export default async function HomePage() {
  const config = await fetchPublicConfig();

  return <PublicGateForm config={config} />;
}
