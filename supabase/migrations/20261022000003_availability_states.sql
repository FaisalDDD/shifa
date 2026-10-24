-- Add the enum value in its own migration so PostgreSQL can commit it
-- before later statements use it.
alter type public.availability_status add value if not exists 'LOW_STOCK';
