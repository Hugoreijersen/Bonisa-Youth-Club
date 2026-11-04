-- Ticket system: events, orders, tickets and admins.
-- Explanation in Dutch: docs/ticketsysteem.md
--
-- Security model
-- - Row Level Security is on for every table and there are no policies for
--   `anon` or `authenticated`: visitors cannot read or write anything.
-- - The edge functions use the service role and only call the functions
--   below; amounts are always computed here, never taken from the form.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.order_status as enum (
  'open',          -- waiting for payment
  'betaald',       -- paid; tickets exist
  'mislukt',       -- payment failed or was cancelled
  'verlopen',      -- payment expired
  'terugbetaald'   -- fully refunded; tickets are no longer valid
);

create type public.beheerder_rol as enum ('kantoor', 'scanner');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.events (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique check (slug ~ '^[a-z0-9-]+$'),
  naam                text not null,
  begint_op           timestamptz not null,
  locatie             text not null,
  prijs_cent          integer not null check (prijs_cent >= 0),
  max_tickets         integer not null check (max_tickets > 0),
  max_per_bestelling  integer not null default 10 check (max_per_bestelling between 1 and 50),
  verkoop_open_vanaf  timestamptz,
  verkoop_dicht_op    timestamptz,
  aangemaakt_op       timestamptz not null default now()
);

comment on table public.events is 'Evenementen met ticketverkoop (jongerenzang, later events.bonisa.nl).';
comment on column public.events.prijs_cent is 'Prijs per ticket in centen. Dit bedrag wordt echt betaald.';
comment on column public.events.verkoop_open_vanaf is 'Leeg = nog niet open.';
comment on column public.events.verkoop_dicht_op is 'Leeg = tot het begin van het evenement.';

create table public.orders (
  id                 uuid primary key default gen_random_uuid(),
  event_id           uuid not null references public.events (id) on delete restrict,
  voornaam           text not null check (char_length(voornaam) between 1 and 100),
  achternaam         text not null check (char_length(achternaam) between 1 and 100),
  email              text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  telefoon           text check (char_length(telefoon) <= 30),
  woonplaats         text not null check (char_length(woonplaats) between 1 and 100),
  aantal             integer not null check (aantal > 0),
  bedrag_cent        integer not null check (bedrag_cent >= 0),
  status             public.order_status not null default 'open',
  mollie_payment_id  text unique,
  nieuwsbrief        boolean not null default false,
  akkoord_op         timestamptz not null default now(),
  aangemaakt_op      timestamptz not null default now(),
  betaald_op         timestamptz,
  bijgewerkt_op      timestamptz not null default now()
);

comment on table public.orders is 'Bestellingen. Bevat persoonsgegevens: bewaartermijn volgens docs/beveiliging.md.';

create index orders_event_status_idx on public.orders (event_id, status);
create index orders_email_idx on public.orders (lower(email), aangemaakt_op);

create table public.tickets (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  volgnummer    integer not null,
  -- 128 random bits, hex: impossible to guess (docs/beveiliging.md)
  code          text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  gescand_op    timestamptz,
  gescand_door  uuid references auth.users (id) on delete set null,
  aangemaakt_op timestamptz not null default now(),
  unique (order_id, volgnummer)
);

create table public.beheerders (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  rol           public.beheerder_rol not null,
  aangemaakt_op timestamptz not null default now()
);

-- Nobody but the service role (edge functions) may touch these tables.
alter table public.events     enable row level security;
alter table public.orders     enable row level security;
alter table public.tickets    enable row level security;
alter table public.beheerders enable row level security;

revoke all on public.events, public.orders, public.tickets, public.beheerders from anon, authenticated;

