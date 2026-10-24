-- MedFind — development seed data
-- ALL of this data is fictional demonstration data. Every product and
-- pharmacy is flagged is_demo = true so production startup can exclude it.
-- Production must NOT auto-insert these rows; use the admin import path.

-- ---------------------------------------------------------------------------
-- Pharmacies (fictional, clustered around a demo city centre)
-- ---------------------------------------------------------------------------

insert into public.pharmacies
  (id, name, slug, description, address, city, postal_code, country_code,
   latitude, longitude, phone, website, verification_status, is_active, is_demo, opening_hours, services)
values
  ('10000000-0000-4000-8000-000000000001', 'Apotheke am Markt (Demo)', 'demo-apotheke-am-markt',
   'Fictional demonstration pharmacy. Fully verified.', '1 Demo Square', 'Demo City', '10001', 'DE',
   52.5200, 13.4050, '+49 30 0000 001', null, 'verified', true, true,
   '[{"day":0,"open":null,"close":null,"closed":true},{"day":1,"open":"08:00","close":"19:00","closed":false},{"day":2,"open":"08:00","close":"19:00","closed":false},{"day":3,"open":"08:00","close":"19:00","closed":false},{"day":4,"open":"08:00","close":"19:00","closed":false},{"day":5,"open":"08:00","close":"19:00","closed":false},{"day":6,"open":"09:00","close":"16:00","closed":false}]'::jsonb,
   array['prescription_dispensing', 'flu_vaccination']),

  ('10000000-0000-4000-8000-000000000002', 'Central Pharmacy (Demo)', 'demo-central-pharmacy',
   'Fictional demonstration pharmacy.', '22 Demo Avenue', 'Demo City', '10001', 'DE',
   52.5240, 13.4100, '+49 30 0000 002', 'https://example-pharmacy.example', 'verified', true, true,
   '[{"day":0,"open":null,"close":null,"closed":true},{"day":1,"open":"09:00","close":"20:00","closed":false},{"day":2,"open":"09:00","close":"20:00","closed":false},{"day":3,"open":"09:00","close":"20:00","closed":false},{"day":4,"open":"09:00","close":"20:00","closed":false},{"day":5,"open":"09:00","close":"20:00","closed":false},{"day":6,"open":"10:00","close":"18:00","closed":false}]'::jsonb,
   array['prescription_dispensing', 'home_delivery']),

  ('10000000-0000-4000-8000-000000000003', 'Green Cross Pharmacy (Demo)', 'demo-green-cross',
   'Fictional demonstration pharmacy.', '5 Demo Street', 'Demo City', '10002', 'DE',
   52.5180, 13.3980, '+49 30 0000 003', null, 'verified', true, true,
   '[{"day":0,"open":null,"close":null,"closed":true},{"day":1,"open":"08:30","close":"18:30","closed":false},{"day":2,"open":"08:30","close":"18:30","closed":false},{"day":3,"open":"08:30","close":"18:30","closed":false},{"day":4,"open":"08:30","close":"18:30","closed":false},{"day":5,"open":"08:30","close":"18:30","closed":false},{"day":6,"open":"09:00","close":"14:00","closed":false}]'::jsonb,
   array['prescription_dispensing']),

  ('10000000-0000-4000-8000-000000000004', 'Sunrise Pharmacy (Demo)', 'demo-sunrise-pharmacy',
   'Fictional demonstration pharmacy.', '90 Demo Boulevard', 'Demo City', '10003', 'DE',
   52.5280, 13.4150, '+49 30 0000 004', null, 'verified', true, true,
   null, array['prescription_dispensing', 'flu_vaccination', 'blood_pressure_testing']),

  ('10000000-0000-4000-8000-000000000005', 'Old Town Pharmacy (Demo)', 'demo-old-town-pharmacy',
   'Fictional demonstration pharmacy.', '14 Demo Lane', 'Old Town', '10004', 'DE',
   52.5150, 13.3900, '+49 30 0000 005', null, 'pending', true, true,
   null, array['prescription_dispensing']),

  ('10000000-0000-4000-8000-000000000006', 'Harbor Pharmacy (Demo)', 'demo-harbor-pharmacy',
   'Fictional demonstration pharmacy.', '3 Demo Quay', 'Demo City', '10005', 'DE',
   52.5300, 13.3800, '+49 30 0000 006', null, 'verified', true, true,
   null, array['prescription_dispensing', 'home_delivery']),

  ('10000000-0000-4000-8000-000000000007', 'Northside Pharmacy (Demo)', 'demo-northside-pharmacy',
   'Fictional demonstration pharmacy.', '77 Demo Road', 'Demo City', '10006', 'DE',
   52.5400, 13.4200, '+49 30 0000 007', null, 'verified', true, true,
   null, array['prescription_dispensing']),

  ('10000000-0000-4000-8000-000000000008', '24/7 Night Pharmacy (Demo)', 'demo-24-7-night-pharmacy',
   'Fictional demonstration pharmacy, open around the clock.', '8 Demo Ring', 'Demo City', '10001', 'DE',
   52.5220, 13.4070, '+49 30 0000 008', null, 'verified', true, true,
   '[{"day":0,"open":"00:00","close":"23:59","closed":false},{"day":1,"open":"00:00","close":"23:59","closed":false},{"day":2,"open":"00:00","close":"23:59","closed":false},{"day":3,"open":"00:00","close":"23:59","closed":false},{"day":4,"open":"00:00","close":"23:59","closed":false},{"day":5,"open":"00:00","close":"23:59","closed":false},{"day":6,"open":"00:00","close":"23:59","closed":false}]'::jsonb,
   array['prescription_dispensing', 'emergency_service']),

  -- A suspended/inactive demo pharmacy (hidden from search, kept for moderation demo).
  ('10000000-0000-4000-8000-000000000009', 'Closed Down Pharmacy (Demo)', 'demo-closed-down-pharmacy',
   'Fictional demonstration pharmacy marked inactive.', '404 Demo Way', 'Demo City', '10007', 'DE',
   52.5190, 13.4120, '+49 30 0000 009', null, 'suspended', false, true,
   null, array['prescription_dispensing']);

