ALTER TABLE public.colleges
  ADD COLUMN IF NOT EXISTS study_system text NOT NULL DEFAULT 'bologna',
  ADD COLUMN IF NOT EXISTS dean_name text,
  ADD COLUMN IF NOT EXISTS shift text NOT NULL DEFAULT 'morning',
  ADD COLUMN IF NOT EXISTS established_year int,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS study_system text NOT NULL DEFAULT 'bologna',
  ADD COLUMN IF NOT EXISTS head_name text,
  ADD COLUMN IF NOT EXISTS degree text NOT NULL DEFAULT 'bachelor',
  ADD COLUMN IF NOT EXISTS shift text NOT NULL DEFAULT 'morning',
  ADD COLUMN IF NOT EXISTS total_credits int,
  ADD COLUMN IF NOT EXISTS established_year int,
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE public.halls
  ADD COLUMN IF NOT EXISTS hall_type text NOT NULL DEFAULT 'classroom',
  ADD COLUMN IF NOT EXISTS building text;

CREATE TABLE public.timetables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  stage int NOT NULL,
  section text,
  shift text NOT NULL DEFAULT 'morning' CHECK (shift IN ('morning','evening')),
  academic_year text,
  semester text,
  title text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.timetables TO authenticated;
GRANT ALL ON public.timetables TO service_role;
ALTER TABLE public.timetables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read timetables" ON public.timetables FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage timetables" ON public.timetables FOR ALL TO authenticated
  USING (public.can_manage_department(department_id)) WITH CHECK (public.can_manage_department(department_id));

ALTER TABLE public.timetable_slots
  ADD COLUMN IF NOT EXISTS timetable_id uuid REFERENCES public.timetables(id) ON DELETE CASCADE;

ALTER TABLE public.lectures
  ADD COLUMN IF NOT EXISTS session_type text NOT NULL DEFAULT 'theory' CHECK (session_type IN ('theory','practical'));