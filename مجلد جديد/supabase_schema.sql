-- =========================================================================
-- PRODUCTION-READY SQL MIGRATION SCRIPT FOR SUPABASE
-- Project: Enterprise Multi-Tenant Attendance and Shift Management System
-- Highlights: Complete multi-tenant isolation, RLS, & Composite Constraints.
-- =========================================================================

-- 1. TENANT PROFILES TABLE
-- Links authenticated users to their corresponding corporate tenant profile.
CREATE TABLE IF NOT EXISTS public.tenant_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.tenant_profiles ENABLE ROW LEVEL SECURITY;

-- 2. SHIFT SCHEDULES TABLE (الورديات / أوقات الدوام)
-- Defines operational shift boundaries (single and dual shifts).
CREATE TABLE IF NOT EXISTS public.shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('single', 'dual')),
    
    -- Shift 1 Boundaries
    shift1_start TIME NOT NULL,
    shift1_end TIME NOT NULL,
    
    -- Shift 2 Boundaries (Nullable for single shifts)
    shift2_start TIME,
    shift2_end TIME,
    
    -- Calculation parameters
    grace_minutes INTEGER DEFAULT 15 NOT NULL CHECK (grace_minutes >= 0),
    overtime_threshold_minutes INTEGER DEFAULT 30 NOT NULL CHECK (overtime_threshold_minutes >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

-- 3. EMPLOYEES TABLE (الموظفون)
-- Stores corporate employees under a specific tenant.
-- Key constraint: UNIQUE (user_id, emp_id) to allow overlapping sequential Employee IDs between tenants.
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    emp_id VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    department VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    shift_schedule_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
    is_dual_shift BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Multi-tenant compound uniqueness constraint
    CONSTRAINT unique_tenant_emp_id UNIQUE (user_id, emp_id)
);

-- Enable RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- 4. ATTENDANCE LOGS TABLE (سجل الحضور والانصراف اليومي)
-- Tracks daily check-in and check-out timestamps for Shift 1 and Shift 2.
-- Key constraint: UNIQUE (user_id, employee_id, date) to enforce a single record per employee per day.
CREATE TABLE IF NOT EXISTS public.attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- Shift 1 Timestamps
    shift1_check_in TIME,
    shift1_check_out TIME,
    
    -- Shift 2 Timestamps
    shift2_check_in TIME,
    shift2_check_out TIME,
    
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Enforce unique log per employee, per tenant, per day
    CONSTRAINT unique_tenant_employee_daily_log UNIQUE (user_id, employee_id, date)
);

-- Enable RLS
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;


-- =========================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES FOR SECURE MULTI-TENANCY
-- Ensure all database mutations are locked down strictly to the user's ID.
-- =========================================================================

-- TENANT PROFILES POLICIES
CREATE POLICY "Tenants can view their own profile" 
    ON public.tenant_profiles FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "Tenants can update their own profile" 
    ON public.tenant_profiles FOR UPDATE 
    USING (auth.uid() = id);

CREATE POLICY "Tenants can insert their own profile" 
    ON public.tenant_profiles FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- SHIFT SCHEDULES POLICIES
CREATE POLICY "Tenants can manage their own shifts" 
    ON public.shifts FOR ALL 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- EMPLOYEES POLICIES
CREATE POLICY "Tenants can manage their own employees" 
    ON public.employees FOR ALL 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ATTENDANCE LOGS POLICIES
CREATE POLICY "Tenants can manage their own attendance logs" 
    ON public.attendance_logs FOR ALL 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);


-- =========================================================================
-- REALTIME SYNCHRONIZATION CONFIGURATION
-- Enables Supabase Realtime listeners on attendance tables.
-- =========================================================================

-- Add tables to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.shifts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.employees;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_logs;
