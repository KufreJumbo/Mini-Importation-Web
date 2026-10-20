-- =====================================================================
-- CHI-BEST STORE — DATABASE SCHEMA (Supabase / PostgreSQL 15+)
-- ---------------------------------------------------------------------
-- Run this whole file once in a NEW Supabase project:
--   Supabase dashboard → SQL Editor → New query → paste → Run.
-- Then run database/seed.sql to load the starting catalogue.
--
-- Design rules
--   * Stock only changes through an inventory movement. A trigger blocks
--     direct edits to products.stock; use the adjust_stock() function.
--     Every unit in or out is recorded in stock_movements.
--   * Orders are priced on the server by place_order(), which locks the
--     products, checks stock and records the sale in the ledger.
--   * Shoppers can read the catalogue (without cost prices) and settings.
--     Orders, customers, requests and the ledger are visible to admins only.
--   * Admins are Supabase Auth users listed in the admins table.
--
-- Safe to re-run: tables use IF NOT EXISTS and functions/policies are
-- replaced. It does not delete data.
-- =====================================================================

-- Refuse to run over the previous (incompatible) Chi-Best schema.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'products' and column_name = 'quantity') then
    raise exception 'An older Chi-Best schema was found (products.quantity). Run this on a fresh Supabase project, or drop the old tables first.';
  end if;
end $$;

create schema if not exists private;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  id         int primary key default 1 check (id = 1),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id          text primary key,
  name        text not null,
  code        text not null default 'GN',
  description text not null default '',
  image       text not null default '',
  sort_order  int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.products (
  id                  uuid primary key default gen_random_uuid(),
  sku                 text not null unique,
  slug                text not null unique,
  name                text not null check (length(name) >= 2),
  description         text not null default '',
  category_id         text not null references public.categories(id) on update cascade,
  brand               text not null default '',
  price               numeric(12,2) not null check (price >= 0),
  compare_at_price    numeric(12,2) check (compare_at_price is null or compare_at_price >= 0),
  cost_price          numeric(12,2) not null default 0 check (cost_price >= 0),
  stock               int not null default 0 check (stock >= 0),
  low_stock_threshold int not null default 5 check (low_stock_threshold >= 0),
  track_inventory     boolean not null default true,
  allow_preorder      boolean not null default false,
  lead_time           text not null default '',
  images              text[] not null default '{}',
  options             jsonb not null default '[]'::jsonb,
  badge               text not null default '',
  featured            boolean not null default false,
  tags                text[] not null default '{}',
  status              text not null default 'active' check (status in ('active', 'draft', 'archived')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists products_category_idx on public.products(category_id);
create index if not exists products_status_idx on public.products(status);

create table if not exists public.stock_movements (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid references public.products(id) on delete set null,
  sku           text not null,
  product_name  text not null,
  type          text not null check (type in ('initial', 'restock', 'return', 'cancellation', 'sale', 'damage', 'adjustment')),
  change        int  not null,
  balance_after int  not null check (balance_after >= 0),
  unit_cost     numeric(12,2),
  reference     text not null default '',
  note          text not null default '',
  actor         text not null default '',
  created_at    timestamptz not null default now()
);
create index if not exists stock_movements_product_idx on public.stock_movements(product_id, created_at desc);
create index if not exists stock_movements_created_idx on public.stock_movements(created_at desc);

create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  order_number      text not null unique,
  status            text not null default 'pending' check (status in ('pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled')),
  payment_status    text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'refunded')),
  payment_method    text not null check (payment_method in ('bank_transfer', 'pay_on_delivery', 'whatsapp')),
  customer_name     text not null,
  customer_phone    text not null,
  customer_email    text not null default '',
  delivery_method   text not null check (delivery_method in ('delivery', 'pickup')),
  delivery_state    text not null default '',
  delivery_city     text not null default '',
  delivery_address  text not null default '',
  delivery_landmark text not null default '',
  delivery_eta      text not null default '',
  notes             text not null default '',
  subtotal          numeric(12,2) not null default 0,
  delivery_fee      numeric(12,2) not null default 0,
  discount          numeric(12,2) not null default 0,
  total             numeric(12,2) not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists orders_created_idx on public.orders(created_at desc);
