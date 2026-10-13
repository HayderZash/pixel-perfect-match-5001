
CREATE OR REPLACE FUNCTION public.is_session_instructor(_session uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.attendance_sessions WHERE id = _session AND instructor_id = auth.uid())
$$;
CREATE OR REPLACE FUNCTION public.is_session_student(_session uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.attendance_records WHERE session_id = _session AND student_id = auth.uid())
$$;

DROP POLICY "read sessions" ON public.attendance_sessions;
CREATE POLICY "read sessions" ON public.attendance_sessions FOR SELECT TO authenticated USING (
  instructor_id = auth.uid() OR public.user_role(auth.uid()) IN ('system_admin','super_admin','college_admin','dept_admin','registrar')
  OR public.is_session_student(id)
);
DROP POLICY "read records" ON public.attendance_records;
CREATE POLICY "read records" ON public.attendance_records FOR SELECT TO authenticated USING (
  student_id = auth.uid() OR public.is_session_instructor(session_id)
  OR (public.user_role(auth.uid()) IN ('system_admin','super_admin','college_admin','dept_admin','registrar') AND public.can_view_student(student_id))
);
DROP POLICY "write records" ON public.attendance_records;
CREATE POLICY "write records" ON public.attendance_records FOR INSERT TO authenticated
  WITH CHECK (public.is_top_admin(auth.uid()) OR public.is_session_instructor(session_id));
DROP POLICY "update records" ON public.attendance_records;
CREATE POLICY "update records" ON public.attendance_records FOR UPDATE TO authenticated
  USING (public.is_top_admin(auth.uid()) OR public.is_session_instructor(session_id))
  WITH CHECK (public.is_top_admin(auth.uid()) OR public.is_session_instructor(session_id));

DROP POLICY "upload lectures" ON public.lectures;
CREATE POLICY "upload lectures" ON public.lectures FOR INSERT TO authenticated WITH CHECK (
  instructor_id = auth.uid() AND (public.is_top_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.course_instructors ci WHERE ci.course_id = lectures.course_id AND ci.instructor_id = auth.uid()))
);
