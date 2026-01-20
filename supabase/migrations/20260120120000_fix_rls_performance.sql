-- Migration to fix RLS performance issues
-- Supersedes previous policies with optimized versions using (select auth.uid())

-- 1. chat_sessions
drop policy if exists "Users can view own sessions" on public.chat_sessions;
create policy "Users can view own sessions" on public.chat_sessions
  for select using ( (select auth.uid()) = user_id );

drop policy if exists "Users can insert own sessions" on public.chat_sessions;
create policy "Users can insert own sessions" on public.chat_sessions
  for insert with check ( (select auth.uid()) = user_id );

drop policy if exists "Users can update own sessions" on public.chat_sessions;
create policy "Users can update own sessions" on public.chat_sessions
  for update using ( (select auth.uid()) = user_id );

drop policy if exists "Users can delete own sessions" on public.chat_sessions;
create policy "Users can delete own sessions" on public.chat_sessions
  for delete using ( (select auth.uid()) = user_id );

-- 2. chat_messages
drop policy if exists "Users can view own messages" on public.chat_messages;
create policy "Users can view own messages" on public.chat_messages
  for select using ( (select auth.uid()) = user_id );

drop policy if exists "Users can insert own messages" on public.chat_messages;
create policy "Users can insert own messages" on public.chat_messages
  for insert with check ( (select auth.uid()) = user_id );

-- 3. search_history
drop policy if exists "Users can view own search history" on public.search_history;
create policy "Users can view own search history" on public.search_history
  for select using ( (select auth.uid()) = user_id );

drop policy if exists "Users can insert own search history" on public.search_history;
create policy "Users can insert own search history" on public.search_history
  for insert with check ( (select auth.uid()) = user_id );

-- 4. app_profiles_v2 (Performance + Combine Policies)
-- Drop the split policies
drop policy if exists "Public profiles are viewable by everyone" on public.app_profiles_v2;
drop policy if exists "Private profiles are viewable by connections" on public.app_profiles_v2;

-- Create combined policy
create policy "Profiles are viewable by appropriate users"
  on public.app_profiles_v2 for select
  using (
    is_private = false 
    or 
    (
      is_private = true and (
        (select auth.uid())::uuid = id or
        exists (
          select 1 from public.app_connections_v2 c 
          where (c.requester_id = (select auth.uid())::uuid and c.target_id = app_profiles_v2.id and c.status = 'accepted')
             or (c.requester_id = app_profiles_v2.id and c.target_id = (select auth.uid())::uuid and c.status = 'accepted')
        )
      )
    )
  );

-- Fix other profile policies
drop policy if exists "Users can update own profile" on public.app_profiles_v2;
create policy "Users can update own profile" on public.app_profiles_v2
  for update using ( (select auth.uid())::uuid = id );

drop policy if exists "Users can insert own profile" on public.app_profiles_v2;
create policy "Users can insert own profile" on public.app_profiles_v2
  for insert with check ( (select auth.uid())::uuid = id );


-- 5. app_connections_v2
drop policy if exists "Users can view their own connections" on public.app_connections_v2;
create policy "Users can view their own connections" on public.app_connections_v2
  for select using ( (select auth.uid())::uuid = requester_id or (select auth.uid())::uuid = target_id );

drop policy if exists "Users can create connection requests" on public.app_connections_v2;
create policy "Users can create connection requests" on public.app_connections_v2
  for insert with check ( (select auth.uid())::uuid = requester_id );

drop policy if exists "Users can update connection status" on public.app_connections_v2;
create policy "Users can update connection status" on public.app_connections_v2
  for update using ( (select auth.uid())::uuid = target_id );


-- 6. direct_messages (Assumes sender_id and receiver_id columns based on standard practice)
-- Note: Verification of exact column names was skipped as the source file was not found.
drop policy if exists "Users can view messages in their connections" on public.direct_messages;
create policy "Users can view messages in their connections" on public.direct_messages
  for select using ( 
    exists (
      select 1 from public.app_connections_v2 c
      where c.id = connection_id
      and ( c.requester_id = (select auth.uid())::uuid or c.target_id = (select auth.uid())::uuid )
    )
  );

