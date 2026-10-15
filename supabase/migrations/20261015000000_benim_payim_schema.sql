-- ==============================================================================
-- Benim Payım — Supabase PostgreSQL Schema & RLS Policies (Idempotent)
-- Migration: 20261015000000_benim_payim_schema.sql
-- ==============================================================================

-- 1. EXTENSIONS & HELPER FUNCTIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION set_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. TABLES

-- A. learning_sessions
CREATE TABLE IF NOT EXISTS public.learning_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    topic TEXT,
    goal TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
    current_notes TEXT NOT NULL DEFAULT '',
    current_code TEXT NOT NULL DEFAULT '',
    language TEXT NOT NULL DEFAULT 'python',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- B. session_entries (Drafts and immutable saved attempts)
CREATE TABLE IF NOT EXISTS public.session_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.learning_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('draft', 'saved_attempt')),
    notes TEXT NOT NULL DEFAULT '',
    code TEXT NOT NULL DEFAULT '',
    language TEXT NOT NULL DEFAULT 'python',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- C. help_requests (3 AI help modes: hint, explain, example_solution)
CREATE TABLE IF NOT EXISTS public.help_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.learning_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('hint', 'explain', 'example_solution')),
    source_entry_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    request_status TEXT NOT NULL DEFAULT 'completed' CHECK (request_status IN ('completed', 'failed')),
    validated_response JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- D. learning_checks (One single check per session)
CREATE TABLE IF NOT EXISTS public.learning_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.learning_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    question_type TEXT NOT NULL,
    question TEXT NOT NULL,
    evaluation_criteria TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped', 'failed_ai')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_learning_checks_session UNIQUE (session_id)
);

-- E. check_attempts (User response and verified feedback)
CREATE TABLE IF NOT EXISTS public.check_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    check_id UUID NOT NULL REFERENCES public.learning_checks(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES public.learning_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    response TEXT NOT NULL,
    used_help BOOLEAN NOT NULL DEFAULT false,
    feedback JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- F. learning_cards (One single card per session)
CREATE TABLE IF NOT EXISTS public.learning_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.learning_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    ai_draft JSONB NOT NULL,
    source_references JSONB NOT NULL DEFAULT '[]'::jsonb,
    user_edits JSONB NOT NULL DEFAULT '{}'::jsonb,
    user_note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_learning_cards_session UNIQUE (session_id)
);

-- 3. TRIGGERS
DROP TRIGGER IF EXISTS trg_learning_sessions_updated_at ON public.learning_sessions;
CREATE TRIGGER trg_learning_sessions_updated_at
    BEFORE UPDATE ON public.learning_sessions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();

DROP TRIGGER IF EXISTS trg_learning_cards_updated_at ON public.learning_cards;
CREATE TRIGGER trg_learning_cards_updated_at
    BEFORE UPDATE ON public.learning_cards
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();

-- 4. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.learning_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON public.learning_sessions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_entries_session_id ON public.session_entries(session_id);
CREATE INDEX IF NOT EXISTS idx_entries_user_id ON public.session_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_entries_type ON public.session_entries(entry_type);

CREATE INDEX IF NOT EXISTS idx_help_session_id ON public.help_requests(session_id);
CREATE INDEX IF NOT EXISTS idx_help_user_id ON public.help_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_checks_session_id ON public.learning_checks(session_id);
CREATE INDEX IF NOT EXISTS idx_checks_user_id ON public.learning_checks(user_id);

CREATE INDEX IF NOT EXISTS idx_check_attempts_check_id ON public.check_attempts(check_id);
CREATE INDEX IF NOT EXISTS idx_check_attempts_session_id ON public.check_attempts(session_id);
CREATE INDEX IF NOT EXISTS idx_check_attempts_user_id ON public.check_attempts(user_id);

CREATE INDEX IF NOT EXISTS idx_cards_session_id ON public.learning_cards(session_id);
CREATE INDEX IF NOT EXISTS idx_cards_user_id ON public.learning_cards(user_id);

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- Idempotent: Her politikanın öncesinde 'DROP POLICY IF EXISTS' çalıştırılır.

-- Enable RLS on all tables
ALTER TABLE public.learning_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_cards ENABLE ROW LEVEL SECURITY;

-- learning_sessions RLS
DROP POLICY IF EXISTS sessions_select ON public.learning_sessions;
CREATE POLICY sessions_select ON public.learning_sessions
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS sessions_insert ON public.learning_sessions;
CREATE POLICY sessions_insert ON public.learning_sessions
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS sessions_update ON public.learning_sessions;
CREATE POLICY sessions_update ON public.learning_sessions
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS sessions_delete ON public.learning_sessions;
CREATE POLICY sessions_delete ON public.learning_sessions
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- session_entries RLS
DROP POLICY IF EXISTS entries_select ON public.session_entries;
CREATE POLICY entries_select ON public.session_entries
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS entries_insert ON public.session_entries;
CREATE POLICY entries_insert ON public.session_entries
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.learning_sessions s
            WHERE s.id = session_id AND s.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS entries_update ON public.session_entries;
CREATE POLICY entries_update ON public.session_entries
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.learning_sessions s
            WHERE s.id = session_id AND s.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS entries_delete ON public.session_entries;
CREATE POLICY entries_delete ON public.session_entries
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- help_requests RLS
DROP POLICY IF EXISTS help_select ON public.help_requests;
CREATE POLICY help_select ON public.help_requests
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS help_insert ON public.help_requests;
CREATE POLICY help_insert ON public.help_requests
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.learning_sessions s
            WHERE s.id = session_id AND s.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS help_delete ON public.help_requests;
CREATE POLICY help_delete ON public.help_requests
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- learning_checks RLS
DROP POLICY IF EXISTS checks_select ON public.learning_checks;
CREATE POLICY checks_select ON public.learning_checks
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS checks_insert ON public.learning_checks;
CREATE POLICY checks_insert ON public.learning_checks
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.learning_sessions s
            WHERE s.id = session_id AND s.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS checks_update ON public.learning_checks;
CREATE POLICY checks_update ON public.learning_checks
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.learning_sessions s
            WHERE s.id = session_id AND s.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS checks_delete ON public.learning_checks;
CREATE POLICY checks_delete ON public.learning_checks
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- check_attempts RLS
DROP POLICY IF EXISTS check_attempts_select ON public.check_attempts;
CREATE POLICY check_attempts_select ON public.check_attempts
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS check_attempts_insert ON public.check_attempts;
CREATE POLICY check_attempts_insert ON public.check_attempts
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.learning_sessions s
            WHERE s.id = session_id AND s.user_id = auth.uid()
        ) AND
        EXISTS (
            SELECT 1 FROM public.learning_checks c
            WHERE c.id = check_id AND c.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS check_attempts_delete ON public.check_attempts;
CREATE POLICY check_attempts_delete ON public.check_attempts
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- learning_cards RLS
DROP POLICY IF EXISTS cards_select ON public.learning_cards;
CREATE POLICY cards_select ON public.learning_cards
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS cards_insert ON public.learning_cards;
CREATE POLICY cards_insert ON public.learning_cards
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.learning_sessions s
            WHERE s.id = session_id AND s.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS cards_update ON public.learning_cards;
CREATE POLICY cards_update ON public.learning_cards
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.learning_sessions s
            WHERE s.id = session_id AND s.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS cards_delete ON public.learning_cards;
CREATE POLICY cards_delete ON public.learning_cards
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);