create index if not exists orders_status_idx on public.orders(status);

create table if not exists public.order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  position    int  not null default 0,
  product_id  uuid references public.products(id) on delete set null,
  sku         text not null,
  name        text not null,
  image       text not null default '',
  slug        text not null default '',
  options     jsonb not null default '{}'::jsonb,
  unit_price  numeric(12,2) not null,
  quantity    int not null check (quantity > 0),
  line_total  numeric(12,2) not null,
  unit_cost   numeric(12,2) not null default 0,
  preorder    boolean not null default false,
  from_stock  boolean not null default false
);
create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists order_items_product_idx on public.order_items(product_id);

create table if not exists public.order_events (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  type       text not null check (type in ('status', 'payment', 'note', 'internal')),
  status     text not null,
  note       text not null default '',
  actor      text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists order_events_order_idx on public.order_events(order_id, created_at);

create table if not exists public.product_requests (
  id                uuid primary key default gen_random_uuid(),
  reference         text not null unique,
  status            text not null default 'new' check (status in ('new', 'sourcing', 'quoted', 'accepted', 'completed', 'declined')),
  customer_name     text not null,
  customer_whatsapp text not null,
  location          text not null default '',
  category          text not null default '',
  description       text not null,
  product_link      text not null default '',
  images            text[] not null default '{}',
  quantity          int not null default 1 check (quantity > 0),
  budget            text not null default '',
  quoted_price      numeric(12,2),
  quoted_days       text not null default '',
  admin_notes       text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists product_requests_created_idx on public.product_requests(created_at desc);

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function private.actor() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select email from auth.users where id = auth.uid()), 'admin');
$$;

create or replace function private.digits(t text) returns text
language sql immutable as $$ select regexp_replace(coalesce(t, ''), '\D', '', 'g'); $$;

create or replace function private.random_code(n int) returns text
language plpgsql volatile as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  out text := '';
begin
  for i in 1..n loop
    out := out || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return out;
end $$;

create or replace function private.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function private.touch_updated_at();

-- Stock may only change inside the inventory functions below.
create or replace function private.guard_stock() returns trigger
language plpgsql as $$
begin
  if (tg_op = 'INSERT' and new.stock <> 0) or (tg_op = 'UPDATE' and new.stock is distinct from old.stock) then
    if coalesce(current_setting('chibest.stock_write', true), '') <> 'on' then
      raise exception 'Stock can only change through an inventory movement. Use adjust_stock().';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists products_guard_stock on public.products;
create trigger products_guard_stock before insert or update of stock on public.products
  for each row execute function private.guard_stock();

-- Applies one stock movement atomically and returns it.
create or replace function private.apply_stock(
  p_product_id uuid, p_type text, p_change int, p_unit_cost numeric,
  p_reference text, p_note text, p_actor text
) returns public.stock_movements
language plpgsql security definer set search_path = public, private as $$
declare
  p  public.products%rowtype;
  mv public.stock_movements;
  new_cost numeric;
begin
  select * into p from public.products where id = p_product_id for update;
  if not found then raise exception 'Product not found.'; end if;
  if p.stock + p_change < 0 then
    raise exception 'Only % unit(s) of % in stock.', p.stock, p.name;
  end if;
  new_cost := p.cost_price;
  if p_type in ('restock', 'initial') and p_unit_cost is not null and p_unit_cost >= 0 and p_change > 0 then
    new_cost := case when p.stock > 0
      then round((p.stock * p.cost_price + p_change * p_unit_cost) / (p.stock + p_change))
      else p_unit_cost end;
  end if;
  perform set_config('chibest.stock_write', 'on', true);
  update public.products set stock = stock + p_change, cost_price = new_cost where id = p.id;
  perform set_config('chibest.stock_write', 'off', true);
  insert into public.stock_movements (product_id, sku, product_name, type, change, balance_after, unit_cost, reference, note, actor)
  values (p.id, p.sku, p.name, p_type, p_change, p.stock + p_change, coalesce(p_unit_cost, new_cost),
          left(coalesce(p_reference, ''), 200), left(coalesce(p_note, ''), 500), coalesce(p_actor, ''))
  returning * into mv;
  return mv;