-- ---------------------------------------------------------------------------
-- Products (fictional/example entries; do not treat as real medicine data)
-- ---------------------------------------------------------------------------

insert into public.products
  (id, canonical_name, brand_name, strength, dosage_form, barcode, product_identifier, prescription_classification, is_demo)
values
  ('a0000000-0000-4000-8000-000000000001', 'Paracetamol', 'Panadol', '500 mg', 'tablet', '5000157000001', 'DEMO-PARA-500', 'otc', true),
  ('a0000000-0000-4000-8000-000000000002', 'Ibuprofen', 'Nurofen', '200 mg', 'tablet', '5000157000002', 'DEMO-IBU-200', 'otc', true),
  ('a0000000-0000-4000-8000-000000000003', 'Ibuprofen', 'Nurofen', '400 mg', 'tablet', '5000157000003', 'DEMO-IBU-400', 'otc', true),
  ('a0000000-0000-4000-8000-000000000004', 'Acetylsalicylic Acid', 'Aspirin', '100 mg', 'tablet', '5000157000004', 'DEMO-ASA-100', 'otc', true),
  ('a0000000-0000-4000-8000-000000000005', 'Acetylsalicylic Acid', 'Aspirin', '500 mg', 'tablet', '5000157000005', 'DEMO-ASA-500', 'otc', true),
  ('a0000000-0000-4000-8000-000000000006', 'Cetirizine', 'Zyrtec', '10 mg', 'tablet', '5000157000006', 'DEMO-CET-10', 'otc', true),
  ('a0000000-0000-4000-8000-000000000007', 'Loratadine', 'Claritin', '10 mg', 'tablet', '5000157000007', 'DEMO-LOR-10', 'otc', true),
  ('a0000000-0000-4000-8000-000000000008', 'Diphenhydramine', 'Benadryl', '25 mg', 'capsule', '5000157000008', 'DEMO-DIP-25', 'otc', true),
  ('a0000000-0000-4000-8000-000000000009', 'Pseudoephedrine', 'Sudafed', '30 mg', 'tablet', '5000157000009', 'DEMO-PSE-30', 'otc', true),
  ('a0000000-0000-4000-8000-000000000010', 'Cold & Flu Relief', 'DemoCold', null, 'tablet', '5000157000010', 'DEMO-COLD-1', 'otc', true),
  ('a0000000-0000-4000-8000-000000000011', 'Ascorbic Acid', 'DemoVita', '1000 mg', 'effervescent tablet', '5000157000011', 'DEMO-VITC-1000', 'otc', true),
  ('a0000000-0000-4000-8000-000000000012', 'Cholecalciferol', 'DemoVita', '2000 IU', 'capsule', '5000157000012', 'DEMO-VITD-2000', 'otc', true),
  ('a0000000-0000-4000-8000-000000000013', 'Omeprazole', 'Losec', '20 mg', 'capsule', '5000157000013', 'DEMO-OME-20', 'otc', true),
  ('a0000000-0000-4000-8000-000000000014', 'Loperamide', 'Imodium', '2 mg', 'capsule', '5000157000014', 'DEMO-LOP-2', 'otc', true),
  ('a0000000-0000-4000-8000-000000000015', 'Oral Rehydration Salts', 'DemoHydra', null, 'powder sachet', '5000157000015', 'DEMO-ORS-1', 'otc', true),
  ('a0000000-0000-4000-8000-000000000016', 'Chlorhexidine Antiseptic Cream', 'DemoCare', '1 %', 'cream', '5000157000016', 'DEMO-CHX-1', 'otc', true),
  ('a0000000-0000-4000-8000-000000000017', 'Hydrocortisone', 'DemoCare', '1 %', 'cream', '5000157000017', 'DEMO-HC-1', 'otc', true),
  ('a0000000-0000-4000-8000-000000000018', 'Ibuprofen Gel', 'Nurofen', '5 %', 'gel', '5000157000018', 'DEMO-IBUGEL-5', 'otc', true),
  ('a0000000-0000-4000-8000-000000000019', 'Amoxicillin', 'DemoRx', '500 mg', 'capsule', '5000157000019', 'DEMO-AMOX-500', 'prescription', true),
  ('a0000000-0000-4000-8000-000000000020', 'Amoxicillin', 'DemoRx', '250 mg/5 ml', 'oral suspension', '5000157000020', 'DEMO-AMOX-250S', 'prescription', true),
  ('a0000000-0000-4000-8000-000000000021', 'Metformin', 'DemoRx', '500 mg', 'tablet', '5000157000021', 'DEMO-MET-500', 'prescription', true),
  ('a0000000-0000-4000-8000-000000000022', 'Atorvastatin', 'DemoRx', '20 mg', 'tablet', '5000157000022', 'DEMO-ATO-20', 'prescription', true),
  ('a0000000-0000-4000-8000-000000000023', 'Levothyroxine', 'DemoRx', '50 mcg', 'tablet', '5000157000023', 'DEMO-LEVO-50', 'prescription', true),
  ('a0000000-0000-4000-8000-000000000024', 'Amlodipine', 'DemoRx', '5 mg', 'tablet', '5000157000024', 'DEMO-AMLO-5', 'prescription', true),
  ('a0000000-0000-4000-8000-000000000025', 'Salbutamol', 'DemoRx', '100 mcg/dose', 'inhaler', '5000157000025', 'DEMO-SALB-100', 'prescription', true),
  ('a0000000-0000-4000-8000-000000000026', 'Ramipril', 'DemoRx', '5 mg', 'tablet', '5000157000026', 'DEMO-RAMI-5', 'prescription', true),
  ('a0000000-0000-4000-8000-000000000027', 'Sertraline', 'DemoRx', '50 mg', 'tablet', '5000157000027', 'DEMO-SERT-50', 'prescription', true),
  ('a0000000-0000-4000-8000-000000000028', 'Pantoprazole', 'DemoRx', '40 mg', 'tablet', '5000157000028', 'DEMO-PAN-40', 'prescription', true),
  ('a0000000-0000-4000-8000-000000000029', 'Insulin Glargine', 'DemoRx', '100 U/ml', 'injection', '5000157000029', 'DEMO-INS-G', 'prescription', true),
  ('a0000000-0000-4000-8000-000000000030', 'Nasal Saline Spray', 'DemoCare', null, 'nasal spray', '5000157000030', 'DEMO-SALINE', 'otc', true),
  ('a0000000-0000-4000-8000-000000000031', 'Dextromethorphan Cough Syrup', 'DemoCold', '10 mg/5 ml', 'syrup', '5000157000031', 'DEMO-DXM-10', 'otc', true),
  ('a0000000-0000-4000-8000-000000000032', 'Benzocaine Throat Lozenges', 'DemoCold', '5 mg', 'lozenge', '5000157000032', 'DEMO-BENZ-5', 'otc', true),
  ('a0000000-0000-4000-8000-000000000033', 'Sunscreen SPF 50', 'DemoCare', null, 'lotion', '5000157000033', 'DEMO-SPF-50', 'otc', true),
  ('a0000000-0000-4000-8000-000000000034', 'Adhesive Plasters', 'DemoCare', null, 'plaster', '5000157000034', 'DEMO-PLAST', 'otc', true),
  ('a0000000-0000-4000-8000-000000000035', 'Digital Thermometer', 'DemoCare', null, 'device', '5000157000035', 'DEMO-THERM', 'otc', true),
  ('a0000000-0000-4000-8000-000000000036', 'Ketotifen Eye Drops', 'DemoCare', '0.25 mg/ml', 'eye drops', '5000157000036', 'DEMO-KETO-025', 'otc', true);

