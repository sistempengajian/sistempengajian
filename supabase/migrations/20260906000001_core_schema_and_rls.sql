-- ==============================================================================
-- SISTEM MANAJEMEN PENGAJIAN & PEMBINAAN GENERASI QUR'ANI
-- Migration: 20260906000001_core_schema_and_rls.sql
-- Blueprint Version: 2.0.0
-- Scope: RLS Helper Functions, Triggers & Multi-Tenant Scoped Security Policies
-- ==============================================================================

-- 1. HELPER FUNCTIONS FOR SCOPED RLS
-- ------------------------------------------------------------------------------

-- Get user's assigned organization
CREATE OR REPLACE FUNCTION public.get_user_organization_id(user_uuid UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT organization_id FROM public.users WHERE id = user_uuid;
$$;

-- Get list of roles for a user
CREATE OR REPLACE FUNCTION public.get_user_roles(user_uuid UUID)
RETURNS text[]
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(role::text), ARRAY[]::text[])
  FROM public.user_roles
  WHERE user_id = user_uuid;
$$;

-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.user_has_role(user_uuid UUID, check_role text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = user_uuid AND role::text = check_role
  );
$$;

-- Check if user is an admin or regional manager (PJ Daerah / Desa / Kelompok)
CREATE OR REPLACE FUNCTION public.user_is_manager(user_uuid UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = user_uuid AND role::text IN ('ADMIN_MASTER', 'PJ_DAERAH', 'PJ_DESA', 'PJ_KELOMPOK')
  );
$$;

-- Recursive query to retrieve all descendant organization IDs under a given root organization
CREATE OR REPLACE FUNCTION public.get_organization_subtree(root_org_id UUID)
RETURNS TABLE (id UUID)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH RECURSIVE org_tree AS (
    SELECT root_org_id AS org_id
    UNION ALL
    SELECT o.id
    FROM public.organizations o
    INNER JOIN org_tree ot ON o.parent_id = ot.org_id
  )
  SELECT org_id FROM org_tree;
$$;

-- Verify whether user can access a specific target organization based on their role and hierarchy
CREATE OR REPLACE FUNCTION public.user_can_access_organization(user_uuid UUID, target_org_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  user_org_id UUID;
  user_roles text[];
BEGIN
  -- Admin Master has global access
  IF public.user_has_role(user_uuid, 'ADMIN_MASTER') THEN
    RETURN TRUE;
  END IF;

  SELECT public.get_user_organization_id(user_uuid) INTO user_org_id;
  IF user_org_id IS NULL OR target_org_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Same organization is always accessible
  IF user_org_id = target_org_id THEN
    RETURN TRUE;
  END IF;

  user_roles := public.get_user_roles(user_uuid);

  -- PJ Daerah or PJ Desa can access descendants in their subtree
  IF 'PJ_DAERAH' = ANY(user_roles) OR 'PJ_DESA' = ANY(user_roles) THEN
    RETURN EXISTS (
      SELECT 1 FROM public.get_organization_subtree(user_org_id) WHERE id = target_org_id
    );
  END IF;

  RETURN FALSE;
END;
$$;

-- 2. ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_parent_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.material_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.assignment_parent_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.schedule_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.absence_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.material_checklist_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_gamification ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_badges ENABLE ROW LEVEL SECURITY;

-- 3. POLICIES: PUBLIC / LOOKUP TABLES
-- ------------------------------------------------------------------------------

-- Generations: Everyone can view active generations
DROP POLICY IF EXISTS "generations_read_all" ON public.generations;
CREATE POLICY "generations_read_all" ON public.generations
  FOR SELECT USING (true);

-- Badges: Everyone can view badge definitions
DROP POLICY IF EXISTS "badges_read_all" ON public.badges;
CREATE POLICY "badges_read_all" ON public.badges
  FOR SELECT USING (true);

-- 4. POLICIES: ORGANIZATIONS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "organizations_view_scoped" ON public.organizations;
CREATE POLICY "organizations_view_scoped" ON public.organizations
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      public.user_has_role(auth.uid(), 'ADMIN_MASTER') OR
      public.user_can_access_organization(auth.uid(), id) OR
      id = (SELECT organization_id FROM public.users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "organizations_manage_admin_pj" ON public.organizations;
CREATE POLICY "organizations_manage_admin_pj" ON public.organizations
  FOR ALL USING (
    auth.uid() IS NOT NULL AND (
      public.user_has_role(auth.uid(), 'ADMIN_MASTER') OR
      (public.user_has_role(auth.uid(), 'PJ_DAERAH') AND public.user_can_access_organization(auth.uid(), id))
    )
  );

-- 5. POLICIES: USERS & PROFILES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "users_view_own_or_scoped" ON public.users;
CREATE POLICY "users_view_own_or_scoped" ON public.users
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      id = auth.uid() OR
      public.user_has_role(auth.uid(), 'ADMIN_MASTER') OR
      -- Parents can view their children
      id IN (SELECT student_user_id FROM public.student_parent_relations WHERE parent_user_id = auth.uid()) OR
      -- Children can view their parents
      id IN (SELECT parent_user_id FROM public.student_parent_relations WHERE student_user_id = auth.uid()) OR
      -- Managers can view users within their organization subtree
      (organization_id IS NOT NULL AND public.user_can_access_organization(auth.uid(), organization_id))
    )
  );

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (
    auth.uid() = id OR
    public.user_has_role(auth.uid(), 'ADMIN_MASTER') OR
    (organization_id IS NOT NULL AND public.user_is_manager(auth.uid()) AND public.user_can_access_organization(auth.uid(), organization_id))
  );

