import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AdminDashboard from "@/components/admin/AdminDashboard";
import type {
  AdminAvora,
  ClickAvora,
  InterestOption,
  LinkAvora,
  MemberAvora,
  SettingsAvora,
} from "@/types/avora";

export const dynamic = "force-dynamic";

const DEFAULT_SETTINGS: SettingsAvora = {
  id: 1,
  brand_name: "AVORA",
  brand_tagline: "Electronic Music Community & VIP Access",
  form_title: "Acceso Exclusivo al Grupo Oficial",
  form_subtitle:
    "Completá tus datos reales y tu mail de Bombo para ingresar a la comunidad privada de WhatsApp.",
  whatsapp_invite_url: "https://chat.whatsapp.com/",
  is_registration_open: true,
  require_bombo_email: true,
  welcome_button_label: "Solicitar Acceso al Grupo",
  updated_at: new Date().toISOString(),
};

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { data: adminRecord } = await supabase
    .from("admins_avora")
    .select("user_id, email, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!adminRecord) {
    return (
      <main className="avora-mesh min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-avora-border bg-avora-surface p-7 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-white">Cuenta sin Permisos en Avora</h1>
          <p className="text-xs text-zinc-400">
            Tu sesión actual ({user.email}) no figura en la lista de administradores autorizados de
            Avora.
          </p>
          <Link
            href="/admin/login"
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 px-4 py-2.5 text-xs font-semibold text-white"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Cambiar de cuenta</span>
          </Link>
        </div>
      </main>
    );
  }

  const [settingsRes, interestsRes, membersRes, linksRes, clicksRes, adminsRes] = await Promise.all([
    supabase.from("settings_avora").select("*").eq("id", 1).maybeSingle(),
    supabase
      .from("interests_avora")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("members_avora")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase.from("links_avora").select("*").order("created_at", { ascending: false }),
    supabase
      .from("clicks_avora")
      .select(
        `
        *,
        members_avora (
          id,
          full_name,
          whatsapp_phone,
          bombo_email,
          interest_labels
        ),
        links_avora (
          id,
          slug,
          title,
          event_name,
          target_url
        )
      `
      )
      .order("clicked_at", { ascending: false })
      .limit(2500),
    supabase.from("admins_avora").select("*").order("created_at", { ascending: true }),
  ]);

  return (
    <AdminDashboard
      userEmail={user.email || adminRecord.email}
      settings={(settingsRes.data as SettingsAvora | null) || DEFAULT_SETTINGS}
      interests={(interestsRes.data as InterestOption[] | null) || []}
      members={(membersRes.data as MemberAvora[] | null) || []}
      links={(linksRes.data as LinkAvora[] | null) || []}
      clicks={(clicksRes.data as ClickAvora[] | null) || []}
      admins={(adminsRes.data as AdminAvora[] | null) || []}
    />
  );
}
