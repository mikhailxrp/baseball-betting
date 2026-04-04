-- Hitting stats per MLB player per season (regular season slices from MLB Stats API).

create table if not exists public.batter_stats (
  id uuid primary key default gen_random_uuid (),
  mlb_player_id bigint not null,
  player_name text not null default '',
  team_id bigint not null references public.teams (id) on delete cascade,
  season text not null,
  games_played integer,
  avg double precision,
  obp double precision,
  slg double precision,
  ops double precision,
  home_runs integer,
  rbi integer,
  strikeouts integer,
  at_bats integer,
  hits integer,
  updated_at timestamptz not null default now(),
  unique (mlb_player_id, season)
);

create index if not exists batter_stats_team_id_idx on public.batter_stats (team_id);

create index if not exists batter_stats_updated_at_idx on public.batter_stats (updated_at);