end $$;

-- Order as JSON. p_full = admin view (costs + internal notes); otherwise customer-safe.
create or replace function private.order_json(p_id uuid, p_full boolean) returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(o) || jsonb_build_object(
    'order_items', coalesce((
      select jsonb_agg(case when p_full then to_jsonb(i) else to_jsonb(i) - 'unit_cost' end order by i.position)
      from public.order_items i where i.order_id = o.id), '[]'::jsonb),
    'order_events', coalesce((
      select jsonb_agg(case when p_full then to_jsonb(e) else to_jsonb(e) - 'actor' end order by e.created_at)
      from public.order_events e where e.order_id = o.id and (p_full or e.type <> 'internal')), '[]'::jsonb))
  from public.orders o where o.id = p_id;
$$;

-- ---------------------------------------------------------------------
-- Inventory (admin)
-- ---------------------------------------------------------------------
create or replace function public.adjust_stock(
  p_product_id uuid, p_type text, p_qty int default null, p_set_to int default null,
  p_unit_cost numeric default null, p_reference text default '', p_note text default ''
) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare
  cur int;
  delta int;
  mv public.stock_movements;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  select stock into cur from public.products where id = p_product_id for update;
  if not found then raise exception 'Product not found.'; end if;
  if p_type = 'adjustment' then
    if p_set_to is null or p_set_to < 0 then raise exception 'Enter the counted quantity (0 or more).'; end if;
    delta := p_set_to - cur;
  elsif p_type in ('initial', 'restock', 'return') then
    if coalesce(p_qty, 0) <= 0 then raise exception 'Quantity must be at least 1.'; end if;
    delta := p_qty;
  elsif p_type = 'damage' then
    if coalesce(p_qty, 0) <= 0 then raise exception 'Quantity must be at least 1.'; end if;
    delta := -p_qty;
  else
    raise exception 'Unknown stock movement type: %', p_type;
  end if;
  mv := private.apply_stock(p_product_id, p_type, delta, p_unit_cost, p_reference, p_note, private.actor());
  return to_jsonb(mv);
end $$;

-- Used only by seed.sql (run from the SQL editor) to record opening stock.
create or replace function private.seed_opening_stock(p_slug text, p_qty int, p_cost numeric)
returns void language plpgsql security definer set search_path = public, private as $$
declare pid uuid;
begin
  select id into pid from public.products where slug = p_slug;
  if pid is null or p_qty <= 0 then return; end if;
  if exists (select 1 from public.stock_movements where product_id = pid) then return; end if;
  perform private.apply_stock(pid, 'initial', p_qty, p_cost, 'Opening stock', '', 'system');
end $$;

