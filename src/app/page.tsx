import PublicGateForm from "@/components/PublicGateForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PublicFormConfig } from "@/types/avora";

export const dynamic = "force-dynamic";

const FALLBACK_CONFIG: PublicFormConfig = {
  brand_name: "AVORA",
  brand_tagline: "Electronic Music Community & VIP Access",
  form_title: "Acceso Exclusivo al Grupo Oficial",
  form_subtitle:
    "Completá tus datos reales y tu mail de Bombo para ingresar al grupo privado de WhatsApp.",
  is_registration_open: true,
  require_bombo_email: true,
  welcome_button_label: "Solicitar Acceso al Grupo",
  interests: [],
};

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("get_public_form_config_avora");
  const config = (data as PublicFormConfig | null) || FALLBACK_CONFIG;

  return <PublicGateForm config={config} />;
}
