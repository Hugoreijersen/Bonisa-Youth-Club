-- Gifts (donations) for bonisa.nl: one-off and monthly, always for a project.
-- Explanation in Dutch: docs/giften.md
--
-- Same security model as the ticket system: Row Level Security on every
-- table without policies, and only the service role (the edge functions) may
-- call the functions below. Amounts are checked here, never trusted from the
-- form or from a Mollie notification.
--
-- The list of projects lives in Pages CMS (site/_data/projecten.json), not
-- here. The functions check the project against the published list and store
-- its slug and name with every gift.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.gift_soort as enum (
  'eenmalig',     -- one-off gift
  'eerste',       -- first payment of a monthly gift (iDEAL, creates the mandate)
  'maandelijks'   -- later monthly payment, collected by Mollie (direct debit)
);

create type public.periodiek_status as enum (
  'wacht_op_eerste',  -- waiting for the first payment
  'actief',           -- subscription running at Mollie
  'gestopt',          -- stopped by the giver or by office
  'mislukt'           -- first payment failed or expired; nothing runs
);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.periodieke_giften (
  id                      uuid primary key default gen_random_uuid(),
  project_slug            text not null check (project_slug ~ '^[a-z0-9-]{1,60}$'),
  project_naam            text not null check (char_length(project_naam) between 1 and 120),
  voornaam                text not null check (char_length(voornaam) between 1 and 100),
  achternaam              text not null check (char_length(achternaam) between 1 and 100),
  email                   text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  bedrag_cent             integer not null check (bedrag_cent between 100 and 1000000),
  status                  public.periodiek_status not null default 'wacht_op_eerste',
  mollie_customer_id      text unique,
  mollie_mandate_id       text,
  mollie_subscription_id  text unique,
  -- Secret for the stop link in the thank-you mail (/geven/stoppen/#<stopcode>). 128 random bits.
  stopcode                text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  gestopt_door            text check (gestopt_door in ('gever', 'kantoor')),
  aangemaakt_op           timestamptz not null default now(),
  gestart_op              timestamptz,
  gestopt_op              timestamptz,
  bijgewerkt_op           timestamptz not null default now()
);

comment on table public.periodieke_giften is 'Maandelijkse giften (machtiging en abonnement bij Mollie). Bevat persoonsgegevens: bewaartermijn volgens docs/beveiliging.md.';

create table public.giften (
  id                       uuid primary key default gen_random_uuid(),
  soort                    public.gift_soort not null,
  periodiek_id             uuid references public.periodieke_giften (id) on delete restrict,
  project_slug             text not null check (project_slug ~ '^[a-z0-9-]{1,60}$'),
  project_naam             text not null check (char_length(project_naam) between 1 and 120),
  voornaam                 text not null check (char_length(voornaam) between 1 and 100),
  achternaam               text not null check (char_length(achternaam) between 1 and 100),
  email                    text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  bedrag_cent              integer not null check (bedrag_cent between 100 and 1000000),
  status                   public.order_status not null default 'open',
  mollie_payment_id        text unique,
  nieuwsbrief              boolean not null default false,
  mail_verstuurd_op        timestamptz,
  mail_geclaimd_op         timestamptz,
  nieuwsbrief_verwerkt_op  timestamptz,
  aangemaakt_op            timestamptz not null default now(),
  betaald_op               timestamptz,
  bijgewerkt_op            timestamptz not null default now(),
  check ((soort = 'eenmalig') = (periodiek_id is null))
);

comment on table public.giften is 'Eén rij per betaling van een gift. Bevat persoonsgegevens: bewaartermijn volgens docs/beveiliging.md.';

create index giften_project_status_idx on public.giften (project_slug, status);
create index giften_email_idx on public.giften (lower(email), aangemaakt_op);
create index giften_periodiek_idx on public.giften (periodiek_id);

alter table public.periodieke_giften enable row level security;
alter table public.giften            enable row level security;
revoke all on public.periodieke_giften, public.giften from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Create a gift. For a monthly gift this also creates the monthly gift
-- itself; its first payment is a normal gift row of soort 'eerste'.
-- p_soort: 'eenmalig' | 'maandelijks'. Amount limits: EUR 1 to EUR 10,000.
-- ---------------------------------------------------------------------------
create or replace function public.maak_gift(
  p_soort         text,
  p_project_slug  text,
  p_project_naam  text,
  p_voornaam      text,
  p_achternaam    text,
  p_email         text,
  p_bedrag_cent   integer,
  p_nieuwsbrief   boolean
)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_email     text := lower(trim(p_email));
  v_recent    integer;
  v_periodiek public.periodieke_giften;
  v_gift      public.giften;
begin
  if p_soort is null or p_soort not in ('eenmalig', 'maandelijks') then
    raise exception 'ongeldige_soort';
  end if;

  if p_bedrag_cent is null or p_bedrag_cent < 100 or p_bedrag_cent > 1000000 then
    raise exception 'ongeldig_bedrag';
  end if;

  -- Simple protection against floods: max 5 gifts per e-mail address per hour.
  select count(*) into v_recent
  from public.giften
  where lower(email) = v_email and aangemaakt_op > now() - interval '1 hour';
  if v_recent >= 5 then
    raise exception 'te_veel_giften';
  end if;

  if p_soort = 'maandelijks' then
    insert into public.periodieke_giften (project_slug, project_naam, voornaam, achternaam, email, bedrag_cent)
    values (p_project_slug, trim(p_project_naam), trim(p_voornaam), trim(p_achternaam), v_email, p_bedrag_cent)
    returning * into v_periodiek;
  end if;

  insert into public.giften (soort, periodiek_id, project_slug, project_naam, voornaam, achternaam,
                             email, bedrag_cent, nieuwsbrief)
  values (case when p_soort = 'maandelijks' then 'eerste' else 'eenmalig' end::public.gift_soort,
          v_periodiek.id, p_project_slug, trim(p_project_naam), trim(p_voornaam), trim(p_achternaam),
          v_email, p_bedrag_cent, coalesce(p_nieuwsbrief, false))
  returning * into v_gift;

  return jsonb_build_object(
    'gift_id', v_gift.id,
    'periodiek_id', v_periodiek.id,
    'soort', v_gift.soort,
    'bedrag_cent', v_gift.bedrag_cent,
    'project_naam', v_gift.project_naam
  );
end;
$$;

-- Mollie customer for a monthly gift (needed for the mandate).
create or replace function public.koppel_klant(p_periodiek_id uuid, p_customer_id text)
returns void
language sql
volatile
set search_path = ''
as $$
  update public.periodieke_giften
  set mollie_customer_id = p_customer_id, bijgewerkt_op = now()
  where id = p_periodiek_id and mollie_customer_id is null;
$$;

create or replace function public.koppel_gift_betaling(p_gift_id uuid, p_payment_id text)
returns void
language sql
volatile
set search_path = ''
as $$
  update public.giften
  set mollie_payment_id = p_payment_id, bijgewerkt_op = now()
  where id = p_gift_id and mollie_payment_id is null;
$$;

-- If Mollie could not create the payment (or the customer).
create or replace function public.gift_niet_gestart(p_gift_id uuid)
returns void
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_periodiek uuid;
begin
  update public.giften
  set status = 'mislukt', bijgewerkt_op = now()
  where id = p_gift_id and status = 'open' and mollie_payment_id is null
  returning periodiek_id into v_periodiek;

  update public.periodieke_giften
  set status = 'mislukt', bijgewerkt_op = now()
  where id = v_periodiek and status = 'wacht_op_eerste';
end;
$$;

-- ---------------------------------------------------------------------------
-- Process the status that the edge function has fetched from Mollie itself.
-- Idempotent: Mollie may call the webhook several times.
--
-- A payment of a running subscription is not known yet the first time: Mollie
-- creates it. Then p_subscription_id must belong to one of our monthly gifts,
-- and the amount must be exactly the monthly amount; only then a row is added.
--
-- p_terugbetaald_cent: refunded plus charged back (direct debit can be
-- reversed by the giver's bank).
-- ---------------------------------------------------------------------------
create or replace function public.verwerk_gift_betaling(
  p_payment_id        text,
  p_mollie_status     text,
  p_bedrag_cent       integer,
  p_terugbetaald_cent integer default 0,
  p_subscription_id   text default null,
  p_mandate_id        text default null
)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_gift      public.giften;
  v_periodiek public.periodieke_giften;
  v_nieuw     public.order_status;
begin
  select * into v_gift from public.giften where mollie_payment_id = p_payment_id for update;

  if not found then
    if p_subscription_id is null then
      return jsonb_build_object('resultaat', 'onbekend');
    end if;
    select * into v_periodiek from public.periodieke_giften
    where mollie_subscription_id = p_subscription_id for update;
    if not found then
      return jsonb_build_object('resultaat', 'onbekend');
    end if;
    if p_bedrag_cent is distinct from v_periodiek.bedrag_cent then
      raise exception 'bedrag_klopt_niet';
    end if;
    insert into public.giften (soort, periodiek_id, project_slug, project_naam, voornaam, achternaam,
                               email, bedrag_cent, mollie_payment_id)
    values ('maandelijks', v_periodiek.id, v_periodiek.project_slug, v_periodiek.project_naam,
            v_periodiek.voornaam, v_periodiek.achternaam, v_periodiek.email, v_periodiek.bedrag_cent,
            p_payment_id)
    on conflict (mollie_payment_id) do nothing;
    select * into v_gift from public.giften where mollie_payment_id = p_payment_id for update;
  end if;

  if p_bedrag_cent is distinct from v_gift.bedrag_cent then
    raise exception 'bedrag_klopt_niet';
  end if;

  v_nieuw := case
    when p_mollie_status = 'paid' and coalesce(p_terugbetaald_cent, 0) >= v_gift.bedrag_cent then 'terugbetaald'
    when p_mollie_status = 'paid'                             then 'betaald'
    when p_mollie_status in ('canceled', 'failed')            then 'mislukt'
    when p_mollie_status = 'expired'                          then 'verlopen'
    else v_gift.status  -- open / pending / authorized: nothing changes yet
  end::public.order_status;

  -- A paid gift never goes back to failed/expired.
  if v_gift.status in ('betaald', 'terugbetaald') and v_nieuw in ('open', 'mislukt', 'verlopen') then
    v_nieuw := v_gift.status;
  end if;

  -- First payment of a monthly gift: remember the mandate, or mark the
  -- monthly gift as failed when the first payment did not go through.
  if v_gift.soort = 'eerste' then
    if v_nieuw = 'betaald' and p_mandate_id is not null then
      update public.periodieke_giften
      set mollie_mandate_id = coalesce(mollie_mandate_id, p_mandate_id), bijgewerkt_op = now()
      where id = v_gift.periodiek_id;
    elsif v_nieuw in ('mislukt', 'verlopen') then
      update public.periodieke_giften
      set status = 'mislukt', bijgewerkt_op = now()
      where id = v_gift.periodiek_id and status = 'wacht_op_eerste';
    end if;
  end if;

  if v_nieuw is distinct from v_gift.status then
    update public.giften
    set status = v_nieuw,
        betaald_op = case when v_nieuw = 'betaald' then coalesce(betaald_op, now()) else betaald_op end,
        bijgewerkt_op = now()
    where id = v_gift.id;
  end if;

  return jsonb_build_object(
    'resultaat', case when v_nieuw is distinct from v_gift.status then 'bijgewerkt' else 'ongewijzigd' end,
    'status', v_nieuw,
    'gift_id', v_gift.id,
    'soort', v_gift.soort,
    'periodiek_id', v_gift.periodiek_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Monthly gift: start the subscription after a paid first payment.
-- Returns what is needed to create the subscription at Mollie, or null when
-- there is nothing to do (not paid yet, already running, or stopped).
-- ---------------------------------------------------------------------------
create or replace function public.periodiek_klaar_voor_start(p_periodiek_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'periodiek_id', p.id,
    'customer_id', p.mollie_customer_id,
    'mandate_id', p.mollie_mandate_id,
    'bedrag_cent', p.bedrag_cent,
    'project_naam', p.project_naam,
    'eerste_betaald_op', g.betaald_op
  )
  from public.periodieke_giften p
  join public.giften g on g.periodiek_id = p.id and g.soort = 'eerste'
  where p.id = p_periodiek_id
    and p.status = 'wacht_op_eerste'
    and p.mollie_subscription_id is null
    and p.mollie_customer_id is not null
    and g.status = 'betaald';
$$;

-- Returns false when the monthly gift was stopped in the meantime; the
-- function then cancels the new subscription at Mollie again.
create or replace function public.periodiek_gestart(p_periodiek_id uuid, p_subscription_id text)
returns boolean
language plpgsql
volatile
set search_path = ''
as $$
begin
  update public.periodieke_giften
  set mollie_subscription_id = p_subscription_id,
      status = 'actief',
      gestart_op = coalesce(gestart_op, now()),
      bijgewerkt_op = now()
  where id = p_periodiek_id
    and (status = 'wacht_op_eerste' or (status = 'actief' and mollie_subscription_id = p_subscription_id));
  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- Stopping a monthly gift (stop link in the mail, or office).
-- ---------------------------------------------------------------------------
-- Public information for the stop page. No personal data: only project,
-- amount and status.
create or replace function public.periodiek_info(p_stopcode text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'project_naam', project_naam,
    'bedrag_cent', bedrag_cent,
    'status', status,
    'gestart_op', gestart_op,
    'gestopt_op', gestopt_op
  )
  from public.periodieke_giften
  where stopcode = p_stopcode;
$$;

-- What the function needs to cancel the subscription at Mollie.
-- Give either the stop code (giver) or the id (office).
create or replace function public.periodiek_voor_stoppen(p_stopcode text default null, p_id uuid default null)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'periodiek_id', id,
    'status', status,
    'customer_id', mollie_customer_id,
    'subscription_id', mollie_subscription_id
  )
  from public.periodieke_giften
  where (p_stopcode is not null and stopcode = p_stopcode)
     or (p_id is not null and id = p_id);
$$;

create or replace function public.periodiek_gestopt(p_periodiek_id uuid, p_door text)
returns void
language sql
volatile
set search_path = ''
as $$
  update public.periodieke_giften
  set status = 'gestopt',
      gestopt_door = p_door,
      gestopt_op = now(),
      bijgewerkt_op = now()
  where id = p_periodiek_id and status in ('wacht_op_eerste', 'actief');
$$;

-- ---------------------------------------------------------------------------
-- Thank-you mail: after a paid one-off gift, and after the paid first payment
-- of a monthly gift (not every month). Same claim pattern as the ticket mail.
-- ---------------------------------------------------------------------------
create or replace function public.giftmail_claim(p_gift_id uuid)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_gift public.giften;
begin
  update public.giften g
  set mail_geclaimd_op = now()
  where g.id = p_gift_id
    and g.status = 'betaald'
    and (g.soort = 'eenmalig'
         -- monthly: only once the subscription really runs
         or (g.soort = 'eerste' and exists (select 1 from public.periodieke_giften p
                                           where p.id = g.periodiek_id and p.status = 'actief')))
    and g.mail_verstuurd_op is null
    and (g.mail_geclaimd_op is null or g.mail_geclaimd_op < now() - interval '5 minutes')
  returning * into v_gift;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'gift_id', v_gift.id,
    'soort', v_gift.soort,
    'voornaam', v_gift.voornaam,
    'achternaam', v_gift.achternaam,
    'email', v_gift.email,
    'bedrag_cent', v_gift.bedrag_cent,
    'project_naam', v_gift.project_naam,
    'stopcode', (select p.stopcode from public.periodieke_giften p where p.id = v_gift.periodiek_id)
  );
end;
$$;

create or replace function public.giftmail_klaar(p_gift_id uuid, p_gelukt boolean)
returns void
language sql
volatile
set search_path = ''
as $$
  update public.giften
  set mail_verstuurd_op = case when p_gelukt then now() else mail_verstuurd_op end,
      mail_geclaimd_op = null
  where id = p_gift_id;
$$;

-- Newsletter (MailerLite): only with the separate checkbox, once per gift form.
create or replace function public.gift_nieuwsbrief_claim(p_gift_id uuid)
returns jsonb
language sql
volatile
set search_path = ''
as $$
  update public.giften
  set nieuwsbrief_verwerkt_op = now()
  where id = p_gift_id and status = 'betaald' and soort in ('eenmalig', 'eerste')
    and nieuwsbrief and nieuwsbrief_verwerkt_op is null
  returning jsonb_build_object('email', email, 'voornaam', voornaam, 'achternaam', achternaam);
$$;

create or replace function public.gift_nieuwsbrief_mislukt(p_gift_id uuid)
returns void
language sql
volatile
set search_path = ''
as $$
  update public.giften set nieuwsbrief_verwerkt_op = null where id = p_gift_id;
$$;

-- ---------------------------------------------------------------------------
-- Public information (no personal data)
-- ---------------------------------------------------------------------------
-- Status for the thank-you page.
create or replace function public.gift_status(p_gift_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'status', g.status,
    'soort', g.soort,
    'bedrag_cent', g.bedrag_cent,
    'project_naam', g.project_naam,
    'periodiek', p.status
  )
  from public.giften g
  left join public.periodieke_giften p on p.id = g.periodiek_id
  where g.id = p_gift_id;
$$;

-- Online totals per project for the progress bars. Gifts via the bank are
-- added on the website from Pages CMS.
create or replace function public.projectstanden()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(t.project_slug, jsonb_build_object(
           'opgehaald_cent', t.opgehaald_cent,
           'giften', t.giften,
           'maandelijkse_gevers', coalesce(m.aantal, 0))), '{}'::jsonb)
  from (
    select project_slug, sum(bedrag_cent)::bigint as opgehaald_cent, count(*)::integer as giften
    from public.giften
    where status = 'betaald'
    group by project_slug
  ) t
  left join (
    select project_slug, count(*)::integer as aantal
    from public.periodieke_giften
    where status = 'actief'
    group by project_slug
  ) m on m.project_slug = t.project_slug;