-- ---------------------------------------------------------------------
-- Checkout (public)
-- ---------------------------------------------------------------------
create or replace function public.place_order(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare
  s        jsonb;
  c        jsonb := coalesce(payload->'customer', '{}'::jsonb);
  d        jsonb := coalesce(payload->'delivery', '{}'::jsonb);
  v_method text  := coalesce(d->>'method', 'delivery');
  v_state  text  := nullif(trim(coalesce(d->>'state', '')), '');
  v_pay    text  := payload->>'paymentMethod';
  v_id     uuid;
  v_number text;
  v_sub    numeric := 0;
  v_fee    numeric := 0;
  v_free   numeric;
  v_eta    text;
  it       jsonb;
  g        jsonb;
  p        public.products%rowtype;
  v_qty    int;
  v_opts   jsonb;
  v_clean  jsonb;
  v_pre    boolean;
  v_from   boolean;
  v_pos    int := 0;
begin
  if length(trim(coalesce(c->>'name', ''))) < 2 then raise exception 'Enter your full name.'; end if;
  if length(private.digits(c->>'phone')) < 10 then raise exception 'Enter a valid phone number.'; end if;
  if v_method not in ('delivery', 'pickup') then raise exception 'Choose a delivery method.'; end if;
  if v_method = 'delivery' and (v_state is null or length(trim(coalesce(d->>'city', ''))) < 1 or length(trim(coalesce(d->>'address', ''))) < 5) then
    raise exception 'Enter your full delivery address.';
  end if;
  if v_pay is null or v_pay not in ('bank_transfer', 'pay_on_delivery', 'whatsapp') then raise exception 'Choose a payment method.'; end if;
  if jsonb_typeof(payload->'items') <> 'array' or jsonb_array_length(payload->'items') = 0 then raise exception 'Your cart is empty.'; end if;
  if jsonb_array_length(payload->'items') > 50 then raise exception 'Too many items in one order. Please contact us for bulk orders.'; end if;

  select data into s from public.settings where id = 1;
  s := coalesce(s, '{}'::jsonb);
  if v_method = 'pickup' and coalesce((s->'delivery'->>'pickupEnabled')::boolean, true) = false then
    raise exception 'Pickup is not available.';
  end if;
  if v_pay = 'pay_on_delivery' then
    if coalesce((s->'payments'->>'payOnDelivery')::boolean, true) = false then raise exception 'Pay on delivery is not available.'; end if;
    if coalesce((s->'payments'->>'payOnDeliveryLagosOnly')::boolean, true) and v_method <> 'pickup' and v_state <> 'Lagos' then
      raise exception 'Pay on delivery is only available in Lagos.';
    end if;
  end if;
  if v_pay = 'bank_transfer' and coalesce((s->'payments'->>'bankTransfer')::boolean, true) = false then
    raise exception 'Bank transfer is not available.';
  end if;

  loop
    v_number := 'CB' || to_char(now() at time zone 'Africa/Lagos', 'YYMMDD') || '-' || private.random_code(4);
    exit when not exists (select 1 from public.orders where order_number = v_number);
  end loop;

  insert into public.orders (order_number, payment_method, customer_name, customer_phone, customer_email,
                             delivery_method, delivery_state, delivery_city, delivery_address, delivery_landmark, notes)
  values (v_number, v_pay, left(trim(c->>'name'), 120), left(trim(c->>'phone'), 40), left(trim(coalesce(c->>'email', '')), 160),
          v_method, case when v_method = 'pickup' then '' else v_state end,
          left(trim(coalesce(d->>'city', '')), 120), left(trim(coalesce(d->>'address', '')), 300), left(trim(coalesce(d->>'landmark', '')), 200),
          left(trim(coalesce(payload->>'notes', '')), 1000))
  returning id into v_id;

  for it in select value from jsonb_array_elements(payload->'items') loop
    v_qty := greatest(1, least(99, coalesce((it->>'qty')::int, 1)));
    begin
      select * into p from public.products where id = (it->>'productId')::uuid for update;
    exception when invalid_text_representation then
      raise exception 'An item in your cart is no longer available.';
    end;
    if not found or p.status <> 'active' then raise exception 'An item in your cart is no longer available.'; end if;

    -- Only keep options the product actually offers, and require a valid choice for each.
    v_opts := coalesce(it->'options', '{}'::jsonb);
    v_clean := '{}'::jsonb;
    for g in select value from jsonb_array_elements(p.options) loop
      if jsonb_array_length(coalesce(g->'values', '[]'::jsonb)) > 0 then
        if not coalesce((g->'values') ? (v_opts->>(g->>'name')), false) then
          raise exception 'Please choose a % for %.', lower(g->>'name'), p.name;
        end if;
        v_clean := v_clean || jsonb_build_object(g->>'name', v_opts->>(g->>'name'));
      end if;
    end loop;

    v_pre := false; v_from := false;
    if p.track_inventory then
      if p.stock >= v_qty then v_from := true;
      elsif p.stock = 0 and p.allow_preorder then v_pre := true;
      elsif p.stock > 0 then raise exception 'Only % of % left in stock.', p.stock, p.name;
      else raise exception '% is sold out.', p.name;
      end if;
    end if;
    if v_from then
      perform private.apply_stock(p.id, 'sale', -v_qty, null, v_number, '', 'customer');
    end if;

    insert into public.order_items (order_id, position, product_id, sku, name, image, slug, options, unit_price, quantity, line_total, unit_cost, preorder, from_stock)
    values (v_id, v_pos, p.id, p.sku, p.name, coalesce(p.images[1], ''), p.slug, v_clean, p.price, v_qty, p.price * v_qty, p.cost_price, v_pre, v_from);
    v_pos := v_pos + 1;
    v_sub := v_sub + p.price * v_qty;
  end loop;

  if v_method = 'pickup' then
    v_fee := 0;
    v_eta := 'Ready for pickup once confirmed';
  else
    v_free := coalesce((s->'delivery'->>'freeThreshold')::numeric, 0);
    if v_free > 0 and v_sub >= v_free then v_fee := 0;
    elsif v_state = 'Lagos' then v_fee := coalesce((s->'delivery'->>'lagosFee')::numeric, 0);
    else v_fee := coalesce((s->'delivery'->>'otherFee')::numeric, 0);
    end if;
    v_eta := coalesce(case when v_state = 'Lagos' then s->'delivery'->>'lagosTime' else s->'delivery'->>'otherTime' end, '');
  end if;

  update public.orders set subtotal = v_sub, delivery_fee = v_fee, total = v_sub + v_fee, delivery_eta = v_eta where id = v_id;
  insert into public.order_events (order_id, type, status, note, actor) values (v_id, 'status', 'pending', 'Order placed', 'customer');
  return private.order_json(v_id, false);
end $$;

create or replace function public.track_order(p_number text, p_phone text) returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare v_id uuid;
begin
  if length(private.digits(p_phone)) < 10 then return null; end if;
  select id into v_id from public.orders
   where upper(order_number) = upper(trim(p_number))
     and right(private.digits(customer_phone), 10) = right(private.digits(p_phone), 10);
  if v_id is null then return null; end if;
  return private.order_json(v_id, false);
end $$;

create or replace function public.submit_request(payload jsonb) returns text
language plpgsql security definer set search_path = public, private as $$
declare
  v_ref  text;
  v_link text := trim(coalesce(payload->>'link', ''));
  v_imgs text[] := '{}';
  img    text;
begin
  if length(trim(coalesce(payload->>'customerName', ''))) < 2 then raise exception 'Enter your name.'; end if;
  if length(private.digits(payload->>'whatsapp')) < 10 then raise exception 'Enter a valid WhatsApp number.'; end if;
  if length(trim(coalesce(payload->>'description', ''))) < 5 then raise exception 'Tell us a little about the product.'; end if;
  if v_link !~* '^https?://' then v_link := ''; end if;
  if jsonb_typeof(payload->'images') = 'array' then
    for img in select value from jsonb_array_elements_text(payload->'images') limit 4 loop
      if img ~* '^data:image/(png|jpe?g|webp|gif);base64,' and length(img) < 600000 then
        v_imgs := v_imgs || img;
      end if;
    end loop;
  end if;
  loop
    v_ref := 'RQ-' || private.random_code(5);
    exit when not exists (select 1 from public.product_requests where reference = v_ref);
  end loop;
  insert into public.product_requests (reference, customer_name, customer_whatsapp, location, category, description, product_link, images, quantity, budget)
  values (v_ref, left(trim(payload->>'customerName'), 120), left(trim(payload->>'whatsapp'), 40), left(coalesce(payload->>'location', ''), 80),
          left(coalesce(payload->>'category', ''), 80), left(trim(payload->>'description'), 4000), left(v_link, 1000), v_imgs,
          greatest(1, least(100000, coalesce((payload->>'quantity')::int, 1))), left(coalesce(payload->>'budget', ''), 80));
  return v_ref;
end $$;

-- ---------------------------------------------------------------------
-- Order management (admin)
-- ---------------------------------------------------------------------
create or replace function public.update_order_status(p_order_id uuid, p_status text, p_note text default '') returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare
  o public.orders%rowtype;
  i public.order_items%rowtype;
  who text;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if p_status not in ('pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled') then
    raise exception 'Unknown status.';
  end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;
  if o.status = 'cancelled' then raise exception 'Cancelled orders cannot be changed.'; end if;
  if p_status = o.status and length(trim(coalesce(p_note, ''))) = 0 then raise exception 'Choose a new status or add a note.'; end if;
  who := private.actor();
  if p_status = 'cancelled' then
    for i in select * from public.order_items where order_id = o.id and from_stock and product_id is not null loop
      perform private.apply_stock(i.product_id, 'cancellation', i.quantity, null, o.order_number, 'Restocked from cancelled order', who);
    end loop;
  end if;
  update public.orders set status = p_status, updated_at = now() where id = o.id;
  insert into public.order_events (order_id, type, status, note, actor) values (o.id, 'status', p_status, left(trim(coalesce(p_note, '')), 1000), who);
  return private.order_json(o.id, true);
end $$;

create or replace function public.set_payment_status(p_order_id uuid, p_status text, p_note text default '') returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare o public.orders%rowtype;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if p_status not in ('unpaid', 'paid', 'refunded') then raise exception 'Unknown payment status.'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;
  if o.payment_status = p_status then raise exception 'Payment is already marked %.', p_status; end if;
  update public.orders set payment_status = p_status, updated_at = now() where id = o.id;
  insert into public.order_events (order_id, type, status, note, actor)
  values (o.id, 'payment', o.status, concat_ws('. ', 'Payment marked as ' || p_status, nullif(trim(coalesce(p_note, '')), '')), private.actor());
  return private.order_json(o.id, true);
end $$;

create or replace function public.add_order_note(p_order_id uuid, p_note text, p_internal boolean default false) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare o public.orders%rowtype;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if length(trim(coalesce(p_note, ''))) = 0 then raise exception 'Write a note first.'; end if;
  select * into o from public.orders where id = p_order_id;
  if not found then raise exception 'Order not found.'; end if;
  insert into public.order_events (order_id, type, status, note, actor)
  values (o.id, case when p_internal then 'internal' else 'note' end, o.status, left(trim(p_note), 1000), private.actor());
  update public.orders set updated_at = now() where id = o.id;
  return private.order_json(o.id, true);
end $$;

-- ---------------------------------------------------------------------
-- Public catalogue view (no cost prices)
-- ---------------------------------------------------------------------
create or replace view public.storefront_products as
  select id, sku, slug, name, description, category_id, brand, price, compare_at_price, stock, low_stock_threshold,
         track_inventory, allow_preorder, lead_time, images, options, badge, featured, tags, status, created_at, updated_at
  from public.products
  where status = 'active';

-- ---------------------------------------------------------------------
-- Privileges & row level security
-- ---------------------------------------------------------------------
revoke all on schema private from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.storefront_products, public.categories, public.settings to anon, authenticated;
grant select, insert, update, delete on public.products, public.categories, public.settings, public.product_requests to authenticated;
grant select on public.stock_movements, public.orders, public.order_items, public.order_events, public.admins to authenticated;
grant delete on public.orders to authenticated;
grant execute on function public.place_order(jsonb), public.track_order(text, text), public.submit_request(jsonb), public.is_admin() to anon, authenticated;
revoke execute on function public.adjust_stock(uuid, text, int, int, numeric, text, text), public.update_order_status(uuid, text, text),
  public.set_payment_status(uuid, text, text), public.add_order_note(uuid, text, boolean) from public, anon;
grant execute on function public.adjust_stock(uuid, text, int, int, numeric, text, text), public.update_order_status(uuid, text, text),
  public.set_payment_status(uuid, text, text), public.add_order_note(uuid, text, boolean) to authenticated;

alter table public.admins           enable row level security;
alter table public.settings         enable row level security;
alter table public.categories       enable row level security;
alter table public.products         enable row level security;
alter table public.stock_movements  enable row level security;
alter table public.orders           enable row level security;
alter table public.order_items      enable row level security;
alter table public.order_events     enable row level security;
alter table public.product_requests enable row level security;

do $$
declare t text;
begin
  -- Drop and recreate our policies so this file can be re-run.
  for t in select unnest(array['admins', 'settings', 'categories', 'products', 'stock_movements', 'orders', 'order_items', 'order_events', 'product_requests']) loop
    execute format('drop policy if exists "admin all" on public.%I', t);
    execute format('drop policy if exists "public read" on public.%I', t);
    execute format('drop policy if exists "own row" on public.%I', t);
  end loop;
end $$;

create policy "own row"     on public.admins           for select using (user_id = auth.uid());
create policy "public read" on public.settings         for select using (true);
create policy "admin all"   on public.settings         for all    using (public.is_admin()) with check (public.is_admin());
create policy "public read" on public.categories       for select using (active or public.is_admin());
create policy "admin all"   on public.categories       for all    using (public.is_admin()) with check (public.is_admin());
create policy "admin all"   on public.products         for all    using (public.is_admin()) with check (public.is_admin());
create policy "admin all"   on public.stock_movements  for select using (public.is_admin());
create policy "admin all"   on public.orders           for select using (public.is_admin());
create policy "admin all"   on public.order_items      for select using (public.is_admin());
create policy "admin all"   on public.order_events     for select using (public.is_admin());
create policy "admin all"   on public.product_requests for all    using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin delete" on public.orders;
create policy "admin delete" on public.orders for delete using (public.is_admin());

-- ---------------------------------------------------------------------
-- Product image storage
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "chibest images read"   on storage.objects;
drop policy if exists "chibest images insert" on storage.objects;
drop policy if exists "chibest images update" on storage.objects;
drop policy if exists "chibest images delete" on storage.objects;
create policy "chibest images read"   on storage.objects for select using (bucket_id = 'product-images');
create policy "chibest images insert" on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and public.is_admin());
create policy "chibest images update" on storage.objects for update to authenticated using (bucket_id = 'product-images' and public.is_admin());
create policy "chibest images delete" on storage.objects for delete to authenticated using (bucket_id = 'product-images' and public.is_admin());

