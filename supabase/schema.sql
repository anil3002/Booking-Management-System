create extension if not exists btree_gist;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  room_no text not null,
  room_nos text[] not null,
  guest_name text not null,
  customer_phone_number text not null default '',
  number_of_persons integer not null check (number_of_persons >= 1),
  id_type text not null,
  id_number text not null,
  number_of_children integer not null default 0 check (number_of_children >= 0),
  check_in_datetime timestamp not null,
  check_out_datetime timestamp not null,
  actual_checkout_datetime timestamp null,
  advance_taken numeric not null default 0 check (advance_taken >= 0),
  total_payment numeric not null default 0 check (total_payment >= 0),
  remaining_balance numeric not null default 0,
  notes text,
  status text not null default 'booked' check (status in ('booked', 'checked_in', 'checked_out', 'cancelled')),
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  constraint valid_booking_range check (check_out_datetime > check_in_datetime),
  constraint valid_room_no check (room_no in ('111','112','113','114','115','116','117','118','119','120')),
  constraint valid_room_nos check (
    cardinality(room_nos) > 0
    and room_nos <@ array['111','112','113','114','115','116','117','118','119','120']::text[]
  )
);

alter table public.bookings
add column if not exists room_nos text[];

alter table public.bookings
add column if not exists customer_phone_number text not null default '';

alter table public.bookings
drop constraint if exists valid_room_no;

alter table public.bookings
drop constraint if exists valid_room_nos;

update public.bookings
set room_nos = array[room_no]
where room_nos is null or cardinality(room_nos) = 0;

update public.bookings
set
  room_no = (room_no::integer + 10)::text,
  room_nos = (
    select array_agg((room_no_item::integer + 10)::text order by room_no_ordinality)
    from unnest(room_nos) with ordinality as room_no_items(room_no_item, room_no_ordinality)
  )
where room_no in ('101','102','103','104','105','106','107','108','109','110');

alter table public.bookings
alter column room_nos set not null;

alter table public.bookings
add constraint valid_room_no check (room_no in ('111','112','113','114','115','116','117','118','119','120'));

alter table public.bookings
add constraint valid_room_nos check (
  cardinality(room_nos) > 0
  and room_nos <@ array['111','112','113','114','115','116','117','118','119','120']::text[]
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bookings_set_updated_at on public.bookings;

create trigger bookings_set_updated_at
before update on public.bookings
for each row
execute function public.set_updated_at();

alter table public.bookings
drop constraint if exists prevent_active_room_overlap;

alter table public.bookings
add constraint prevent_active_room_overlap
exclude using gist (
  room_no with =,
  tsrange(check_in_datetime, check_out_datetime, '[)') with &&
)
where (status not in ('checked_out', 'cancelled'));

create index if not exists bookings_room_status_dates_idx
on public.bookings (room_no, status, check_in_datetime, check_out_datetime);

create index if not exists bookings_room_no_idx
on public.bookings (room_no);

create index if not exists bookings_room_nos_idx
on public.bookings using gin (room_nos);

create index if not exists bookings_check_in_datetime_idx
on public.bookings (check_in_datetime);

create index if not exists bookings_check_out_datetime_idx
on public.bookings (check_out_datetime);

create index if not exists bookings_status_idx
on public.bookings (status);

alter table public.bookings enable row level security;

drop policy if exists "Allow public read bookings" on public.bookings;
drop policy if exists "Allow public insert bookings" on public.bookings;
drop policy if exists "Allow public update bookings" on public.bookings;

create policy "Allow public read bookings"
on public.bookings
for select
to anon
using (true);

create policy "Allow public insert bookings"
on public.bookings
for insert
to anon
with check (true);

create policy "Allow public update bookings"
on public.bookings
for update
to anon
using (true)
with check (true);
