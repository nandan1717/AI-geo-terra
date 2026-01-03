-- SECURE FUNCTION: Delete Own Account
-- Allows an authenticated user to delete their own account from auth.users.
-- This requires SECURITY DEFINER to access auth.users, but we STRICTLY limit it to the calling user.

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void AS $$
BEGIN
  -- SAFETY CHECK: Ensure the user is actually logged in
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. DELETE DEPENDENCIES (manual cascade for tables causing constraint violations)
  
  -- Feedback (references user_id)
  DELETE FROM public.app_feedback WHERE user_id = auth.uid();

  -- Support Messages (references sessions which are about to be deleted)
  -- We delete sessions, but messages rely on them, so we might need to clear them if cascade isn't there.
  -- Based on the schema, support_messages references support_sessions(id). 
  -- We should delete support_sessions, but if that lacks cascade, we delete messages first.
  DELETE FROM public.support_messages 
  WHERE session_id IN (SELECT id FROM public.support_sessions WHERE user_id = auth.uid());

  -- Support Sessions (references user_id)
  DELETE FROM public.support_sessions WHERE user_id = auth.uid();

  -- Notifications (references user_id)
  DELETE FROM public.notifications WHERE user_id = auth.uid();

  -- 2. EXECUTE ACCOUNT DELETION
  -- Because of ON DELETE CASCADE on app_profiles_v2 and other tables,
  -- deleting from auth.users will clean up mostly everything else.
  DELETE FROM auth.users
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
