-- Create notifications table
create table if not exists notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  type text not null,
  title text not null,
  message text not null,
  data jsonb default '{}'::jsonb,
  read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  expires_at timestamp with time zone
);

-- Enable RLS
alter table notifications enable row level security;

-- Policies
create policy "Users can view their own notifications"
  on notifications for select
  using (auth.uid() = user_id);

create policy "Users can update their own notifications"
  on notifications for update
  using (auth.uid() = user_id);

create policy "Users can delete their own notifications"
  on notifications for delete
  using (auth.uid() = user_id);

-- Allow authenticated users to insert notifications (e.g. for friend requests)
-- In a stricter app, this might be limited to service_role or specific functions
create policy "Users can insert notifications"
  on notifications for insert
  with check (auth.uid() = user_id OR auth.uid() IS NOT NULL);

-- Create index for faster queries
create index notifications_user_id_idx on notifications(user_id);
create index notifications_created_at_idx on notifications(created_at desc);
