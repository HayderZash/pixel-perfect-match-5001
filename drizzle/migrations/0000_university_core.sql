
-- ========== ENUMS ==========
CREATE TYPE public.app_role AS ENUM ('system_admin','super_admin','college_admin','dept_admin','instructor','student','registrar');
CREATE TYPE public.academic_rank AS ENUM ('professor','assistant_professor','lecturer','assistant_lecturer');
CREATE TYPE public.course_classification AS ENUM ('general','specialized','supportive','core');
CREATE TYPE public.attendance_status AS ENUM ('present','absent','excused');
CREATE TYPE public.session_type AS ENUM ('theory','practical');
CREATE TYPE public.resource_type AS ENUM ('book','paper','magazine','thesis');

-- ========== STRUCTURE ==========
CREATE TABLE public.colleges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id uuid NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  stages_count int NOT NULL DEFAULT 4,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.halls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id uuid REFERENCES public.colleges(id) ON DELETE CASCADE,
  name text NOT NULL,
  capacity int,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ========== USERS ==========
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  full_name text NOT NULL,
  email text,
  college_id uuid REFERENCES public.colleges(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  stage int,
  section text,
  sub_group text,
  academic_rank public.academic_rank,
  phone text,
  avatar_url text,
  is_profile_locked boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
CREATE TABLE public.qr_login_tokens (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ========== ACADEMIC ==========
CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  stage int NOT NULL DEFAULT 1,
  credit_hours numeric NOT NULL DEFAULT 0,
  ects numeric,
  theoretical_hours numeric NOT NULL DEFAULT 0,
  practical_hours numeric NOT NULL DEFAULT 0,
  semester_weeks int NOT NULL DEFAULT 15,
  classification public.course_classification NOT NULL DEFAULT 'specialized',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.course_instructors (
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  instructor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (course_id, instructor_id)
);
CREATE TABLE public.timetable_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  stage int NOT NULL,
  section text,
  sub_group text,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  period_start time NOT NULL,
  period_end time NOT NULL,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  instructor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  hall_id uuid REFERENCES public.halls(id) ON DELETE SET NULL,
  session_type public.session_type NOT NULL DEFAULT 'theory',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end > period_start)
);
CREATE TABLE public.attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL REFERENCES public.timetable_slots(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  instructor_id uuid NOT NULL,
  session_date date NOT NULL,
  hours numeric NOT NULL DEFAULT 1,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slot_id, session_date)
);
CREATE TABLE public.attendance_records (
  session_id uuid NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.attendance_status NOT NULL DEFAULT 'present',
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, student_id)
);
CREATE TABLE public.lectures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  instructor_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  file_path text,
  link_url text,
  kind text NOT NULL DEFAULT 'lecture',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.library_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  author text,
  type public.resource_type NOT NULL DEFAULT 'book',
  category text,
  college_id uuid REFERENCES public.colleges(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  file_path text,
  link_url text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  subject text NOT NULL DEFAULT '',
  body text NOT NULL,
  attachment_path text,
  is_broadcast boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_receiver_idx ON public.messages(receiver_id, created_at DESC);
CREATE INDEX messages_sender_idx ON public.messages(sender_id, created_at DESC);
CREATE TABLE public.role_permissions (
  role public.app_role NOT NULL,
  feature text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  PRIMARY KEY (role, feature)
);
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value text
);

-- ========== HELPER FUNCTIONS ==========
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.user_role(_user_id uuid)
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id ORDER BY role ASC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_top_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('system_admin','super_admin'))
$$;

