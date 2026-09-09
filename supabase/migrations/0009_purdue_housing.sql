-- Canonical public metadata only; never enrollment or competition identity.
-- Source: Purdue University Residences directory, verified 2026-09-09.
create table public.purdue_housing_catalog (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  official_name text not null,
  aliases text[] not null default '{}',
  campus text not null check (campus = 'west-lafayette'),
  housing_type text not null check (housing_type = 'residence_hall'),
  active boolean not null,
  term text not null check (term = 'fall-2026'),
  laundry_payment_category text check (laundry_payment_category = 'included_in_rate'),
  verified_at date not null,
  source_url text not null check (source_url like 'https://www.housing.purdue.edu/%')
);
alter table public.purdue_housing_catalog enable row level security;
revoke all on public.purdue_housing_catalog from anon, authenticated;
grant select on public.purdue_housing_catalog to anon, authenticated;
create policy purdue_housing_public_read on public.purdue_housing_catalog
  for select to anon, authenticated using (true);

insert into public.purdue_housing_catalog
  (slug, official_name, aliases, campus, housing_type, active, term, laundry_payment_category, verified_at, source_url)
values
  ('cary-quadrangle', 'Cary Quadrangle', array['Cary Quad', 'Cary'], 'west-lafayette', 'residence_hall', true, 'fall-2026', null, '2026-09-09', 'https://www.housing.purdue.edu/my-housing/options/residence-halls/cary-quad.html'),
  ('earhart-hall', 'Earhart Hall', array['Earhart'], 'west-lafayette', 'residence_hall', true, 'fall-2026', null, '2026-09-09', 'https://www.housing.purdue.edu/my-housing/options/residence-halls/earhart.html'),
  ('first-street-towers', 'First Street Towers', array['FST', 'First Street'], 'west-lafayette', 'residence_hall', true, 'fall-2026', 'included_in_rate', '2026-09-09', 'https://www.housing.purdue.edu/my-housing/options/residence-halls/first-street.html'),
  ('winifred-parker-hall', 'Winifred Parker Hall', array['Winifred Parker', 'Parker South'], 'west-lafayette', 'residence_hall', true, 'fall-2026', null, '2026-09-09', 'https://www.housing.purdue.edu/my-housing/options/residence-halls/parker-south.html'),
  ('frieda-parker-hall', 'Frieda Parker Hall', array['Frieda Parker', 'Parker North'], 'west-lafayette', 'residence_hall', true, 'fall-2026', null, '2026-09-09', 'https://www.housing.purdue.edu/my-housing/options/residence-halls/parker-north.html'),
  ('harrison-hall', 'Harrison Hall', array['Harrison'], 'west-lafayette', 'residence_hall', true, 'fall-2026', null, '2026-09-09', 'https://www.housing.purdue.edu/my-housing/options/residence-halls/harrison.html'),
  ('hawkins-hall', 'Hawkins Hall', array['Hawkins'], 'west-lafayette', 'residence_hall', true, 'fall-2026', null, '2026-09-09', 'https://www.housing.purdue.edu/my-housing/options/residence-halls/hawkins.html'),
  ('hillenbrand-hall', 'Hillenbrand Hall', array['Hillenbrand'], 'west-lafayette', 'residence_hall', true, 'fall-2026', null, '2026-09-09', 'https://www.housing.purdue.edu/my-housing/options/residence-halls/hillenbrand.html'),
  ('honors-college-and-residences', 'Honors College and Residences', array['Honors College', 'Honors Residences'], 'west-lafayette', 'residence_hall', true, 'fall-2026', null, '2026-09-09', 'https://www.housing.purdue.edu/my-housing/options/residence-halls/honors-college.html'),
  ('mccutcheon-hall', 'McCutcheon Hall', array['McCutcheon', 'McCutchen'], 'west-lafayette', 'residence_hall', true, 'fall-2026', null, '2026-09-09', 'https://www.housing.purdue.edu/my-housing/options/residence-halls/mccutcheon.html'),
  ('meredith-hall', 'Meredith Hall', array['Meredith'], 'west-lafayette', 'residence_hall', true, 'fall-2026', null, '2026-09-09', 'https://www.housing.purdue.edu/my-housing/options/residence-halls/meredith.html'),
  ('meredith-south', 'Meredith South', array['Meredith South'], 'west-lafayette', 'residence_hall', true, 'fall-2026', null, '2026-09-09', 'https://www.housing.purdue.edu/my-housing/options/residence-halls/meredith-south.html'),
  ('owen-hall', 'Owen Hall', array['Owen'], 'west-lafayette', 'residence_hall', true, 'fall-2026', null, '2026-09-09', 'https://www.housing.purdue.edu/my-housing/options/residence-halls/owen.html'),
  ('shreve-hall', 'Shreve Hall', array['Shreve'], 'west-lafayette', 'residence_hall', true, 'fall-2026', null, '2026-09-09', 'https://www.housing.purdue.edu/my-housing/options/residence-halls/shreve.html'),
  ('south-hall', 'South Hall', array['South'], 'west-lafayette', 'residence_hall', true, 'fall-2026', null, '2026-09-09', 'https://www.housing.purdue.edu/my-housing/options/residence-halls/south-hall.html'),
  ('tarkington-hall', 'Tarkington Hall', array['Tark', 'Tarkington'], 'west-lafayette', 'residence_hall', true, 'fall-2026', null, '2026-09-09', 'https://www.housing.purdue.edu/my-housing/options/residence-halls/tarkington.html'),
  ('wiley-hall', 'Wiley Hall', array['Wiley'], 'west-lafayette', 'residence_hall', true, 'fall-2026', null, '2026-09-09', 'https://www.housing.purdue.edu/my-housing/options/residence-halls/wiley.html'),
  ('windsor-halls', 'Windsor Halls', array['Windsor'], 'west-lafayette', 'residence_hall', true, 'fall-2026', null, '2026-09-09', 'https://www.housing.purdue.edu/my-housing/options/residence-halls/windsor.html');
