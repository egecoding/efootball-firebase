-- ============================================================
-- eFootball Tournament App — Full Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      TEXT UNIQUE NOT NULL,
  display_name  TEXT,
  avatar_url    TEXT,
  wins          INTEGER NOT NULL DEFAULT 0,
  losses        INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Atomic win/loss increment functions
CREATE OR REPLACE FUNCTION public.increment_wins(uid UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.profiles SET wins = wins + 1 WHERE id = uid;
$$;

CREATE OR REPLACE FUNCTION public.increment_losses(uid UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.profiles SET losses = losses + 1 WHERE id = uid;
$$;

-- ============================================================
-- TOURNAMENTS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.tournament_status AS ENUM ('draft', 'open', 'in_progress', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.tournaments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT,
  game_name         TEXT NOT NULL DEFAULT 'eFootball',
  max_participants  INTEGER NOT NULL DEFAULT 8 CHECK (max_participants IN (4, 8, 16, 32)),
  format            TEXT NOT NULL DEFAULT 'knockout' CHECK (format IN ('knockout', 'round_robin', 'league')),
  status            public.tournament_status NOT NULL DEFAULT 'open',
  invite_code       TEXT UNIQUE NOT NULL DEFAULT upper(substring(encode(gen_random_bytes(6), 'base64'), 1, 8)),
  is_public         BOOLEAN NOT NULL DEFAULT true,
  starts_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration: add format column to existing databases
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS format TEXT NOT NULL DEFAULT 'knockout'
    CHECK (format IN ('knockout', 'round_robin', 'league'));

CREATE INDEX IF NOT EXISTS idx_tournaments_organizer   ON public.tournaments(organizer_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_status      ON public.tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_invite_code ON public.tournaments(invite_code);
CREATE INDEX IF NOT EXISTS idx_tournaments_is_public   ON public.tournaments(is_public);
CREATE INDEX IF NOT EXISTS idx_tournaments_search      ON public.tournaments
  USING GIN (to_tsvector('english', title || ' ' || COALESCE(description, '')));

DROP TRIGGER IF EXISTS tournaments_updated_at ON public.tournaments;
CREATE TRIGGER tournaments_updated_at
  BEFORE UPDATE ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- PARTICIPANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.participants (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id  UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id        UUID REFERENCES public.profiles(id) ON DELETE CASCADE,  -- NULL for guest/offline players
  name           TEXT,                                                     -- display name for guests
  seed           INTEGER,
  joined_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT participants_has_identity CHECK (user_id IS NOT NULL OR name IS NOT NULL)
);

-- Unique per registered user per tournament (guests have NULL user_id so no unique conflict)
CREATE UNIQUE INDEX IF NOT EXISTS participants_tournament_user_unique
  ON public.participants(tournament_id, user_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_participants_tournament ON public.participants(tournament_id);
CREATE INDEX IF NOT EXISTS idx_participants_user       ON public.participants(user_id);

-- ============================================================
-- ROUNDS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rounds (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id  UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round_number   INTEGER NOT NULL,
  round_name     TEXT NOT NULL,
  UNIQUE(tournament_id, round_number)
);

CREATE INDEX IF NOT EXISTS idx_rounds_tournament ON public.rounds(tournament_id);

-- ============================================================
-- MATCHES
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.match_status AS ENUM ('pending', 'scheduled', 'awaiting_confirmation', 'completed', 'walkover');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.matches (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id    UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round_id         UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  match_number     INTEGER NOT NULL,
  player1_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  player2_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  player1_score    INTEGER,
  player2_score    INTEGER,
  winner_id        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status           public.match_status NOT NULL DEFAULT 'pending',
  player1_name     TEXT,  -- display name for guest player 1 (when player1_id is NULL)
  player2_name     TEXT,  -- display name for guest player 2 (when player2_id is NULL)
  screenshot_url   TEXT,
  submitted_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  next_match_id    UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  next_match_slot  INTEGER CHECK (next_match_slot IN (1, 2)),
  played_at        TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_tournament ON public.matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_matches_round      ON public.matches(round_id);
CREATE INDEX IF NOT EXISTS idx_matches_player1    ON public.matches(player1_id);
CREATE INDEX IF NOT EXISTS idx_matches_player2    ON public.matches(player2_id);
CREATE INDEX IF NOT EXISTS idx_matches_winner     ON public.matches(winner_id);
CREATE INDEX IF NOT EXISTS idx_matches_next       ON public.matches(next_match_id);

DROP TRIGGER IF EXISTS matches_updated_at ON public.matches;
CREATE TRIGGER matches_updated_at
  BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- RESULT SUBMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.result_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id        UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  submitted_by    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  player1_score   INTEGER NOT NULL,
  player2_score   INTEGER NOT NULL,
  screenshot_url  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(match_id, submitted_by)
);

CREATE INDEX IF NOT EXISTS idx_result_submissions_match ON public.result_submissions(match_id);

-- ============================================================
-- GRANTS (required for newer Supabase projects that don't auto-grant)
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT                         ON public.profiles           TO anon, authenticated;
GRANT INSERT, UPDATE                 ON public.profiles           TO authenticated;

GRANT SELECT                         ON public.tournaments        TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE         ON public.tournaments        TO authenticated;

GRANT SELECT                         ON public.participants       TO anon, authenticated;
GRANT INSERT, DELETE                 ON public.participants       TO authenticated;

GRANT SELECT                         ON public.rounds             TO anon, authenticated;
GRANT INSERT                         ON public.rounds             TO authenticated;

GRANT SELECT                         ON public.matches            TO anon, authenticated;
GRANT INSERT, UPDATE                 ON public.matches            TO authenticated;

GRANT SELECT                         ON public.result_submissions TO anon, authenticated;
GRANT INSERT, UPDATE                 ON public.result_submissions TO authenticated;

-- Grant execute on helper functions
GRANT EXECUTE ON FUNCTION public.increment_wins(UUID)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_losses(UUID)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.tournament_is_visible(UUID) TO authenticated, anon;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.result_submissions ENABLE ROW LEVEL SECURITY;

-- Helper: check tournament visibility WITHOUT going through RLS (SECURITY DEFINER
-- bypasses RLS so participants_select can call this without causing infinite recursion
-- with tournaments_select which itself queries participants).
CREATE OR REPLACE FUNCTION public.tournament_is_visible(tid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT is_public OR organizer_id = auth.uid()
     FROM public.tournaments WHERE id = tid),
    false
  );
$$;

-- PROFILES
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- TOURNAMENTS
DROP POLICY IF EXISTS "tournaments_select_public" ON public.tournaments;
CREATE POLICY "tournaments_select_public"
  ON public.tournaments FOR SELECT
  USING (
    is_public = true
    OR organizer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.participants p
      WHERE p.tournament_id = tournaments.id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "tournaments_insert_auth" ON public.tournaments;
CREATE POLICY "tournaments_insert_auth"
  ON public.tournaments FOR INSERT
  WITH CHECK (auth.uid() = organizer_id);

DROP POLICY IF EXISTS "tournaments_update_organizer" ON public.tournaments;
CREATE POLICY "tournaments_update_organizer"
  ON public.tournaments FOR UPDATE
  USING (auth.uid() = organizer_id);

DROP POLICY IF EXISTS "tournaments_delete_organizer" ON public.tournaments;
CREATE POLICY "tournaments_delete_organizer"
  ON public.tournaments FOR DELETE
  USING (auth.uid() = organizer_id);

-- PARTICIPANTS
DROP POLICY IF EXISTS "participants_select" ON public.participants;
CREATE POLICY "participants_select"
  ON public.participants FOR SELECT
  USING (
    -- Own participation always visible
    user_id = auth.uid()
    -- Public tournament or organizer — uses SECURITY DEFINER to avoid circular RLS
    -- (tournaments_select queries participants; participants must NOT query tournaments via RLS)
    OR public.tournament_is_visible(tournament_id)
  );

DROP POLICY IF EXISTS "participants_insert_self" ON public.participants;
CREATE POLICY "participants_insert_self"
  ON public.participants FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id
        AND t.status = 'open'
        AND (
          SELECT COUNT(*) FROM public.participants p
          WHERE p.tournament_id = t.id
        ) < t.max_participants
    )
  );

-- Organizer can add any user as participant
DROP POLICY IF EXISTS "participants_insert_organizer" ON public.participants;
CREATE POLICY "participants_insert_organizer"
  ON public.participants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id
        AND t.organizer_id = auth.uid()
        AND t.status = 'open'
        AND (
          SELECT COUNT(*) FROM public.participants p
          WHERE p.tournament_id = t.id
        ) < t.max_participants
    )
  );

-- Anyone with a valid invite link can join as a guest (no account needed)
DROP POLICY IF EXISTS "participants_insert_guest" ON public.participants;
CREATE POLICY "participants_insert_guest"
  ON public.participants FOR INSERT
  WITH CHECK (
    user_id IS NULL
    AND name IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id
        AND t.status = 'open'
        AND (
          SELECT COUNT(*) FROM public.participants p
          WHERE p.tournament_id = t.id
        ) < t.max_participants
    )
  );

DROP POLICY IF EXISTS "participants_delete_self_or_organizer" ON public.participants;
CREATE POLICY "participants_delete_self_or_organizer"
  ON public.participants FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id AND t.organizer_id = auth.uid()
    )
  );

