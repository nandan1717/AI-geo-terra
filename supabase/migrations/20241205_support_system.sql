-- Create support_sessions table
create table if not exists support_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  status text default 'open' check (status in ('open', 'closed')),
  rating integer check (rating >= 1 and rating <= 5),
  feedback text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create support_messages table
create table if not exists support_messages (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references support_sessions(id) not null,
  role text check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table support_sessions enable row level security;
alter table support_messages enable row level security;

-- Create policies
create policy "Users can view their own sessions"
  on support_sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own sessions"
  on support_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own sessions"
  on support_sessions for update
  using (auth.uid() = user_id);

create policy "Users can view messages from their sessions"
  on support_messages for select
  using (
    exists (
      select 1 from support_sessions
      where support_sessions.id = support_messages.session_id
      and support_sessions.user_id = auth.uid()
    )
  );

create policy "Users can insert messages into their sessions"
  on support_messages for insert
  with check (
    exists (
      select 1 from support_sessions
      where support_sessions.id = support_messages.session_id
      and support_sessions.user_id = auth.uid()
    )
  );