CREATE OR REPLACE FUNCTION public.profile_college(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT college_id FROM public.profiles WHERE id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.profile_department(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT department_id FROM public.profiles WHERE id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.can_manage_college(_college uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_top_admin(auth.uid())
    OR (public.has_role(auth.uid(),'college_admin') AND public.profile_college(auth.uid()) = _college)
$$;

CREATE OR REPLACE FUNCTION public.can_manage_department(_dept uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_top_admin(auth.uid())
    OR (public.has_role(auth.uid(),'college_admin') AND public.profile_college(auth.uid()) = (SELECT college_id FROM public.departments WHERE id = _dept))
    OR (public.has_role(auth.uid(),'dept_admin') AND public.profile_department(auth.uid()) = _dept)
$$;

CREATE OR REPLACE FUNCTION public.can_view_student(_student uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.app_role; s record;
BEGIN
  IF auth.uid() = _student THEN RETURN true; END IF;
  r := public.user_role(auth.uid());
  IF r IN ('system_admin','super_admin') THEN RETURN true; END IF;
  SELECT college_id, department_id, stage INTO s FROM public.profiles WHERE id = _student;
  IF r IN ('college_admin','registrar') THEN RETURN s.college_id = public.profile_college(auth.uid()); END IF;
  IF r = 'dept_admin' THEN RETURN s.department_id = public.profile_department(auth.uid()); END IF;
  IF r = 'instructor' THEN
    RETURN EXISTS (SELECT 1 FROM public.course_instructors ci JOIN public.courses c ON c.id = ci.course_id
      WHERE ci.instructor_id = auth.uid() AND c.department_id = s.department_id AND c.stage = s.stage);
  END IF;
  RETURN false;
END $$;

CREATE OR REPLACE FUNCTION public.can_message(_sender uuid, _receiver uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE sr public.app_role; rr public.app_role; sp record; rp record;
BEGIN
  IF _sender = _receiver THEN RETURN false; END IF;
  sr := public.user_role(_sender); rr := public.user_role(_receiver);
  IF sr IS NULL OR rr IS NULL THEN RETURN false; END IF;
  SELECT * INTO sp FROM public.profiles WHERE id = _sender;
  SELECT * INTO rp FROM public.profiles WHERE id = _receiver;
  IF sr IN ('system_admin','super_admin') THEN RETURN true; END IF;
  IF sr = 'college_admin' THEN
    RETURN rr IN ('system_admin','super_admin') OR rp.college_id = sp.college_id;
  END IF;
  IF sr = 'dept_admin' THEN
    RETURN (rr IN ('instructor','student') AND rp.department_id = sp.department_id)
      OR (rr = 'college_admin' AND rp.college_id = sp.college_id);
  END IF;
  IF sr = 'registrar' THEN
    RETURN rr = 'student' AND rp.college_id = sp.college_id;
  END IF;
  IF sr = 'instructor' THEN
    RETURN (rr = 'dept_admin' AND rp.department_id = sp.department_id)
      OR (rr = 'student' AND EXISTS (SELECT 1 FROM public.course_instructors ci JOIN public.courses c ON c.id = ci.course_id
            WHERE ci.instructor_id = _sender AND c.department_id = rp.department_id AND c.stage = rp.stage));
  END IF;
  IF sr = 'student' THEN
    RETURN rr = 'instructor' AND EXISTS (SELECT 1 FROM public.course_instructors ci JOIN public.courses c ON c.id = ci.course_id
            WHERE ci.instructor_id = _receiver AND c.department_id = sp.department_id AND c.stage = sp.stage);
  END IF;
  RETURN false;
END $$;

-- ========== TRIGGERS ==========
CREATE OR REPLACE FUNCTION public.check_timetable_conflict()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record;
BEGIN
  IF NEW.instructor_id IS NOT NULL THEN
    SELECT id INTO c FROM public.timetable_slots t WHERE t.id <> NEW.id AND t.day_of_week = NEW.day_of_week
      AND t.instructor_id = NEW.instructor_id AND t.period_start < NEW.period_end AND t.period_end > NEW.period_start LIMIT 1;
    IF FOUND THEN RAISE EXCEPTION 'تعارض: التدريسي لديه محاضرة أخرى في نفس الوقت'; END IF;
  END IF;
  IF NEW.hall_id IS NOT NULL THEN
    SELECT id INTO c FROM public.timetable_slots t WHERE t.id <> NEW.id AND t.day_of_week = NEW.day_of_week
      AND t.hall_id = NEW.hall_id AND t.period_start < NEW.period_end AND t.period_end > NEW.period_start LIMIT 1;
    IF FOUND THEN RAISE EXCEPTION 'تعارض: القاعة محجوزة في نفس الوقت'; END IF;
  END IF;
  SELECT id INTO c FROM public.timetable_slots t WHERE t.id <> NEW.id AND t.day_of_week = NEW.day_of_week
    AND t.department_id = NEW.department_id AND t.stage = NEW.stage
    AND (t.section IS NULL OR NEW.section IS NULL OR t.section = NEW.section)
    AND (t.sub_group IS NULL OR NEW.sub_group IS NULL OR t.sub_group = NEW.sub_group)
    AND t.period_start < NEW.period_end AND t.period_end > NEW.period_start LIMIT 1;
  IF FOUND THEN RAISE EXCEPTION 'تعارض: المرحلة/الشعبة لديها محاضرة أخرى في نفس الوقت'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER timetable_conflict BEFORE INSERT OR UPDATE ON public.timetable_slots
FOR EACH ROW EXECUTE FUNCTION public.check_timetable_conflict();

CREATE OR REPLACE FUNCTION public.enforce_attendance_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sub timestamptz; sid uuid;
BEGIN
  IF auth.uid() IS NULL OR public.is_top_admin(auth.uid()) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW;
  END IF;
  sid := CASE WHEN TG_OP = 'DELETE' THEN OLD.session_id ELSE NEW.session_id END;
  SELECT submitted_at INTO sub FROM public.attendance_sessions WHERE id = sid;
  IF sub IS NOT NULL AND sub < now() - interval '7 days' THEN
    RAISE EXCEPTION 'السجل مقفل: مرّ أكثر من 7 أيام على تسجيل الحضور، التعديل متاح للادمن الرئيسي فقط';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER attendance_lock BEFORE INSERT OR UPDATE OR DELETE ON public.attendance_records
FOR EACH ROW EXECUTE FUNCTION public.enforce_attendance_lock();

CREATE OR REPLACE FUNCTION public.enforce_session_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_top_admin(auth.uid()) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW;
  END IF;
  IF OLD.submitted_at < now() - interval '7 days' THEN
    RAISE EXCEPTION 'الجلسة مقفلة بعد 7 أيام';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  NEW.submitted_at := OLD.submitted_at;
  RETURN NEW;
END $$;
CREATE TRIGGER session_lock BEFORE UPDATE OR DELETE ON public.attendance_sessions
FOR EACH ROW EXECUTE FUNCTION public.enforce_session_lock();

-- ========== REPORT FUNCTION ==========
CREATE OR REPLACE FUNCTION public.get_absence_report()
RETURNS TABLE (student_id uuid, full_name text, username text, college_id uuid, department_id uuid, stage int, section text,
  course_id uuid, course_code text, course_name text, total_hours numeric, absent_hours numeric, excused_hours numeric, absence_pct numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH agg AS (
    SELECT r.student_id, s.course_id,
      SUM(CASE WHEN r.status = 'absent' THEN s.hours ELSE 0 END) AS absent_hours,
      SUM(CASE WHEN r.status = 'excused' THEN s.hours ELSE 0 END) AS excused_hours
    FROM public.attendance_records r JOIN public.attendance_sessions s ON s.id = r.session_id
    GROUP BY r.student_id, s.course_id
  )
  SELECT p.id, p.full_name, p.username, p.college_id, p.department_id, p.stage, p.section,
    c.id, c.code, c.name,
    GREATEST((c.theoretical_hours + c.practical_hours) * c.semester_weeks, 1) AS total_hours,
    a.absent_hours, a.excused_hours,
    ROUND(a.absent_hours * 100.0 / GREATEST((c.theoretical_hours + c.practical_hours) * c.semester_weeks, 1), 2)
  FROM agg a JOIN public.profiles p ON p.id = a.student_id JOIN public.courses c ON c.id = a.course_id
  WHERE public.can_view_student(p.id)
     OR EXISTS (SELECT 1 FROM public.course_instructors ci WHERE ci.course_id = c.id AND ci.instructor_id = auth.uid())
$$;

-- ========== GRANTS ==========
GRANT SELECT ON public.colleges, public.departments, public.halls, public.profiles, public.user_roles,
  public.courses, public.course_instructors, public.timetable_slots, public.lectures, public.library_resources,
  public.role_permissions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.colleges, public.departments, public.halls, public.courses,
  public.course_instructors, public.timetable_slots, public.lectures, public.library_resources TO authenticated;
GRANT UPDATE ON public.role_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_sessions, public.attendance_records TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.messages TO authenticated;
GRANT UPDATE (read_at) ON public.messages TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.colleges, public.departments, public.halls, public.profiles, public.user_roles, public.qr_login_tokens,
  public.courses, public.course_instructors, public.timetable_slots, public.attendance_sessions, public.attendance_records,
  public.lectures, public.library_resources, public.messages, public.role_permissions, public.audit_logs, public.app_settings TO service_role;
GRANT EXECUTE ON FUNCTION public.get_absence_report() TO authenticated;

-- ========== RLS ==========
ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.halls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_login_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read colleges" ON public.colleges FOR SELECT TO authenticated USING (true);
CREATE POLICY "top admins write colleges" ON public.colleges FOR ALL TO authenticated
  USING (public.is_top_admin(auth.uid())) WITH CHECK (public.is_top_admin(auth.uid()));

CREATE POLICY "read departments" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage departments" ON public.departments FOR ALL TO authenticated
  USING (public.can_manage_college(college_id)) WITH CHECK (public.can_manage_college(college_id));

CREATE POLICY "read halls" ON public.halls FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage halls" ON public.halls FOR ALL TO authenticated
  USING (public.is_top_admin(auth.uid()) OR (college_id IS NOT NULL AND public.can_manage_college(college_id)))
  WITH CHECK (public.is_top_admin(auth.uid()) OR (college_id IS NOT NULL AND public.can_manage_college(college_id)));

CREATE POLICY "read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "read roles" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "read courses" ON public.courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage courses" ON public.courses FOR ALL TO authenticated
  USING (public.can_manage_department(department_id)) WITH CHECK (public.can_manage_department(department_id));

CREATE POLICY "read course instructors" ON public.course_instructors FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage course instructors" ON public.course_instructors FOR ALL TO authenticated
  USING (public.can_manage_department((SELECT department_id FROM public.courses WHERE id = course_id)))
  WITH CHECK (public.can_manage_department((SELECT department_id FROM public.courses WHERE id = course_id)));

CREATE POLICY "read timetable" ON public.timetable_slots FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage timetable" ON public.timetable_slots FOR ALL TO authenticated
  USING (public.can_manage_department(department_id)) WITH CHECK (public.can_manage_department(department_id));

CREATE POLICY "read sessions" ON public.attendance_sessions FOR SELECT TO authenticated USING (
  instructor_id = auth.uid() OR public.user_role(auth.uid()) IN ('system_admin','super_admin','college_admin','dept_admin','registrar')
  OR EXISTS (SELECT 1 FROM public.attendance_records r WHERE r.session_id = id AND r.student_id = auth.uid())
);
CREATE POLICY "instructors create sessions" ON public.attendance_sessions FOR INSERT TO authenticated WITH CHECK (
  public.is_top_admin(auth.uid())
  OR (instructor_id = auth.uid() AND EXISTS (SELECT 1 FROM public.timetable_slots t WHERE t.id = slot_id AND t.instructor_id = auth.uid()))
);
CREATE POLICY "instructors update sessions" ON public.attendance_sessions FOR UPDATE TO authenticated
  USING (instructor_id = auth.uid() OR public.is_top_admin(auth.uid()))
  WITH CHECK (instructor_id = auth.uid() OR public.is_top_admin(auth.uid()));
CREATE POLICY "top admins delete sessions" ON public.attendance_sessions FOR DELETE TO authenticated
  USING (public.is_top_admin(auth.uid()));

CREATE POLICY "read records" ON public.attendance_records FOR SELECT TO authenticated USING (
  student_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.attendance_sessions s WHERE s.id = session_id AND s.instructor_id = auth.uid())
  OR (public.user_role(auth.uid()) IN ('system_admin','super_admin','college_admin','dept_admin','registrar') AND public.can_view_student(student_id))
);
CREATE POLICY "write records" ON public.attendance_records FOR INSERT TO authenticated WITH CHECK (
  public.is_top_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.attendance_sessions s WHERE s.id = session_id AND s.instructor_id = auth.uid())
);
CREATE POLICY "update records" ON public.attendance_records FOR UPDATE TO authenticated
  USING (public.is_top_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.attendance_sessions s WHERE s.id = session_id AND s.instructor_id = auth.uid()))
  WITH CHECK (public.is_top_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.attendance_sessions s WHERE s.id = session_id AND s.instructor_id = auth.uid()));
CREATE POLICY "delete records" ON public.attendance_records FOR DELETE TO authenticated
  USING (public.is_top_admin(auth.uid()));

CREATE POLICY "read lectures" ON public.lectures FOR SELECT TO authenticated USING (true);
CREATE POLICY "upload lectures" ON public.lectures FOR INSERT TO authenticated WITH CHECK (
  instructor_id = auth.uid() AND (public.is_top_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.course_instructors ci WHERE ci.course_id = course_id AND ci.instructor_id = auth.uid()))
);
CREATE POLICY "delete lectures" ON public.lectures FOR DELETE TO authenticated
  USING (instructor_id = auth.uid() OR public.is_top_admin(auth.uid()));
CREATE POLICY "update lectures" ON public.lectures FOR UPDATE TO authenticated
  USING (instructor_id = auth.uid() OR public.is_top_admin(auth.uid()))
  WITH CHECK (instructor_id = auth.uid() OR public.is_top_admin(auth.uid()));

CREATE POLICY "read library" ON public.library_resources FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage library" ON public.library_resources FOR ALL TO authenticated
  USING (public.user_role(auth.uid()) IN ('system_admin','super_admin','college_admin','dept_admin'))
  WITH CHECK (public.user_role(auth.uid()) IN ('system_admin','super_admin','college_admin','dept_admin'));

CREATE POLICY "read own messages" ON public.messages FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY "send allowed messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.can_message(auth.uid(), receiver_id));
CREATE POLICY "mark read" ON public.messages FOR UPDATE TO authenticated
  USING (receiver_id = auth.uid()) WITH CHECK (receiver_id = auth.uid());
CREATE POLICY "delete own messages" ON public.messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "read permissions" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "top admins edit permissions" ON public.role_permissions FOR UPDATE TO authenticated
  USING (public.is_top_admin(auth.uid())) WITH CHECK (public.is_top_admin(auth.uid()));

CREATE POLICY "top admins read logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_top_admin(auth.uid()));
CREATE POLICY "write own logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

CREATE POLICY "read settings" ON public.app_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "top admins insert settings" ON public.app_settings FOR INSERT TO authenticated WITH CHECK (public.is_top_admin(auth.uid()));
CREATE POLICY "top admins update settings" ON public.app_settings FOR UPDATE TO authenticated
  USING (public.is_top_admin(auth.uid())) WITH CHECK (public.is_top_admin(auth.uid()));

-- ========== SEED ==========
INSERT INTO public.app_settings(key, value) VALUES ('university_name', 'الجامعة'), ('university_motto', 'نظام الإدارة الأكاديمية');

INSERT INTO public.role_permissions(role, feature, enabled)
SELECT r::public.app_role, f, true
FROM unnest(ARRAY['system_admin','super_admin','college_admin','dept_admin','instructor','student','registrar']) r,
     unnest(ARRAY['dashboard','users','structure','courses','timetable','attendance','warnings','lectures','library','messages','workload','reports']) f;
