-- Local reference copy of applied Supabase migration: create_avora_schema
-- Target database tables (isolated with _avora suffix + RLS enabled):
--   1. public.admins_avora
--   2. public.settings_avora
--   3. public.interests_avora
--   4. public.members_avora
--   5. public.links_avora
--   6. public.clicks_avora
-- Security-Definer RPCs:
--   - public.get_public_form_config_avora()
--   - public.register_member_avora(jsonb)
--   - public.resolve_link_avora(text)
--   - public.record_click_avora(jsonb)
--   - public.enrich_click_avora(uuid, jsonb)
--   - public.upsert_operator_avora(text, text, text)

SELECT 1;
