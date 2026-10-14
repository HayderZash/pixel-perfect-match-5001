GRANT INSERT ON public.role_permissions TO authenticated;
CREATE POLICY "top admins insert permissions" ON public.role_permissions FOR INSERT TO authenticated
  WITH CHECK (public.is_top_admin(auth.uid()));