-- ---------------------------------------------------------------------
-- Default store settings (keep in step with js/config.js defaults).
-- Checkout fees are calculated from this row on the server.
-- ---------------------------------------------------------------------
insert into public.settings (id, data) values (1, '{
  "storeName": "Chi-Best",
  "tagline": "Global finds, delivered to Nigeria",
  "whatsapp": "2340000000000",
  "phone": "+234 000 000 0000",
  "email": "info@chibest.com",
  "address": "Lagos, Nigeria",
  "delivery": { "lagosFee": 4000, "otherFee": 7500, "freeThreshold": 150000, "lagosTime": "1-3 working days",
                "otherTime": "3-7 working days", "pickupEnabled": true,
                "pickupNote": "Pickup from our Lagos office. Address shared on confirmation." },
  "preorderLeadTime": "14-21 days",
  "returnsDays": 7,
  "payments": { "bankTransfer": true, "bankName": "", "accountName": "", "accountNumber": "",
                "payOnDelivery": true, "payOnDeliveryLagosOnly": true },
  "inventory": { "defaultLowStock": 5 },
  "announcements": ["Free delivery on orders over {freeThreshold}",
                    "Pre-order straight from China, delivered in {preorderLeadTime}",
                    "Pay on delivery available in Lagos"]
}'::jsonb)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Make yourself an admin (run after creating your user under
-- Authentication → Users). Replace the email, then run:
--
--   insert into public.admins (user_id, email)
--   select id, email from auth.users where email = 'you@example.com'
--   on conflict do nothing;
-- ---------------------------------------------------------------------