drop policy if exists "Users can insert messages in their accepted connections" on public.direct_messages;
create policy "Users can insert messages in their accepted connections" on public.direct_messages
  for insert with check ( 
    sender_id = (select auth.uid())::uuid
    and exists (
      select 1 from public.app_connections_v2 c
      where c.id = connection_id
      and c.status = 'accepted'
      and ( c.requester_id = (select auth.uid())::uuid or c.target_id = (select auth.uid())::uuid )
    )
  );

-- 7. app_posts
drop policy if exists "Users can create posts" on public.app_posts;
create policy "Users can create posts" on public.app_posts
  for insert with check ( (select auth.uid())::uuid = user_id );

drop policy if exists "Users can delete own posts" on public.app_posts;
create policy "Users can delete own posts" on public.app_posts
  for delete using ( (select auth.uid())::uuid = user_id );

drop policy if exists "Users can update own posts" on public.app_posts;
create policy "Users can update own posts" on public.app_posts
  for update using ( (select auth.uid())::uuid = user_id );


-- 8. app_likes
drop policy if exists "Users can insert likes" on public.app_likes;
create policy "Users can insert likes" on public.app_likes
  for insert with check ( (select auth.uid())::uuid = user_id );

drop policy if exists "Users can delete own likes" on public.app_likes;
create policy "Users can delete own likes" on public.app_likes
  for delete using ( (select auth.uid())::uuid = user_id );


-- 9. app_comments
drop policy if exists "Users can insert comments" on public.app_comments;
create policy "Users can insert comments" on public.app_comments
  for insert with check ( (select auth.uid())::uuid = user_id );

drop policy if exists "Users can delete own comments" on public.app_comments;
create policy "Users can delete own comments" on public.app_comments
  for delete using ( (select auth.uid())::uuid = user_id );


-- 10. notifications
drop policy if exists "Users can view their own notifications" on public.notifications;
create policy "Users can view their own notifications" on public.notifications
  for select using ( (select auth.uid()) = user_id );

drop policy if exists "Users can update their own notifications" on public.notifications;
create policy "Users can update their own notifications" on public.notifications
  for update using ( (select auth.uid()) = user_id );

drop policy if exists "Users can delete their own notifications" on public.notifications;
create policy "Users can delete their own notifications" on public.notifications
  for delete using ( (select auth.uid()) = user_id );

drop policy if exists "Users can insert notifications" on public.notifications;
create policy "Users can insert notifications" on public.notifications
  for insert with check ( (select auth.uid()) = user_id );


-- 11. support_sessions
drop policy if exists "Users can view their own sessions" on public.support_sessions;
create policy "Users can view their own sessions" on public.support_sessions
  for select using ( (select auth.uid()) = user_id );

drop policy if exists "Users can insert their own sessions" on public.support_sessions;
create policy "Users can insert their own sessions" on public.support_sessions
  for insert with check ( (select auth.uid()) = user_id );

drop policy if exists "Users can update their own sessions" on public.support_sessions;
create policy "Users can update their own sessions" on public.support_sessions
  for update using ( (select auth.uid()) = user_id );


-- 12. support_messages
drop policy if exists "Users can view messages from their sessions" on public.support_messages;
create policy "Users can view messages from their sessions" on public.support_messages
  for select using ( 
    exists (
      select 1 from public.support_sessions s
      where s.id = session_id and s.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can insert messages into their sessions" on public.support_messages;
create policy "Users can insert messages into their sessions" on public.support_messages
  for insert with check ( 
    exists (
        select 1 from public.support_sessions s
        where s.id = session_id and s.user_id = (select auth.uid())
    )
  );


-- 13. app_feedback
drop policy if exists "Users can view their own feedback" on public.app_feedback;
create policy "Users can view their own feedback" on public.app_feedback
  for select using ( (select auth.uid()) = user_id );

drop policy if exists "Users can insert their own feedback" on public.app_feedback;
create policy "Users can insert their own feedback" on public.app_feedback
  for insert with check ( (select auth.uid()) = user_id );


-- 14. user_stats
drop policy if exists "Allow user update" on public.user_stats;
create policy "Allow user update" on public.user_stats
  for update using ( (select auth.uid()) = user_id );


-- 15. gdelt_events (Combine permissive policies)
drop policy if exists "Enable read access for all users" on public.gdelt_events;
drop policy if exists "Public read access for gdelt_events" on public.gdelt_events;

create policy "Public read access" on public.gdelt_events
  for select using (true);
