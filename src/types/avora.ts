export interface InterestOption {
  id: string;
  label: string;
  category: string;
  is_active?: boolean;
  sort_order: number;
  created_at?: string;
}

export interface PublicFormConfig {
  brand_name: string;
  brand_tagline: string;
  form_title: string;
  form_subtitle: string;
  is_registration_open: boolean;
  require_bombo_email: boolean;
  welcome_button_label: string;
  interests: InterestOption[];
}

export interface SettingsAvora {
  id: number;
  brand_name: string;
  brand_tagline: string;
  form_title: string;
  form_subtitle: string;
  whatsapp_invite_url: string;
  is_registration_open: boolean;
  require_bombo_email: boolean;
  welcome_button_label: string;
  updated_at: string;
}

export interface MemberAvora {
  id: string;
  full_name: string;
  whatsapp_phone: string;
  whatsapp_raw: string | null;
  bombo_email: string;
  interest_ids: string[];
  interest_labels: string[];
  visitor_token: string;
  anon_visitor_id: string | null;
  notes: string | null;
  join_count: number;
  ip_address: string | null;
  country: string | null;
  country_code: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  isp: string | null;
  timezone: string | null;
  language: string | null;
  user_agent: string | null;
  browser: string | null;
  os: string | null;
  device_type: string | null;
  in_app_source: string | null;
  screen_resolution: string | null;
  viewport_size: string | null;
  connection_type: string | null;
  platform: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  raw_telemetry: Record<string, unknown>;
  created_at: string;
  last_seen_at: string;
}

export interface LinkAvora {
  id: string;
  slug: string;
  title: string;
  event_name: string | null;
  target_url: string;
  og_title: string | null;
  og_description: string | null;
  og_image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClickAvora {
  id: string;
  link_id: string;
  member_id: string | null;
  visitor_token: string | null;
  anon_visitor_id: string | null;
  is_bot: boolean;
  bot_name: string | null;
  ip_address: string | null;
  country: string | null;
  country_code: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  isp: string | null;
  timezone: string | null;
  language: string | null;
  user_agent: string | null;
  browser: string | null;
  os: string | null;
  device_type: string | null;
  in_app_source: string | null;
  screen_resolution: string | null;
  viewport_size: string | null;
  connection_type: string | null;
  platform: string | null;
  referrer: string | null;
  query_params: Record<string, string>;
  raw_telemetry: Record<string, unknown>;
  client_enriched: boolean;
  clicked_at: string;
  members_avora?: {
    id: string;
    full_name: string;
    whatsapp_phone: string;
    bombo_email: string;
    interest_labels: string[];
  } | null;
  links_avora?: {
    id: string;
    slug: string;
    title: string;
    event_name: string | null;
    target_url: string;
  } | null;
}

export interface AdminAvora {
  user_id: string;
  email: string;
  role: string;
  created_at: string;
}

export interface ClientTelemetryPayload {
  screen_resolution?: string;
  viewport_size?: string;
  timezone?: string;
  language?: string;
  connection_type?: string;
  platform?: string;
  visitor_token?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer?: string;
  extra?: Record<string, unknown>;
}
