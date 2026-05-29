-- ============================================================================
--  Módulo Conversando IA — autoconocimiento emocional y hábitos
--  Ejecuta este archivo en Supabase SQL Editor después de `schema.sql`.
--  No usa RLS: el acceso se controla server-side con service_role + sesión propia.
-- ============================================================================

create table if not exists public.emotional_records (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.usuarios(id) on delete cascade,
  recorded_at         timestamptz not null default now(),
  record_date         date not null,
  situation           text not null,
  emotion             text not null,
  intensity           integer not null check (intensity between 1 and 10),
  body_sensation      text not null,
  possible_trigger    text,
  automatic_thought   text,
  behavior_impulse    text not null,
  life_area           text not null check (
    life_area in ('dinero', 'amor', 'salud', 'familia', 'trabajo', 'proposito', 'espiritualidad')
  ),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.emotional_blockage_plans (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.usuarios(id) on delete cascade,
  title               text not null,
  description         text,
  possible_belief     text,
  audio_suggestion    text,
  daily_habit         text,
  affirmation         text,
  real_action         text,
  followup_question   text,
  status              text not null default 'proposed' check (status in ('proposed', 'active', 'completed', 'paused')),
  priority            integer not null default 1,
  resolved_at         timestamptz,
  started_at          timestamptz not null default now(),
  last_checked_at     timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Migración para bases ya desplegadas: estado 'proposed', campos de plan nullable,
-- columna resolved_at y enlace tasks -> bloqueo.
alter table public.emotional_blockage_plans drop constraint if exists emotional_blockage_plans_status_check;
alter table public.emotional_blockage_plans
  add constraint emotional_blockage_plans_status_check
  check (status in ('proposed', 'active', 'completed', 'paused'));
alter table public.emotional_blockage_plans alter column audio_suggestion  drop not null;
alter table public.emotional_blockage_plans alter column daily_habit       drop not null;
alter table public.emotional_blockage_plans alter column affirmation       drop not null;
alter table public.emotional_blockage_plans alter column real_action       drop not null;
alter table public.emotional_blockage_plans alter column followup_question drop not null;
alter table public.emotional_blockage_plans add column if not exists resolved_at timestamptz;

alter table public.tasks add column if not exists blockage_plan_id uuid
  references public.emotional_blockage_plans(id) on delete set null;
create index if not exists tasks_blockage_plan_idx on public.tasks (blockage_plan_id);

create table if not exists public.emotional_weekly_checkins (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.usuarios(id) on delete cascade,
  blockage_plan_id    uuid not null references public.emotional_blockage_plans(id) on delete cascade,
  intensity_score     integer not null check (intensity_score between 1 and 10),
  notes               text,
  ai_reply            text not null,
  created_at          timestamptz not null default now()
);

create table if not exists public.emotional_conversations (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.usuarios(id) on delete cascade,
  record_id           uuid references public.emotional_records(id) on delete set null,
  title               text not null,
  messages            jsonb not null default '[]'::jsonb,
  extracted_record    jsonb,
  ai_summary          text,
  created_at          timestamptz not null default now()
);

create table if not exists public.ai_emotional_requests (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.usuarios(id) on delete cascade,
  request_type        text not null,
  is_mock             boolean not null default false,
  request_payload     jsonb,
  response_payload    jsonb,
  created_at          timestamptz not null default now()
);

create index if not exists emotional_records_user_date_idx
  on public.emotional_records (user_id, record_date desc, recorded_at desc);

create index if not exists emotional_blockage_plans_user_status_idx
  on public.emotional_blockage_plans (user_id, status, priority);

create index if not exists emotional_weekly_checkins_plan_idx
  on public.emotional_weekly_checkins (blockage_plan_id, created_at desc);

create index if not exists emotional_conversations_user_created_idx
  on public.emotional_conversations (user_id, created_at desc);

drop trigger if exists emotional_records_set_updated_at on public.emotional_records;
create trigger emotional_records_set_updated_at
  before update on public.emotional_records
  for each row execute function public.set_updated_at();

drop trigger if exists emotional_blockage_plans_set_updated_at on public.emotional_blockage_plans;
create trigger emotional_blockage_plans_set_updated_at
  before update on public.emotional_blockage_plans
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
--  Progreso de un bloqueo: cumplimiento de los hábitos enlazados a un plan en
--  una ventana de p_days días (por defecto 15). Reutiliza la lógica de
--  task_logs / eligible_days. Cada hábito sólo cuenta días desde que fue creado.
-- ----------------------------------------------------------------------------
drop function if exists public.report_blockage_progress(uuid, integer);
create or replace function public.report_blockage_progress(
  p_plan_id uuid,
  p_days    integer default 15
) returns table (task_id uuid, title text, completed bigint, eligible integer, pct numeric)
language sql stable as $$
  with bounds as (
    select (current_date - (greatest(p_days, 1) - 1))::date as win_start, current_date as win_end
  )
  select
    t.id,
    t.title,
    coalesce(count(l.*) filter (where l.is_completed), 0) as completed,
    public.eligible_days(t.deleted_at, greatest(b.win_start, t.created_at::date), b.win_end) as eligible,
    case
      when public.eligible_days(t.deleted_at, greatest(b.win_start, t.created_at::date), b.win_end) > 0
      then round(
        100.0 * coalesce(count(*) filter (where l.is_completed), 0)
        / public.eligible_days(t.deleted_at, greatest(b.win_start, t.created_at::date), b.win_end), 1)
      else 0
    end as pct
  from public.tasks t
  cross join bounds b
  left join public.task_logs l
    on l.task_id = t.id and l.date between b.win_start and b.win_end and l.date <= current_date
  where t.blockage_plan_id = p_plan_id and t.deleted_at is null
  group by t.id, b.win_start, b.win_end
  order by t.title asc;
$$;
