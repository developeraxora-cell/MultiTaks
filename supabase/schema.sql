-- ============================================================================
--  Mentes Creadoras — esquema de base de datos (Supabase / PostgreSQL)
--  Ejecuta este archivo completo en: Supabase Dashboard > SQL Editor > New query
--  Auth propia (tabla usuarios). Acceso solo server-side con la service_role key
--  + control de sesión/roles en la capa de aplicación. NO se usa RLS.
-- ============================================================================

create extension if not exists "pgcrypto";  -- gen_random_uuid() + crypt()/gen_salt()

-- ----------------------------------------------------------------------------
--  Tabla: usuarios (auth propia)
--  password_hash = bcrypt. Seed/admin se puede crear con crypt(...,gen_salt('bf')).
-- ----------------------------------------------------------------------------
create table if not exists public.usuarios (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,
  full_name     text not null,
  role          text not null default 'user' check (role in ('admin', 'user')),
  time_zone     text not null default 'America/Mexico_City',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.usuarios add column if not exists time_zone text not null default 'America/Mexico_City';

-- ----------------------------------------------------------------------------
--  Tabla: tasks (hábitos/tareas permanentes, por usuario)
-- ----------------------------------------------------------------------------
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.usuarios(id) on delete cascade,
  assigned_by uuid references public.usuarios(id) on delete set null, -- admin que asignó (null si propia)
  title       text not null,
  category    text not null default 'desarrollo_personal'
              check (category in ('amigos', 'salud', 'dinero', 'amor', 'familia', 'profesion', 'desarrollo_personal', 'ocio')),
  description text,
  goal        text,                              -- meta libre, ej. "5 días/semana"
  start_time  time,                              -- hora de inicio (opcional)
  end_time    time,                              -- hora de fin del rango (opcional)
  is_active   boolean not null default true,     -- desactivar = ocultar del grid, conserva historial
  deleted_at  timestamptz,                       -- soft delete: conserva logs para reportes
  sort_order  integer not null default 0,        -- orden de filas en el grid
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Migración para bases ya creadas (idempotente).
alter table public.tasks add column if not exists start_time time;
alter table public.tasks add column if not exists end_time   time;
alter table public.tasks add column if not exists user_id     uuid references public.usuarios(id) on delete cascade;
alter table public.tasks add column if not exists assigned_by uuid references public.usuarios(id) on delete set null;
alter table public.tasks add column if not exists category text not null default 'desarrollo_personal';
alter table public.tasks drop constraint if exists tasks_category_check;
alter table public.tasks add constraint tasks_category_check
  check (category in ('amigos', 'salud', 'dinero', 'amor', 'familia', 'profesion', 'desarrollo_personal', 'ocio'));

-- ----------------------------------------------------------------------------
--  Tabla: task_logs (cumplimiento diario, 1 fila por (tarea, fecha))
-- ----------------------------------------------------------------------------
create table if not exists public.task_logs (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.tasks(id) on delete cascade,
  user_id      uuid not null references public.usuarios(id) on delete cascade,
  date         date not null,
  is_completed boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint task_logs_task_date_unique unique (task_id, date)  -- impide duplicados
);

alter table public.task_logs add column if not exists user_id uuid references public.usuarios(id) on delete cascade;

create index if not exists task_logs_date_idx          on public.task_logs (date);
create index if not exists task_logs_task_date_idx     on public.task_logs (task_id, date);
create index if not exists task_logs_user_idx          on public.task_logs (user_id);
create index if not exists tasks_user_idx              on public.tasks (user_id);
create index if not exists tasks_category_idx          on public.tasks (category);
create index if not exists tasks_active_idx            on public.tasks (is_active) where deleted_at is null;

-- ----------------------------------------------------------------------------
--  Trigger: mantener updated_at
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

drop trigger if exists task_logs_set_updated_at on public.task_logs;
create trigger task_logs_set_updated_at
  before update on public.task_logs
  for each row execute function public.set_updated_at();

drop trigger if exists usuarios_set_updated_at on public.usuarios;
create trigger usuarios_set_updated_at
  before update on public.usuarios
  for each row execute function public.set_updated_at();

-- ============================================================================
--  RPC de reportes
--  Modelo: un hábito es PERMANENTE. Mientras esté activo y no eliminado, aplica a
--    TODOS los días del periodo, incluso anteriores a su creación. Por eso un
--    hábito nuevo (sin marcar) baja el % de los días pasados.
--  "Días vigentes" dentro de [p_start, p_end] =
--    desde  p_start
--    hasta  min(p_end, current_date, deleted_at::date si fue eliminada)
--  Numerador: sólo logs is_completed=true con date <= current_date (ignora futuro).
--  Un día sin log cuenta como NO completado.
-- ============================================================================

-- Días del periodo hasta hoy (helper interno). NO depende de created_at.
create or replace function public.eligible_days(
  p_deleted timestamptz,
  p_start   date,
  p_end     date
) returns integer language sql immutable as $$
  select greatest(
    0,
    (least(p_end, current_date, coalesce(p_deleted::date, p_end)) - p_start) + 1
  );
$$;

-- Reporte por tarea en un periodo: completados, días vigentes, porcentaje.
create or replace function public.report_task_period(
  p_task_id uuid,
  p_start   date,
  p_end     date
) returns table (completed bigint, eligible integer, pct numeric)
language sql stable as $$
  select
    coalesce(count(*) filter (where l.is_completed), 0)         as completed,
    public.eligible_days(t.deleted_at, p_start, p_end)          as eligible,
    case
      when public.eligible_days(t.deleted_at, p_start, p_end) > 0
      then round(
        100.0 * coalesce(count(*) filter (where l.is_completed), 0)
        / public.eligible_days(t.deleted_at, p_start, p_end), 1)
      else 0
    end as pct
  from public.tasks t
  left join public.task_logs l
    on l.task_id = t.id and l.date between p_start and p_end and l.date <= current_date
  where t.id = p_task_id
  group by t.id;
$$;

-- Cumplimiento general de UN usuario (todas sus tareas activas) en un periodo.
drop function if exists public.report_overall(date, date);
create or replace function public.report_overall(
  p_user_id uuid,
  p_start   date,
  p_end     date
) returns table (completed bigint, possible bigint, pct numeric)
language sql stable as $$
  with per_task as (
    select
      coalesce(count(l.*) filter (where l.is_completed), 0) as done,
      public.eligible_days(t.deleted_at, p_start, p_end)    as elig
    from public.tasks t
    left join public.task_logs l
      on l.task_id = t.id and l.date between p_start and p_end and l.date <= current_date
    where t.deleted_at is null and t.is_active and t.user_id = p_user_id
    group by t.id, t.deleted_at
  )
  select
    coalesce(sum(done), 0)     as completed,
    coalesce(sum(elig), 0)     as possible,
    case when coalesce(sum(elig), 0) > 0
      then round(100.0 * sum(done) / sum(elig), 1)
      else 0 end               as pct
  from per_task;
$$;

-- Ranking de tareas de UN usuario por % de cumplimiento.
drop function if exists public.report_task_ranking(date, date);
create or replace function public.report_task_ranking(
  p_user_id uuid,
  p_start   date,
  p_end     date
) returns table (task_id uuid, title text, completed bigint, eligible integer, pct numeric)
language sql stable as $$
  select
    t.id,
    t.title,
    coalesce(count(l.*) filter (where l.is_completed), 0) as completed,
    public.eligible_days(t.deleted_at, p_start, p_end)    as eligible,
    case
      when public.eligible_days(t.deleted_at, p_start, p_end) > 0
      then round(
        100.0 * coalesce(count(l.*) filter (where l.is_completed), 0)
        / public.eligible_days(t.deleted_at, p_start, p_end), 1)
      else 0
    end as pct
  from public.tasks t
  left join public.task_logs l
    on l.task_id = t.id and l.date between p_start and p_end and l.date <= current_date
  where t.deleted_at is null and t.is_active and t.user_id = p_user_id
  group by t.id
  order by pct desc, t.title asc;
$$;

-- Productividad por día: completados vs hábitos activos (para rachas y días más/
-- menos productivos). El total = hábitos activos no eliminados (aplican a todo el
-- periodo). Una fila por cada fecha del rango hasta hoy.
drop function if exists public.report_day_productivity(date, date);
create or replace function public.report_day_productivity(
  p_user_id uuid,
  p_start   date,
  p_end     date
) returns table (d date, completed bigint, total bigint, pct numeric)
language sql stable as $$
  with days as (
    select generate_series(p_start, least(p_end, current_date), interval '1 day')::date as d
  )
  select
    days.d,
    coalesce(count(l.*) filter (where l.is_completed), 0) as completed,
    count(t.*)                                            as total,
    case when count(t.*) > 0
      then round(100.0 * coalesce(count(l.*) filter (where l.is_completed), 0) / count(t.*), 1)
      else 0 end                                          as pct
  from days
  left join public.tasks t
    on t.deleted_at is null
   and t.is_active
   and t.user_id = p_user_id
   and (t.deleted_at is null or t.deleted_at::date >= days.d)
  left join public.task_logs l
    on l.task_id = t.id and l.date = days.d
  group by days.d
  order by days.d;
$$;

-- ============================================================================
--  Módulo Conversando IA — autoconocimiento emocional y hábitos
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

-- Progreso de un bloqueo: cumplimiento de los hábitos enlazados a un plan en una
-- ventana de p_days días (por defecto 15). Reutiliza task_logs / eligible_days.
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

-- ============================================================================
--  Seed: usuario admin inicial (ejecutar UNA vez; cambia email/contraseña).
--  bcrypt vía pgcrypto; compatible con bcryptjs en la app.
-- ============================================================================
-- insert into public.usuarios (email, password_hash, full_name, role)
-- values ('admin@mentescreadoras.com', crypt('CAMBIA_ESTA_CLAVE', gen_salt('bf')), 'Administrador', 'admin')
-- on conflict (email) do nothing;

-- Migración de datos previos (single-user → multi-user): asigna tareas/logs
-- sin dueño al admin. Ejecutar DESPUÉS de crear el admin.
-- update public.tasks     set user_id = (select id from public.usuarios where role='admin' order by created_at limit 1) where user_id is null;
-- update public.task_logs set user_id = (select user_id from public.tasks where tasks.id = task_logs.task_id) where user_id is null;
