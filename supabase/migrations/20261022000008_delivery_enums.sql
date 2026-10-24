-- Optional pharmacy-controlled delivery ordering.
create type public.delivery_order_status as enum ('REQUESTED', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'DELIVERED');
create type public.delivery_payment_status as enum ('PENDING', 'RECEIPT_SUBMITTED', 'CONFIRMED', 'REJECTED');