-- ---------------------------------------------------------------------------
-- How many places are still free?
-- Paid orders count, and open orders for 30 minutes (the time someone has to
-- finish paying at Mollie). After that the places are released again.
-- ---------------------------------------------------------------------------
create or replace function public.plaatsen_vrij(p_event_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select e.max_tickets - coalesce((
    select sum(o.aantal)
    from public.orders o
    where o.event_id = e.id
      and (o.status = 'betaald'
           or (o.status = 'open' and o.aangemaakt_op > now() - interval '30 minutes'))
  ), 0)::integer
  from public.events e
  where e.id = p_event_id;
$$;

-- ---------------------------------------------------------------------------
-- Public information about an event (no personal data).
-- ---------------------------------------------------------------------------
create or replace function public.evenement_info(p_slug text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'slug', e.slug,
    'naam', e.naam,
    'prijs_cent', e.prijs_cent,
    'max_per_bestelling', e.max_per_bestelling,
    'verkoop', case
      when e.verkoop_open_vanaf is null or now() < e.verkoop_open_vanaf then 'nog_niet_open'
      when now() >= coalesce(e.verkoop_dicht_op, e.begint_op) then 'gesloten'
      when public.plaatsen_vrij(e.id) <= 0 then 'uitverkocht'
      else 'open'
    end,
    'plaatsen_vrij', greatest(public.plaatsen_vrij(e.id), 0)
  )
  from public.events e
  where e.slug = p_slug;
$$;

-- ---------------------------------------------------------------------------
-- Create an order. All checks happen here, inside one transaction, with the
-- event row locked so two people cannot buy the last ticket at the same time.
-- Raises an exception with a short code that the edge function translates.
-- ---------------------------------------------------------------------------
create or replace function public.maak_bestelling(
  p_slug        text,
  p_voornaam    text,
  p_achternaam  text,
  p_email       text,
  p_telefoon    text,
  p_woonplaats  text,
  p_aantal      integer,
  p_nieuwsbrief boolean
)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_event  public.events;
  v_order  public.orders;
  v_recent integer;
begin
  select * into v_event from public.events where slug = p_slug for update;
  if not found then
    raise exception 'onbekend_evenement';
  end if;

  if v_event.verkoop_open_vanaf is null or now() < v_event.verkoop_open_vanaf
     or now() >= coalesce(v_event.verkoop_dicht_op, v_event.begint_op) then
    raise exception 'verkoop_gesloten';
  end if;

  if p_aantal is null or p_aantal < 1 or p_aantal > v_event.max_per_bestelling then
    raise exception 'ongeldig_aantal';
  end if;

  if public.plaatsen_vrij(v_event.id) < p_aantal then
    raise exception 'niet_genoeg_plaatsen';
  end if;

  -- Simple protection against floods: max 5 orders per e-mail address per hour.
  select count(*) into v_recent
  from public.orders
  where lower(email) = lower(trim(p_email))
    and aangemaakt_op > now() - interval '1 hour';
  if v_recent >= 5 then
    raise exception 'te_veel_bestellingen';
  end if;

  insert into public.orders (event_id, voornaam, achternaam, email, telefoon,
                             woonplaats, aantal, bedrag_cent, nieuwsbrief)
  values (v_event.id, trim(p_voornaam), trim(p_achternaam), lower(trim(p_email)),
          nullif(trim(coalesce(p_telefoon, '')), ''), trim(p_woonplaats),
          p_aantal, p_aantal * v_event.prijs_cent, coalesce(p_nieuwsbrief, false))
  returning * into v_order;

  return jsonb_build_object(
    'order_id', v_order.id,
    'bedrag_cent', v_order.bedrag_cent,
    'aantal', v_order.aantal,
    'evenement', v_event.naam
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Store the Mollie payment id once the payment has been created.
-- ---------------------------------------------------------------------------
create or replace function public.koppel_betaling(p_order_id uuid, p_payment_id text)
returns void
language sql
volatile
set search_path = ''
as $$
  update public.orders
  set mollie_payment_id = p_payment_id, bijgewerkt_op = now()
  where id = p_order_id and mollie_payment_id is null;
$$;

-- If Mollie could not create the payment, release the places at once.
create or replace function public.betaling_niet_gestart(p_order_id uuid)
returns void
language sql
volatile
set search_path = ''
as $$
  update public.orders
  set status = 'mislukt', bijgewerkt_op = now()
  where id = p_order_id and status = 'open' and mollie_payment_id is null;
$$;

-- ---------------------------------------------------------------------------
-- Process the status that the edge function has fetched from Mollie itself.
-- Idempotent: Mollie may call the webhook several times.
-- p_mollie_status: open | pending | authorized | paid | canceled | expired | failed
-- p_bedrag_cent / p_terugbetaald_cent: amounts as reported by Mollie.
-- ---------------------------------------------------------------------------
create or replace function public.verwerk_betaling(
  p_payment_id        text,
  p_mollie_status     text,
  p_bedrag_cent       integer,
  p_terugbetaald_cent integer default 0
)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_order public.orders;
  v_nieuw public.order_status;
begin
  select * into v_order from public.orders where mollie_payment_id = p_payment_id for update;
  if not found then
    return jsonb_build_object('resultaat', 'onbekend');
  end if;

  if p_bedrag_cent is distinct from v_order.bedrag_cent then
    raise exception 'bedrag_klopt_niet';
  end if;

  v_nieuw := case
    when p_mollie_status = 'paid' and coalesce(p_terugbetaald_cent, 0) >= v_order.bedrag_cent
         and v_order.bedrag_cent > 0                          then 'terugbetaald'
    when p_mollie_status = 'paid'                             then 'betaald'
    when p_mollie_status in ('canceled', 'failed')            then 'mislukt'
    when p_mollie_status = 'expired'                          then 'verlopen'
    else v_order.status  -- open / pending / authorized: nothing changes yet
  end::public.order_status;

  -- A paid order never goes back to failed/expired.
  if v_order.status in ('betaald', 'terugbetaald') and v_nieuw in ('open', 'mislukt', 'verlopen') then
    v_nieuw := v_order.status;
  end if;

  if v_nieuw = v_order.status then
    return jsonb_build_object('resultaat', 'ongewijzigd', 'status', v_order.status);
  end if;

  update public.orders
  set status = v_nieuw,
      betaald_op = case when v_nieuw = 'betaald' then coalesce(betaald_op, now()) else betaald_op end,
      bijgewerkt_op = now()
  where id = v_order.id;

  if v_nieuw = 'betaald' then
    insert into public.tickets (order_id, volgnummer)
    select v_order.id, n from generate_series(1, v_order.aantal) as n
    on conflict (order_id, volgnummer) do nothing;
  end if;

  return jsonb_build_object('resultaat', 'bijgewerkt', 'status', v_nieuw, 'order_id', v_order.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Status for the thank-you page. Only what the visitor needs; no personal data.
-- ---------------------------------------------------------------------------
create or replace function public.bestelling_status(p_order_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'status', o.status,
    'aantal', o.aantal,
    'bedrag_cent', o.bedrag_cent,
    'evenement', e.naam
  )
  from public.orders o
  join public.events e on e.id = o.event_id
  where o.id = p_order_id;
$$;

-- Only the service role (the edge functions) may call these functions.
revoke execute on function
  public.plaatsen_vrij(uuid),
  public.evenement_info(text),
  public.maak_bestelling(text, text, text, text, text, text, integer, boolean),
  public.koppel_betaling(uuid, text),
  public.betaling_niet_gestart(uuid),
  public.verwerk_betaling(text, text, integer, integer),
  public.bestelling_status(uuid)
from public, anon, authenticated;

grant execute on function
  public.plaatsen_vrij(uuid),
  public.evenement_info(text),
  public.maak_bestelling(text, text, text, text, text, text, integer, boolean),
  public.koppel_betaling(uuid, text),
  public.betaling_niet_gestart(uuid),
  public.verwerk_betaling(text, text, integer, integer),
  public.bestelling_status(uuid)
to service_role;
