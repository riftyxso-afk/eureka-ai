create table if not exists public.user_connectors (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  permission text not null check (permission in ('read','write')),
  credentials text not null,
  expires_at timestamptz,
  connected_at timestamptz not null default now(),
  primary key (user_id,provider)
);
create table if not exists public.connector_oauth_states (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  permission text not null,
  verifier text not null,
  expires_at timestamptz not null
);
create table if not exists public.connector_actions (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id text not null,
  result jsonb,
  created_at timestamptz not null default now(),
  primary key(user_id,request_id)
);
alter table public.user_connectors enable row level security;
alter table public.connector_oauth_states enable row level security;
alter table public.connector_actions enable row level security;
revoke all on public.user_connectors, public.connector_oauth_states, public.connector_actions from anon, authenticated;
grant all on public.user_connectors, public.connector_oauth_states, public.connector_actions to service_role;
create index if not exists connector_oauth_expiry on public.connector_oauth_states(expires_at);
alter table public.connector_oauth_states add column if not exists pending_credentials text;
