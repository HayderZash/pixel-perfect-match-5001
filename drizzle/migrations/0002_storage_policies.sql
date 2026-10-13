
CREATE POLICY "auth read files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'files');
CREATE POLICY "auth upload own files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "delete own files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'files' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_top_admin(auth.uid())));
