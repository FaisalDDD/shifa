-- Shifa — back-in-stock notifications.
-- When a pharmacy's inventory row becomes available again, notify every customer
-- who subscribed to that product (saved_searches with notification_enabled).

alter table public.saved_searches
  add constraint saved_searches_user_product_uniq unique (user_id, product_id);

create or replace function public.notify_back_in_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prod_name text;
begin
  if new.availability_status = 'AVAILABLE'
     and (old.availability_status is distinct from 'AVAILABLE'
          or (coalesce(old.quantity, 0) <= 0 and coalesce(new.quantity, 0) > 0)) then

    select canonical_name into prod_name
    from public.products
    where id = new.product_id;

    insert into public.notifications (user_id, notification_type, title, body)
    select ss.user_id,
           'back_in_stock',
           'Back in stock',
           coalesce(prod_name, 'A medicine you follow')
             || ' is available again at a pharmacy near you.'
    from public.saved_searches ss
    where ss.product_id = new.product_id
      and ss.notification_enabled = true;

  end if;
  return new;
end;
$$;

drop trigger if exists pharmacy_inventory_back_in_stock on public.pharmacy_inventory;
create trigger pharmacy_inventory_back_in_stock
  after update on public.pharmacy_inventory
  for each row execute function public.notify_back_in_stock();
