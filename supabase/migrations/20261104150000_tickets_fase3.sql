-- Ticket system, phase 3: ticket mail, ticket page, scanning and management.
-- Explanation in Dutch: docs/ticketsysteem.md
-- Same security model as phase 2: only the service role (edge functions) may
-- call these functions; visitors and logged-in users cannot touch the tables.

-- ---------------------------------------------------------------------------
-- New columns
-- ---------------------------------------------------------------------------
alter table public.orders
  -- Secret for the personal ticket page (/tickets/mijn/#<toegang>). 128 random bits.
  add column toegang text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  add column mail_verstuurd_op timestamptz,
  -- Short lease so the webhook and the thank-you page never send the mail twice.
  add column mail_geclaimd_op timestamptz,
  add column nieuwsbrief_verwerkt_op timestamptz;

comment on column public.orders.toegang is 'Geheime sleutel voor de ticketpagina; staat alleen in de ticketmail.';

-- ---------------------------------------------------------------------------
-- verwerk_betaling: same as phase 2, but always returns the order id, so the
-- function can (re)try the ticket mail when Mollie calls again.
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
    else v_order.status
  end::public.order_status;

  if v_order.status in ('betaald', 'terugbetaald') and v_nieuw in ('open', 'mislukt', 'verlopen') then
    v_nieuw := v_order.status;
  end if;

  if v_nieuw = v_order.status then
    return jsonb_build_object('resultaat', 'ongewijzigd', 'status', v_order.status, 'order_id', v_order.id);
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
-- Ticket mail
-- ---------------------------------------------------------------------------
-- Claims the ticket mail of a paid order and returns what the mail needs.
-- Returns null when there is nothing to send (not paid, already sent, or
-- someone else is sending it right now). p_opnieuw: send again (office).
create or replace function public.ticketmail_claim(p_order_id uuid, p_opnieuw boolean default false)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  update public.orders o
  set mail_geclaimd_op = now()
  where o.id = p_order_id
    and o.status = 'betaald'
    and (p_opnieuw or o.mail_verstuurd_op is null)
    and (o.mail_geclaimd_op is null or o.mail_geclaimd_op < now() - interval '5 minutes')
  returning * into v_order;

  if not found then
    return null;
  end if;

  return (
    select jsonb_build_object(
      'order_id', v_order.id,
      'voornaam', v_order.voornaam,
      'achternaam', v_order.achternaam,
      'email', v_order.email,
      'aantal', v_order.aantal,
      'bedrag_cent', v_order.bedrag_cent,
      'toegang', v_order.toegang,
      'evenement', jsonb_build_object('naam', e.naam, 'begint_op', e.begint_op, 'locatie', e.locatie),
      'tickets', (select jsonb_agg(jsonb_build_object('volgnummer', t.volgnummer, 'code', t.code) order by t.volgnummer)
                  from public.tickets t where t.order_id = v_order.id)
    )
    from public.events e where e.id = v_order.event_id
  );
end;
$$;

create or replace function public.ticketmail_klaar(p_order_id uuid, p_gelukt boolean)
returns void
language sql
volatile
set search_path = ''
as $$
  update public.orders
  set mail_verstuurd_op = case when p_gelukt then now() else mail_verstuurd_op end,
      mail_geclaimd_op = null
  where id = p_order_id;
$$;

-- ---------------------------------------------------------------------------
-- Newsletter (MailerLite): only for paid orders with the separate checkbox.
-- ---------------------------------------------------------------------------
create or replace function public.nieuwsbrief_claim(p_order_id uuid)
returns jsonb
language sql
volatile
set search_path = ''
as $$
  update public.orders
  set nieuwsbrief_verwerkt_op = now()
  where id = p_order_id and status = 'betaald' and nieuwsbrief and nieuwsbrief_verwerkt_op is null
  returning jsonb_build_object('email', email, 'voornaam', voornaam, 'achternaam', achternaam);
$$;

-- If MailerLite failed: try again next time.
create or replace function public.nieuwsbrief_mislukt(p_order_id uuid)
returns void
language sql
volatile
set search_path = ''
as $$
  update public.orders set nieuwsbrief_verwerkt_op = null where id = p_order_id;
$$;

-- ---------------------------------------------------------------------------
-- Personal ticket page. Only first name: the page link can be forwarded.
-- ---------------------------------------------------------------------------
create or replace function public.mijn_tickets(p_toegang text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'status', o.status,
    'voornaam', o.voornaam,
    'aantal', o.aantal,
    'evenement', jsonb_build_object('naam', e.naam, 'begint_op', e.begint_op, 'locatie', e.locatie),
    'tickets', case when o.status = 'betaald' then
      (select jsonb_agg(jsonb_build_object('volgnummer', t.volgnummer, 'code', t.code, 'gescand_op', t.gescand_op)
                        order by t.volgnummer)
       from public.tickets t where t.order_id = o.id)
      else '[]'::jsonb end
  )
  from public.orders o
  join public.events e on e.id = o.event_id
  where o.toegang = p_toegang;
$$;

-- ---------------------------------------------------------------------------
-- Admins
-- ---------------------------------------------------------------------------
create or replace function public.rol_van(p_user_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select rol::text from public.beheerders where user_id = p_user_id;
$$;

-- ---------------------------------------------------------------------------
-- Scanning at the door. One atomic update: a ticket can only be let in once,
-- even when two scanners scan the same code at the same moment.
-- ---------------------------------------------------------------------------
create or replace function public.scan_ticket(p_slug text, p_code text, p_user_id uuid)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_event   public.events;
  v_ticket  public.tickets;
  v_order   public.orders;
  v_eerder  boolean := false;
begin
  select * into v_event from public.events where slug = p_slug;
  if not found then
    raise exception 'onbekend_evenement';
  end if;

  update public.tickets t
  set gescand_op = now(), gescand_door = p_user_id
  from public.orders o
  where t.code = lower(p_code) and o.id = t.order_id
    and o.event_id = v_event.id and o.status = 'betaald' and t.gescand_op is null
  returning t.* into v_ticket;

  if not found then
    select t.* into v_ticket from public.tickets t where t.code = lower(p_code);
    if not found then
      return jsonb_build_object('resultaat', 'onbekend');
    end if;
    v_eerder := true;
  end if;

  select * into v_order from public.orders where id = v_ticket.order_id;

  return jsonb_build_object(
    'resultaat', case
      when v_order.event_id <> v_event.id then 'ander_evenement'
      when v_order.status <> 'betaald' then 'ongeldig'
      when v_eerder then 'al_gescand'
      else 'geldig' end,
    'gescand_op', v_ticket.gescand_op,
    'volgnummer', v_ticket.volgnummer,
    'aantal', v_order.aantal,
    'voornaam', v_order.voornaam,
    'binnen', (select count(*) from public.tickets t join public.orders o on o.id = t.order_id
               where o.event_id = v_event.id and o.status = 'betaald' and t.gescand_op is not null),
    'verkocht', (select coalesce(sum(aantal), 0) from public.orders
                 where event_id = v_event.id and status = 'betaald')
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Figures for the management page.
-- ---------------------------------------------------------------------------
create or replace function public.beheer_overzicht(p_slug text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'evenement', to_jsonb(e),
    'verkocht', coalesce((select sum(aantal) from public.orders where event_id = e.id and status = 'betaald'), 0),
    'bestellingen', (select count(*) from public.orders where event_id = e.id and status = 'betaald'),
    'opbrengst_cent', coalesce((select sum(bedrag_cent) from public.orders where event_id = e.id and status = 'betaald'), 0),
    'gereserveerd', coalesce((select sum(aantal) from public.orders
                              where event_id = e.id and status = 'open' and aangemaakt_op > now() - interval '30 minutes'), 0),
    'plaatsen_vrij', greatest(public.plaatsen_vrij(e.id), 0),
    'gescand', (select count(*) from public.tickets t join public.orders o on o.id = t.order_id
                where o.event_id = e.id and o.status = 'betaald' and t.gescand_op is not null),
    'nieuwsbrief', (select count(*) from public.orders where event_id = e.id and status = 'betaald' and nieuwsbrief),
    'mail_niet_verstuurd', (select count(*) from public.orders
                            where event_id = e.id and status = 'betaald' and mail_verstuurd_op is null),
    'verkoop', public.evenement_info(e.slug) ->> 'verkoop'
  )
  from public.events e
  where e.slug = p_slug;
$$;

-- ---------------------------------------------------------------------------
-- Rights: only the service role.
-- ---------------------------------------------------------------------------
revoke execute on function
  public.ticketmail_claim(uuid, boolean),
  public.ticketmail_klaar(uuid, boolean),
  public.nieuwsbrief_claim(uuid),
  public.nieuwsbrief_mislukt(uuid),
  public.mijn_tickets(text),
  public.rol_van(uuid),
  public.scan_ticket(text, text, uuid),
  public.beheer_overzicht(text)
from public, anon, authenticated;

grant execute on function
  public.ticketmail_claim(uuid, boolean),
  public.ticketmail_klaar(uuid, boolean),
  public.nieuwsbrief_claim(uuid),
  public.nieuwsbrief_mislukt(uuid),
  public.mijn_tickets(text),
  public.rol_van(uuid),
  public.scan_ticket(text, text, uuid),
  public.beheer_overzicht(text)
to service_role;