$$;

-- ---------------------------------------------------------------------------
-- Office (beheer function, role kantoor)
-- ---------------------------------------------------------------------------
create or replace function public.giften_overzicht()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(r order by r.project_naam), '[]'::jsonb)
  from (
    select g.project_slug,
           max(g.project_naam) as project_naam,
           coalesce(sum(g.bedrag_cent) filter (where g.status = 'betaald'), 0)::bigint as opgehaald_cent,
           count(*) filter (where g.status = 'betaald')::integer as giften,
           (select count(*) from public.periodieke_giften p
             where p.project_slug = g.project_slug and p.status = 'actief')::integer as maandelijks_actief
    from public.giften g
    group by g.project_slug
  ) r;
$$;

-- All gifts in a period, for the administration. Dates are inclusive and
-- count in Dutch time.
create or replace function public.giften_export(p_van date, p_tot date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'datum', to_char(coalesce(g.betaald_op, g.aangemaakt_op) at time zone 'Europe/Amsterdam', 'YYYY-MM-DD HH24:MI'),
    'project', g.project_naam,
    'soort', g.soort,
    'bedrag', to_char(g.bedrag_cent / 100.0, 'FM999990.00'),
    'status', g.status,
    'voornaam', g.voornaam,
    'achternaam', g.achternaam,
    'email', g.email,
    'maandelijkse_gift', g.periodiek_id,
    'mollie_betaling', g.mollie_payment_id,
    'gift_id', g.id
  ) order by g.aangemaakt_op), '[]'::jsonb)
  from public.giften g
  where (coalesce(g.betaald_op, g.aangemaakt_op) at time zone 'Europe/Amsterdam')::date between p_van and p_tot;
