-- ============================================================
-- Steller POS - Database Schema
-- Jalankan di: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- 1. TABEL CATEGORIES
create table if not exists categories (
  id bigint generated always as identity primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

-- 2. TABEL PRODUCTS
-- (kolom weight, barcode & sold ditambahkan untuk mendukung UI yang sudah ada)
create table if not exists products (
  id bigint generated always as identity primary key,
  name text not null,
  category_id bigint references categories(id) on delete set null,
  weight text,
  barcode text,
  buy_price numeric(14,0) not null default 0,   -- harga_modal
  sell_price numeric(14,0) not null default 0,  -- harga_jual
  stock integer not null default 0,
  sold integer not null default 0,
  created_at timestamptz not null default now()
);

-- 3. TABEL TRANSACTIONS
create table if not exists transactions (
  id bigint generated always as identity primary key,
  trx_code text unique,                          -- contoh: TRX-88402
  cashier_name text,                             -- kasir_nama
  payment_method text not null default 'tunai',  -- metode_pembayaran
  subtotal numeric(14,0) not null default 0,
  discount numeric(14,0) not null default 0,
  tax numeric(14,0) not null default 0,
  total numeric(14,0) not null default 0,        -- total_harga
  cash_paid numeric(14,0),
  change_amount numeric(14,0),
  created_at timestamptz not null default now()  -- tanggal
);

-- 4. TABEL TRANSACTION_ITEMS
create table if not exists transaction_items (
  id bigint generated always as identity primary key,
  transaction_id bigint references transactions(id) on delete cascade,
  product_id bigint references products(id) on delete set null,
  product_name text,
  quantity integer not null default 1,           -- kuantitas
  price numeric(14,0) not null default 0,
  subtotal numeric(14,0) not null default 0
);

-- ============================================================
-- ROW LEVEL SECURITY (akses publik untuk demo/development)
-- Catatan: untuk production, batasi policy sesuai role user.
-- ============================================================
alter table categories enable row level security;
alter table products enable row level security;
alter table transactions enable row level security;
alter table transaction_items enable row level security;

create policy "anon_all_categories" on categories
  for all using (true) with check (true);
create policy "anon_all_products" on products
  for all using (true) with check (true);
create policy "anon_all_transactions" on transactions
  for all using (true) with check (true);
create policy "anon_all_transaction_items" on transaction_items
  for all using (true) with check (true);

-- ============================================================
-- AKTIFKAN REALTIME (agar stok & produk live-update di UI)
-- ============================================================
alter publication supabase_realtime add table products;
alter publication supabase_realtime add table categories;
alter publication supabase_realtime add table transactions;

-- ============================================================
-- SEED DATA (kategori & produk contoh sesuai aplikasi)
-- ============================================================
insert into categories (name)
select v.name from (values
  ('Sembako'), ('Minuman'), ('Makanan'),
  ('Toiletries'), ('Suku Cadang'), ('Elektronik')
) as v(name)
where not exists (select 1 from categories c where c.name = v.name);

insert into products (name, weight, category_id, buy_price, sell_price, stock, sold)
select v.name, v.weight, c.id, v.buy_price, v.sell_price, v.stock, v.sold
from (values
  ('Beras Rojolele',      '5 kg',  'Sembako',     45000, 50000, 25, 150),
  ('Minyak Bimoli',       '2 L',   'Sembako',     36000, 40000, 18, 120),
  ('Gula Pasir',          '1 kg',  'Sembako',     13000, 15000, 15, 90),
  ('Telur Ayam',          '1 kg',  'Sembako',     16000, 18000, 12, 85),
  ('Kopi Kapal Api',      '250 g', 'Minuman',     13000, 15000, 10, 70),
  ('Teh Melati',          '250 g', 'Minuman',     10000, 12000, 20, 65),
  ('Indomie Goreng',      '85 g',  'Makanan',      3000,  3500, 50, 200),
  ('Sabun Lifebuoy',      '110 g', 'Toiletries',   4800,  5500, 30, 110),
  ('Pasta Gigi Pepsodent','190 g', 'Toiletries',  10000, 12000, 25, 95),
  ('Baut M8x10',          '10 pcs','Suku Cadang',  3500,  5000, 100, 60),
  ('Kampas Rem',          '1 set', 'Suku Cadang', 30000, 35000, 50, 45),
  ('Kabel HDMI',          '2 m',   'Elektronik',  38000, 45000, 15, 30),
  ('Mouse Wireless',      '1 pcs', 'Elektronik',  70000, 85000,  8, 22)
) as v(name, weight, category_name, buy_price, sell_price, stock, sold)
join categories c on c.name = v.category_name;

-- ============================================================
-- PLATFORM SETTINGS (Super Admin) — pengaturan metode pembayaran
-- langganan & gambar QRIS platform. Jalankan blok ini sekali
-- di SQL Editor.
-- ============================================================
create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.platform_settings enable row level security;

drop policy if exists "anon_all_platform_settings" on public.platform_settings;
create policy "anon_all_platform_settings" on public.platform_settings
  for all using (true) with check (true);

-- Bucket publik untuk aset platform (gambar QRIS pembayaran langganan)
insert into storage.buckets (id, name, public)
values ('platform-assets', 'platform-assets', true)
on conflict (id) do nothing;

drop policy if exists "platform_assets_read" on storage.objects;
create policy "platform_assets_read" on storage.objects
  for select to public using (bucket_id = 'platform-assets');

drop policy if exists "platform_assets_insert" on storage.objects;
create policy "platform_assets_insert" on storage.objects
  for insert to public with check (bucket_id = 'platform-assets');

drop policy if exists "platform_assets_update" on storage.objects;
create policy "platform_assets_update" on storage.objects
  for update to public using (bucket_id = 'platform-assets');

drop policy if exists "platform_assets_delete" on storage.objects;
create policy "platform_assets_delete" on storage.objects
  for delete to public using (bucket_id = 'platform-assets');

-- ============================================================
-- MERCHANTS (pendaftaran toko & status langganan)
-- status: pending | active | inactive
-- payment_status: unpaid | pending_confirmation | paid
-- ============================================================
create table if not exists public.merchants (
  id bigint generated always as identity primary key,
  store_name text not null,
  owner_name text not null,
  email text not null unique,
  whatsapp text,
  password text,
  plan text not null,
  plan_price integer not null default 0,
  status text not null default 'pending',
  payment_status text not null default 'unpaid',
  payment_proof text,
  address text,
  start_date timestamptz,
  end_date timestamptz,
  created_at timestamptz not null default now()
);

alter table public.merchants enable row level security;

drop policy if exists "anon_all_merchants" on public.merchants;
create policy "anon_all_merchants" on public.merchants
  for all using (true) with check (true);

-- ============================================================
-- MULTI-TENANT: pisahkan data per toko/merchant
-- merchant_id NULL  = data demo bersama (toko contoh)
-- merchant_id terisi = data milik merchant tersebut saja
-- ============================================================
alter table public.categories add column if not exists merchant_id bigint references public.merchants(id) on delete cascade;
-- nama kategori tidak lagi harus unik global (tiap toko boleh punya nama kategori sama)
alter table public.categories drop constraint if exists categories_name_key;
alter table public.products add column if not exists merchant_id bigint references public.merchants(id) on delete cascade;
alter table public.transactions add column if not exists merchant_id bigint references public.merchants(id) on delete cascade;

create index if not exists idx_products_merchant on public.products(merchant_id);
create index if not exists idx_transactions_merchant on public.transactions(merchant_id);

-- Kolom alamat toko (diisi saat pendaftaran, ditampilkan di Pengaturan Toko)
alter table public.merchants add column if not exists address text;

-- ============================================================
-- TABEL EMPLOYEES (Kasir/Supervisor per merchant)
-- merchant_id NULL  = karyawan demo
-- merchant_id terisi = karyawan milik toko tersebut
-- ============================================================
create table if not exists public.employees (
  id bigint generated always as identity primary key,
  merchant_id bigint references public.merchants(id) on delete cascade,
  name text not null,
  role text not null default 'Kasir',
  email text not null unique,
  phone text,
  pin text not null,
  password text not null,
  status text not null default 'active',
  join_date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.employees enable row level security;

drop policy if exists "anon_all_employees" on public.employees;
create policy "anon_all_employees" on public.employees
  for all using (true) with check (true);

create index if not exists idx_employees_merchant on public.employees(merchant_id);

-- Login kasir kini murni email + sandi (PIN dihapus)
alter table public.employees drop column if exists pin;

-- Foto profil owner (data URL / URL storage)
alter table public.merchants add column if not exists avatar_url text;

-- Nominal yang benar-benar dibayar member (untuk verifikasi selisih vs plan_price)
alter table public.merchants add column if not exists paid_amount bigint;

-- Verifikasi akun via OTP WhatsApp/email admin
alter table public.merchants add column if not exists is_verified boolean not null default false;
alter table public.merchants add column if not exists verified_at timestamptz;
alter table public.merchants add column if not exists verification_code text;

-- Kode QR pembayaran milik toko (ditampilkan di kasir saat pelanggan bayar QRIS)
alter table public.merchants add column if not exists qris_url text;
-- Payload EMV QRIS statis toko (untuk membangkitkan QRIS dinamis ber-nominal di kasir)
alter table public.merchants add column if not exists qris_payload text;

-- Deskripsi produk opsional
alter table public.products add column if not exists description text;

-- Penanda reminder langganan terakhir terkirim (10/3/1 hari) — di-reset NULL saat perpanjangan
alter table public.merchants add column if not exists last_reminder_days int;

-- ============================================================
-- TABEL REVIEWS (Ulasan & rating aplikasi dari merchant)
-- Satu ulasan per merchant — upsert berdasarkan merchant_id
-- ============================================================
create table if not exists public.reviews (
  id bigint generated always as identity primary key,
  merchant_id bigint not null unique references public.merchants(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  message text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reviews enable row level security;

drop policy if exists "anon_all_reviews" on public.reviews;
create policy "anon_all_reviews" on public.reviews
  for all using (true) with check (true);

-- ============================================================
-- TABEL HARDWARE_ORDERS (Pesanan Paket Siap Pakai Kasir / device bundle)
-- status: pending_confirmation → diproses → dikirim
-- ============================================================
create table if not exists public.hardware_orders (
  id bigint generated always as identity primary key,
  merchant_id bigint references public.merchants(id) on delete set null,
  customer_name text not null,
  whatsapp text not null,
  email text,
  package_name text not null,
  package_price bigint not null default 0,
  color text not null,
  recipient_name text not null,
  shipping_address text not null,
  paid_amount bigint,
  payment_proof text,
  status text not null default 'pending_confirmation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hardware_orders enable row level security;

drop policy if exists "anon_all_hardware_orders" on public.hardware_orders;
create policy "anon_all_hardware_orders" on public.hardware_orders
  for all using (true) with check (true);

-- Jika tabel sudah terlanjur dibuat dengan skema lama, tambahkan kolom yang kurang
alter table public.hardware_orders add column if not exists merchant_id bigint references public.merchants(id) on delete set null;
alter table public.hardware_orders add column if not exists customer_name text;
alter table public.hardware_orders add column if not exists whatsapp text;
alter table public.hardware_orders add column if not exists email text;
alter table public.hardware_orders add column if not exists package_name text;
alter table public.hardware_orders add column if not exists package_price bigint;
alter table public.hardware_orders add column if not exists color text;
alter table public.hardware_orders add column if not exists recipient_name text;
alter table public.hardware_orders add column if not exists shipping_address text;
alter table public.hardware_orders add column if not exists paid_amount bigint;
alter table public.hardware_orders add column if not exists payment_proof text;
alter table public.hardware_orders add column if not exists status text not null default 'pending_confirmation';
alter table public.hardware_orders add column if not exists created_at timestamptz not null default now();
alter table public.hardware_orders add column if not exists updated_at timestamptz not null default now();

-- Segarkan cache skema PostgREST bila kolom baru saja ditambahkan
notify pgrst, 'reload schema';