-- ---------------------------------------------------------------------------
-- Active ingredients
-- ---------------------------------------------------------------------------

insert into public.product_active_ingredients (product_id, active_ingredient) values
  ('a0000000-0000-4000-8000-000000000001', 'paracetamol'),
  ('a0000000-0000-4000-8000-000000000002', 'ibuprofen'),
  ('a0000000-0000-4000-8000-000000000003', 'ibuprofen'),
  ('a0000000-0000-4000-8000-000000000004', 'acetylsalicylic acid'),
  ('a0000000-0000-4000-8000-000000000005', 'acetylsalicylic acid'),
  ('a0000000-0000-4000-8000-000000000006', 'cetirizine'),
  ('a0000000-0000-4000-8000-000000000007', 'loratadine'),
  ('a0000000-0000-4000-8000-000000000008', 'diphenhydramine'),
  ('a0000000-0000-4000-8000-000000000009', 'pseudoephedrine'),
  ('a0000000-0000-4000-8000-000000000010', 'paracetamol'),
  ('a0000000-0000-4000-8000-000000000010', 'phenylephrine'),
  ('a0000000-0000-4000-8000-000000000011', 'ascorbic acid'),
  ('a0000000-0000-4000-8000-000000000012', 'cholecalciferol'),
  ('a0000000-0000-4000-8000-000000000013', 'omeprazole'),
  ('a0000000-0000-4000-8000-000000000014', 'loperamide'),
  ('a0000000-0000-4000-8000-000000000016', 'chlorhexidine'),
  ('a0000000-0000-4000-8000-000000000017', 'hydrocortisone'),
  ('a0000000-0000-4000-8000-000000000018', 'ibuprofen'),
  ('a0000000-0000-4000-8000-000000000019', 'amoxicillin'),
  ('a0000000-0000-4000-8000-000000000020', 'amoxicillin'),
  ('a0000000-0000-4000-8000-000000000021', 'metformin'),
  ('a0000000-0000-4000-8000-000000000022', 'atorvastatin'),
  ('a0000000-0000-4000-8000-000000000023', 'levothyroxine'),
  ('a0000000-0000-4000-8000-000000000024', 'amlodipine'),
  ('a0000000-0000-4000-8000-000000000025', 'salbutamol'),
  ('a0000000-0000-4000-8000-000000000026', 'ramipril'),
  ('a0000000-0000-4000-8000-000000000027', 'sertraline'),
  ('a0000000-0000-4000-8000-000000000028', 'pantoprazole'),
  ('a0000000-0000-4000-8000-000000000029', 'insulin glargine'),
  ('a0000000-0000-4000-8000-000000000031', 'dextromethorphan'),
  ('a0000000-0000-4000-8000-000000000032', 'benzocaine'),
  ('a0000000-0000-4000-8000-000000000036', 'ketotifen');