-- ROUNDS
DROP POLICY IF EXISTS "rounds_select" ON public.rounds;
CREATE POLICY "rounds_select"
  ON public.rounds FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id
        AND (
          t.is_public = true
          OR t.organizer_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.participants p
            WHERE p.tournament_id = t.id AND p.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "rounds_insert_organizer" ON public.rounds;
CREATE POLICY "rounds_insert_organizer"
  ON public.rounds FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id AND t.organizer_id = auth.uid()
    )
  );

-- MATCHES
DROP POLICY IF EXISTS "matches_select" ON public.matches;
CREATE POLICY "matches_select"
  ON public.matches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id
        AND (
          t.is_public = true
          OR t.organizer_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.participants p
            WHERE p.tournament_id = t.id AND p.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "matches_insert_organizer" ON public.matches;
CREATE POLICY "matches_insert_organizer"
  ON public.matches FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id AND t.organizer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "matches_update_players_organizer" ON public.matches;
CREATE POLICY "matches_update_players_organizer"
  ON public.matches FOR UPDATE
  USING (
    player1_id = auth.uid()
    OR player2_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id AND t.organizer_id = auth.uid()
    )
  );

-- RESULT SUBMISSIONS
DROP POLICY IF EXISTS "result_submissions_select" ON public.result_submissions;
CREATE POLICY "result_submissions_select"
  ON public.result_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND (
          m.player1_id = auth.uid()
          OR m.player2_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.tournaments t
            WHERE t.id = m.tournament_id AND t.organizer_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "result_submissions_insert" ON public.result_submissions;
CREATE POLICY "result_submissions_insert"
  ON public.result_submissions FOR INSERT
  WITH CHECK (
    submitted_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND (m.player1_id = auth.uid() OR m.player2_id = auth.uid())
        AND m.status IN ('scheduled', 'awaiting_confirmation')
    )
  );

DROP POLICY IF EXISTS "result_submissions_update_own" ON public.result_submissions;
CREATE POLICY "result_submissions_update_own"
  ON public.result_submissions FOR UPDATE
  USING (submitted_by = auth.uid());

-- ============================================================
-- STORAGE BUCKETS
-- Run this section separately if it fails (storage schema may need separate tx)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'screenshots',
  'screenshots',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS — avatars
DROP POLICY IF EXISTS "avatars_select_public" ON storage.objects;
CREATE POLICY "avatars_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage RLS — screenshots
DROP POLICY IF EXISTS "screenshots_select_auth" ON storage.objects;
CREATE POLICY "screenshots_select_auth"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'screenshots'
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "screenshots_insert_own" ON storage.objects;
CREATE POLICY "screenshots_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'screenshots'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
