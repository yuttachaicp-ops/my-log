-- My Log — โครงฐานข้อมูลสำหรับซิงค์ข้ามเครื่อง
--
-- วิธีใช้: เปิดโปรเจกต์ Supabase ของคุณ → เมนูซ้าย SQL Editor → New query
-- วางทั้งไฟล์นี้ → กด Run ครั้งเดียวจบ
--
-- ความปลอดภัย: ทุกตารางเปิด Row Level Security และผูกกับ user_id ของคนที่ล็อกอิน
-- ต่อให้มีคนรู้ anon key ก็อ่านหรือแก้ข้อมูลของคุณไม่ได้
-- เพราะทุก policy บังคับว่า user_id ต้องตรงกับเจ้าของ token เท่านั้น

-- ---------------------------------------------------------------- ตาราง

create table if not exists public.accounts (
  id               text primary key,
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  kind             text not null,
  icon             text,
  color            text,
  "openingBalance" numeric not null default 0,
  archived         boolean default false
);

create table if not exists public.categories (
  id              text primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  type            text not null,
  icon            text,
  color           text,
  "monthlyBudget" numeric,
  archived        boolean default false
);

create table if not exists public.transactions (
  id            text primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  date          date not null,
  type          text not null,
  name          text not null,
  "categoryId"  text,
  amount        numeric not null,
  "accountId"   text,
  "toAccountId" text,
  note          text,
  source        text,
  "createdAt"   timestamptz,
  "updatedAt"   timestamptz,
  "externalId"  text,
  "recurringId" text
);

create table if not exists public.recurring (
  id           text primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  type         text not null,
  "categoryId" text,
  "accountId"  text,
  amount       numeric not null,
  "dueDay"     int not null,
  note         text,
  active       boolean default true,
  "createdAt"  timestamptz,
  "updatedAt"  timestamptz
);

create table if not exists public.goals (
  id             text primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text not null,
  "targetAmount" numeric not null,
  "savedAmount"  numeric not null default 0,
  "dueDate"      date
);

create table if not exists public.settings (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  opening_balance numeric not null default 0
);

-- ดัชนีที่ใช้บ่อย: ดึงรายการของผู้ใช้คนเดียวเรียงตามวันที่
create index if not exists transactions_user_date_idx
  on public.transactions (user_id, date desc);

-- ------------------------------------------------------ Row Level Security

alter table public.accounts     enable row level security;
alter table public.categories   enable row level security;
alter table public.transactions enable row level security;
alter table public.recurring    enable row level security;
alter table public.goals        enable row level security;
alter table public.settings     enable row level security;

-- policy เดียวกันทุกตาราง: เห็นและแก้ได้เฉพาะแถวที่เป็นของตัวเอง
do $$
declare t text;
begin
  foreach t in array array['accounts','categories','transactions','recurring','goals','settings']
  loop
    execute format('drop policy if exists own_rows on public.%I', t);
    execute format(
      'create policy own_rows on public.%I
         for all
         using (auth.uid() = user_id)
         with check (auth.uid() = user_id)', t);
  end loop;
end $$;
