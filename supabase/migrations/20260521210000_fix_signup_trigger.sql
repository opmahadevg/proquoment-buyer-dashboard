-- ============================================================
-- FIX: "Database error saving new user"
-- ============================================================
-- Root cause: The handle_new_user trigger on auth.users was
-- failing because user_profiles / user_role ENUM may not exist
-- in the shared admin DB. Any trigger failure on auth.users
-- returns "Database error saving new user" to the client.
--
-- Fix: Make ALL auth.users triggers fault-tolerant using
-- BEGIN...EXCEPTION WHEN OTHERS THEN NULL so they never block
-- signups. Also drop the on_buyer_signup trigger if the
-- buyer_profiles / notifications tables are not fully set up yet.
-- ============================================================

-- ── 1. FIX: make handle_new_user fault-tolerant ─────────────
-- If user_profiles or user_role ENUM don't exist in this DB,
-- the trigger fails silently instead of blocking signup.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only attempt if user_profiles table exists in this DB
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ) THEN
    BEGIN
      INSERT INTO public.user_profiles (id, email, full_name, avatar_url, role)
      VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
        COALESCE(NEW.raw_user_meta_data->>'role', 'buyer')::text
      )
      ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      -- user_profiles insert failed (ENUM mismatch, constraint, etc.)
      -- Log but never block signup
      RAISE WARNING 'handle_new_user: skipped user_profiles insert: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

-- ── 2. FIX: make handle_new_buyer_signup fault-tolerant ─────
-- Wraps every DB call in its own exception block so a missing
-- buyer_profiles table or notifications.buyer_id column never
-- blocks user creation.

CREATE OR REPLACE FUNCTION public.handle_new_buyer_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Try to create blank buyer_profiles row
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'buyer_profiles'
    ) THEN
      INSERT INTO buyer_profiles (id, email, verification_status)
      VALUES (NEW.id::uuid, NEW.email, 'pending')
      ON CONFLICT (id) DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_buyer_signup: buyer_profiles insert skipped: %', SQLERRM;
  END;

  -- Try to send welcome notification
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'notifications'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name  = 'notifications'
        AND column_name = 'buyer_id'
    ) THEN
      INSERT INTO notifications
        (target_dashboard, type, title, message, buyer_id, read)
      VALUES (
        'buyer',
        'admin_announcement',
        'Welcome to Proquoment! 🎉',
        'Your account is active. Submit your first RFQ to start sourcing from verified global suppliers.',
        NEW.id::uuid,
        false
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_buyer_signup: notifications insert skipped: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Ensure trigger exists (idempotent)
DROP TRIGGER IF EXISTS on_buyer_signup ON auth.users;
CREATE TRIGGER on_buyer_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_buyer_signup();

-- Ensure original trigger still exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
