-- Supabase schema for Argus web

-- Students table
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  nim text unique not null,
  name text not null,
  email text,
  password_hash text,
  created_at timestamptz default now()
);

-- Seats table: 6x6 mapping
create table if not exists seats (
  id uuid primary key default gen_random_uuid(),
  row integer,
  col integer,
  class_code text not null default 'default',
  seat_number integer,
  device_id text,
  status text not null default 'empty', -- 'empty' | 'occupied' | 'absent'
  student_nim text,
  student_name text,
  updated_at timestamptz default now(),
  constraint unique_seat unique (class_code, seat_number)
);

-- initial seats (6x6)
do $$
begin
  if (select count(*) from seats) = 0 then
    for i in 1..36 loop
      insert into seats (row, col, class_code, seat_number, status) values (null, null, 'default', i, 'empty');
    end loop;
  end if;
end$$;

-- Classes table to group seats per classroom/session
create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text,
  created_at timestamptz default now()
);

-- Seat history for audit
create table if not exists seat_history (
  id uuid primary key default gen_random_uuid(),
  seat_id uuid,
  class_code text,
  seat_number integer,
  action text,
  student_nim text,
  student_name text,
  device_id text,
  performed_by text,
  created_at timestamptz default now()
);

-- Optional: admin single credential can be stored in a simple table (or configure via env variables)
create table if not exists admin_credential (
  id serial primary key,
  nim text not null,
  password_hash text not null
);