$$;

create or replace function public.periodieke_giften_lijst()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'project', p.project_naam,
    'bedrag_cent', p.bedrag_cent,
    'status', p.status,
    'voornaam', p.voornaam,
    'achternaam', p.achternaam,
    'email', p.email,
    'gestart_op', p.gestart_op,
    'gestopt_op', p.gestopt_op,
    'gestopt_door', p.gestopt_door,
    'betaald_cent', (select coalesce(sum(g.bedrag_cent), 0) from public.giften g
                     where g.periodiek_id = p.id and g.status = 'betaald')
  ) order by p.aangemaakt_op desc), '[]'::jsonb)
  from public.periodieke_giften p
  where p.status in ('actief', 'gestopt');
$$;

-- ---------------------------------------------------------------------------
-- Only the service role (the edge functions) may call these functions.
-- ---------------------------------------------------------------------------
revoke execute on function
  public.maak_gift(text, text, text, text, text, text, integer, boolean),
  public.koppel_klant(uuid, text),
  public.koppel_gift_betaling(uuid, text),
  public.gift_niet_gestart(uuid),
  public.verwerk_gift_betaling(text, text, integer, integer, text, text),
  public.periodiek_klaar_voor_start(uuid),
  public.periodiek_gestart(uuid, text),
  public.periodiek_info(text),
  public.periodiek_voor_stoppen(text, uuid),
  public.periodiek_gestopt(uuid, text),
  public.giftmail_claim(uuid),
  public.giftmail_klaar(uuid, boolean),
  public.gift_nieuwsbrief_claim(uuid),
  public.gift_nieuwsbrief_mislukt(uuid),
  public.gift_status(uuid),
  public.projectstanden(),
  public.giften_overzicht(),
  public.giften_export(date, date),
  public.periodieke_giften_lijst()
from public, anon, authenticated;

grant execute on function
  public.maak_gift(text, text, text, text, text, text, integer, boolean),
  public.koppel_klant(uuid, text),
  public.koppel_gift_betaling(uuid, text),
  public.gift_niet_gestart(uuid),
  public.verwerk_gift_betaling(text, text, integer, integer, text, text),
  public.periodiek_klaar_voor_start(uuid),
  public.periodiek_gestart(uuid, text),
  public.periodiek_info(text),
  public.periodiek_voor_stoppen(text, uuid),
  public.periodiek_gestopt(uuid, text),
  public.giftmail_claim(uuid),
  public.giftmail_klaar(uuid, boolean),
  public.gift_nieuwsbrief_claim(uuid),
  public.gift_nieuwsbrief_mislukt(uuid),
  public.gift_status(uuid),
  public.projectstanden(),
  public.giften_overzicht(),
  public.giften_export(date, date),
  public.periodieke_giften_lijst()
to service_role;