-- ---------------------------------------------------------------------------
-- Inventory (varied availability + freshness to exercise the display rules)
-- ---------------------------------------------------------------------------

insert into public.pharmacy_inventory
  (pharmacy_id, product_id, availability_status, quantity, price, currency, source, last_updated_at, last_verified_at, updated_by, expires_at)
values
  -- Pharmacy 1: Apotheke am Markt
  ('10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'AVAILABLE', 20, 2.50, 'EUR', 'PHARMACY_MANUAL', now() - interval '30 minutes', now() - interval '30 minutes', null, now() + interval '7 days'),
  ('10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'AVAILABLE', 15, 4.20, 'EUR', 'PHARMACY_MANUAL', now() - interval '5 hours', now() - interval '5 hours', null, now() + interval '7 days'),
  ('10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000006', 'OUT_OF_STOCK', 0, null, null, 'PHARMACY_MANUAL', now() - interval '30 hours', now() - interval '30 hours', null, null),
  ('10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000011', 'AVAILABLE', 40, 3.10, 'EUR', 'PHARMACY_MANUAL', now() - interval '1 hour', now() - interval '1 hour', null, now() + interval '7 days'),
  ('10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000019', 'UNKNOWN', null, null, null, 'PHARMACY_MANUAL', now() - interval '2 days', null, null, null),

  -- Pharmacy 2: Central
  ('10000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'AVAILABLE', 8, 2.70, 'EUR', 'PHARMACY_MANUAL', now() - interval '30 hours', now() - interval '30 hours', null, now() + interval '7 days'),
  ('10000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003', 'AVAILABLE', 25, 5.40, 'EUR', 'PHARMACY_MANUAL', now() - interval '40 minutes', now() - interval '40 minutes', null, now() + interval '7 days'),
  ('10000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000007', 'AVAILABLE', 18, 6.00, 'EUR', 'VERIFIED_INVENTORY_INTEGRATION', now() - interval '3 hours', now() - interval '3 hours', null, now() + interval '7 days'),
  ('10000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000021', 'UNKNOWN', null, null, null, 'PHARMACY_MANUAL', now() - interval '3 days', null, null, null),

  -- Pharmacy 3: Green Cross
  ('10000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004', 'AVAILABLE', 30, 1.90, 'EUR', 'PHARMACY_MANUAL', now() - interval '15 minutes', now() - interval '15 minutes', null, now() + interval '7 days'),
  ('10000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000006', 'AVAILABLE', 12, 4.90, 'EUR', 'PHARMACY_MANUAL', now() - interval '4 hours', now() - interval '4 hours', null, now() + interval '7 days'),
  ('10000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000017', 'AVAILABLE', 9, 7.50, 'EUR', 'PHARMACY_MANUAL', now() - interval '2 hours', now() - interval '2 hours', null, now() + interval '7 days'),
  ('10000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000020', 'UNKNOWN', null, null, null, 'PHARMACY_MANUAL', now() - interval '1 day', null, null, null),

  -- Pharmacy 4: Sunrise
  ('10000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002', 'OUT_OF_STOCK', 0, null, null, 'PHARMACY_MANUAL', now() - interval '10 minutes', now() - interval '10 minutes', null, null),
  ('10000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000008', 'AVAILABLE', 22, 5.20, 'EUR', 'PHARMACY_MANUAL', now() - interval '2 hours', now() - interval '2 hours', null, now() + interval '7 days'),
  ('10000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000013', 'AVAILABLE', 14, 6.80, 'EUR', 'PHARMACY_MANUAL', now() - interval '6 hours', now() - interval '6 hours', null, now() + interval '7 days'),
  ('10000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000025', 'AVAILABLE', 4, 15.00, 'EUR', 'PHARMACY_MANUAL', now() - interval '1 hour', now() - interval '1 hour', null, now() + interval '7 days'),

  -- Pharmacy 5: Old Town (pending verification — still listed, not yet verified)
  ('10000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'AVAILABLE', 10, 2.60, 'EUR', 'PHARMACY_MANUAL', now() - interval '8 hours', now() - interval '8 hours', null, now() + interval '7 days'),
  ('10000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000030', 'AVAILABLE', 20, 3.30, 'EUR', 'PHARMACY_MANUAL', now() - interval '1 hour', now() - interval '1 hour', null, now() + interval '7 days'),

  -- Pharmacy 6: Harbor
  ('10000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000009', 'AVAILABLE', 7, 8.90, 'EUR', 'PHARMACY_MANUAL', now() - interval '12 hours', now() - interval '12 hours', null, now() + interval '7 days'),
  ('10000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000015', 'AVAILABLE', 35, 1.20, 'EUR', 'PHARMACY_MANUAL', now() - interval '20 minutes', now() - interval '20 minutes', null, now() + interval '7 days'),
  ('10000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000028', 'UNKNOWN', null, null, null, 'PHARMACY_MANUAL', now() - interval '4 days', null, null, null),

  -- Pharmacy 7: Northside
  ('10000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000003', 'AVAILABLE', 11, 5.50, 'EUR', 'PHARMACY_MANUAL', now() - interval '50 minutes', now() - interval '50 minutes', null, now() + interval '7 days'),
  ('10000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000027', 'AVAILABLE', 6, 12.00, 'EUR', 'PHARMACY_MANUAL', now() - interval '3 hours', now() - interval '3 hours', null, now() + interval '7 days'),
  ('10000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000033', 'AVAILABLE', 16, 9.99, 'EUR', 'PHARMACY_MANUAL', now() - interval '2 days', now() - interval '2 days', null, now() + interval '7 days'),

  -- Pharmacy 8: 24/7
  ('10000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000001', 'AVAILABLE', 60, 2.45, 'EUR', 'PHARMACY_MANUAL', now() - interval '5 minutes', now() - interval '5 minutes', null, now() + interval '7 days'),
  ('10000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000003', 'AVAILABLE', 30, 5.20, 'EUR', 'PHARMACY_MANUAL', now() - interval '25 minutes', now() - interval '25 minutes', null, now() + interval '7 days'),
  ('10000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000014', 'AVAILABLE', 18, 3.60, 'EUR', 'PHARMACY_MANUAL', now() - interval '1 hour', now() - interval '1 hour', null, now() + interval '7 days'),
  ('10000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000026', 'OUT_OF_STOCK', 0, null, null, 'PHARMACY_MANUAL', now() - interval '2 hours', now() - interval '2 hours', null, null);
