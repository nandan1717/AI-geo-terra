-- Migration to add missing foreign key indexes
-- Fixes "Unindexed foreign keys" performance warnings

-- 1. app_comments
CREATE INDEX IF NOT EXISTS idx_app_comments_post_id ON public.app_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_app_comments_user_id ON public.app_comments(user_id);

-- 2. app_connections_v2
CREATE INDEX IF NOT EXISTS idx_app_connections_v2_target_id ON public.app_connections_v2(target_id);

-- 3. app_feedback
CREATE INDEX IF NOT EXISTS idx_app_feedback_session_id ON public.app_feedback(session_id);
CREATE INDEX IF NOT EXISTS idx_app_feedback_user_id ON public.app_feedback(user_id);

-- 4. app_likes
CREATE INDEX IF NOT EXISTS idx_app_likes_user_id ON public.app_likes(user_id);

-- 5. app_posts
CREATE INDEX IF NOT EXISTS idx_app_posts_user_id ON public.app_posts(user_id);

-- 6. chat_messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON public.chat_messages(user_id);

-- 7. direct_messages
CREATE INDEX IF NOT EXISTS idx_direct_messages_connection_id ON public.direct_messages(connection_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_id ON public.direct_messages(sender_id);

-- 8. support_messages
CREATE INDEX IF NOT EXISTS idx_support_messages_session_id ON public.support_messages(session_id);

-- 9. support_sessions
CREATE INDEX IF NOT EXISTS idx_support_sessions_user_id ON public.support_sessions(user_id);