-- 6. POLICIES: STUDENT PARENT RELATIONS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "student_parent_view" ON public.student_parent_relations;
CREATE POLICY "student_parent_view" ON public.student_parent_relations
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      parent_user_id = auth.uid() OR
      student_user_id = auth.uid() OR
      public.user_is_manager(auth.uid())
    )
  );

DROP POLICY IF EXISTS "student_parent_manage" ON public.student_parent_relations;
CREATE POLICY "student_parent_manage" ON public.student_parent_relations
  FOR ALL USING (
    auth.uid() IS NOT NULL AND public.user_is_manager(auth.uid())
  );

-- 7. POLICIES: CLASSES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "classes_view_scoped" ON public.classes;
CREATE POLICY "classes_view_scoped" ON public.classes
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      public.user_has_role(auth.uid(), 'ADMIN_MASTER') OR
      public.user_can_access_organization(auth.uid(), organization_id) OR
      homeroom_teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "classes_manage_manager" ON public.classes;
CREATE POLICY "classes_manage_manager" ON public.classes
  FOR ALL USING (
    auth.uid() IS NOT NULL AND (
      public.user_has_role(auth.uid(), 'ADMIN_MASTER') OR
      (public.user_is_manager(auth.uid()) AND public.user_can_access_organization(auth.uid(), organization_id))
    )
  );

-- 8. POLICIES: SCHEDULES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "schedules_view_scoped" ON public.schedules;
CREATE POLICY "schedules_view_scoped" ON public.schedules
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      public.user_has_role(auth.uid(), 'ADMIN_MASTER') OR
      public.user_can_access_organization(auth.uid(), organization_id)
    )
  );

DROP POLICY IF EXISTS "schedules_manage_teacher_pj" ON public.schedules;
CREATE POLICY "schedules_manage_teacher_pj" ON public.schedules
  FOR ALL USING (
    auth.uid() IS NOT NULL AND (
      public.user_has_role(auth.uid(), 'ADMIN_MASTER') OR
      (public.user_is_manager(auth.uid()) AND public.user_can_access_organization(auth.uid(), organization_id)) OR
      EXISTS (SELECT 1 FROM public.schedule_teachers WHERE schedule_id = id AND teacher_id = auth.uid())
    )
  );

-- 9. POLICIES: ATTENDANCE
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "attendance_sessions_view" ON public.attendance_sessions;
CREATE POLICY "attendance_sessions_view" ON public.attendance_sessions
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "attendance_records_view" ON public.attendance_records;
CREATE POLICY "attendance_records_view" ON public.attendance_records
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      student_id = auth.uid() OR
      -- Parents can view attendance of their children
      student_id IN (SELECT student_user_id FROM public.student_parent_relations WHERE parent_user_id = auth.uid()) OR
      -- Teachers & Managers
      public.user_has_role(auth.uid(), 'PENGAJAR') OR
      public.user_is_manager(auth.uid())
    )
  );

DROP POLICY IF EXISTS "attendance_records_insert_update" ON public.attendance_records;
CREATE POLICY "attendance_records_insert_update" ON public.attendance_records
  FOR ALL USING (
    auth.uid() IS NOT NULL AND (
      student_id = auth.uid() OR
      public.user_has_role(auth.uid(), 'PENGAJAR') OR
      public.user_is_manager(auth.uid())
    )
  );

-- 10. POLICIES: GAMIFICATION & BADGES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "gamification_view_all_authenticated" ON public.user_gamification;
CREATE POLICY "gamification_view_all_authenticated" ON public.user_gamification
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "gamification_update_system_only" ON public.user_gamification;
CREATE POLICY "gamification_update_system_only" ON public.user_gamification
  FOR ALL USING (
    auth.uid() IS NOT NULL AND (
      public.user_has_role(auth.uid(), 'ADMIN_MASTER') OR
      public.user_is_manager(auth.uid())
    )
  );

DROP POLICY IF EXISTS "student_badges_view_all" ON public.student_badges;
CREATE POLICY "student_badges_view_all" ON public.student_badges
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 11. POLICIES: AUDIT LOGS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "audit_logs_read_managers" ON public.audit_logs;
CREATE POLICY "audit_logs_read_managers" ON public.audit_logs
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      public.user_has_role(auth.uid(), 'ADMIN_MASTER') OR
      public.user_has_role(auth.uid(), 'PJ_DAERAH')
    )
  );
