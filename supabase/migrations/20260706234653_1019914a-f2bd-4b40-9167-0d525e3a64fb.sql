
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.is_active(uuid) from public, anon;
revoke execute on function public.can_edit_tab(uuid, text) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function public.is_active(uuid) to authenticated, service_role;
grant execute on function public.can_edit_tab(uuid, text) to authenticated, service_role;
