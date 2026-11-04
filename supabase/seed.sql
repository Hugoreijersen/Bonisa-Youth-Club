-- Test data for local development only (`supabase db reset`).
-- Never used in the real project. The real event is created as described in
-- docs/ticketsysteem.md.
insert into public.events (slug, naam, begint_op, locatie, prijs_cent, max_tickets,
                           max_per_bestelling, verkoop_open_vanaf, verkoop_dicht_op)
values ('jongerenzang-2027', 'Katwijkse Jongerenzang 2027', '2027-05-21 19:45:00+02',
        'Nieuwe Kerk Katwijk', 450, 500, 10, now() - interval '1 day', null);
