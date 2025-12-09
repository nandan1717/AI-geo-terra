-- Create app_feedback table
create table if not exists app_feedback (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  rating integer check (rating >= 1 and rating <= 5) not null,
  feedback text,
  source text default 'support_chat',
  session_id uuid references support_sessions(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table app_feedback enable row level security;

-- Create policies
create policy "Users can view their own feedback"
  on app_feedback for select
  using (auth.uid() = user_id);

create policy "Users can insert their own feedback"
  on app_feedback for insert
  with check (auth.uid() = user_id);
