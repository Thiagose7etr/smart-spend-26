CREATE TABLE public.user_dashboard_widgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  widget text not null,
  hidden boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, widget)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_dashboard_widgets TO authenticated;
GRANT ALL ON public.user_dashboard_widgets TO service_role;

ALTER TABLE public.user_dashboard_widgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own dashboard widgets"
  ON public.user_dashboard_widgets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage dashboard widgets"
  ON public.user_dashboard_widgets FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_udw_updated
  BEFORE UPDATE ON public.user_dashboard_widgets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();