-- Healthcare System Database Schema
-- This migration creates all required tables with proper relationships and security

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PATIENT table
create table public.patient (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  date_of_birth date not null,
  gender text check (gender in ('Male', 'Female', 'Other')),
  phone text,
  email text unique,
  address text,
  emergency_contact text,
  blood_type text,
  allergies text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- APPOINTMENT table
create table public.appointment (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patient(id) on delete cascade,
  doctor_id uuid not null,
  appointment_date timestamptz not null,
  duration_minutes int default 30,
  reason text not null,
  status text default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled', 'no-show')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- DIAGNOSIS table
create table public.diagnosis (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patient(id) on delete cascade,
  appointment_id uuid references appointment(id) on delete set null,
  doctor_id uuid not null,
  diagnosis_code text, -- ICD-10 code
  diagnosis_description text not null,
  severity text check (severity in ('mild', 'moderate', 'severe', 'critical')),
  treatment_plan text,
  medications jsonb, -- Array of prescribed medications
  follow_up_required boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- USER table (for doctors, admins, staff)
create table public.app_user (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text not null,
  role text not null check (role in ('doctor', 'admin', 'nurse', 'receptionist')),
  specialization text,
  license_number text,
  phone text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create indexes for better performance
create index idx_patient_email on patient(email);
create index idx_appointment_patient on appointment(patient_id);
create index idx_appointment_date on appointment(appointment_date);
create index idx_diagnosis_patient on diagnosis(patient_id);

-- Enable Row Level Security on all tables
alter table patient enable row level security;
alter table appointment enable row level security;
alter table diagnosis enable row level security;
alter table app_user enable row level security;

-- RLS Policies

-- Patients can view their own records
create policy "patients_view_own" on patient
  for select using (
    auth.uid() in (
      select id from app_user where email = patient.email
    )
  );

-- Healthcare staff can view all patients
create policy "staff_view_all_patients" on patient
  for all using (
    auth.uid() in (
      select id from app_user where role in ('doctor', 'admin', 'nurse')
    )
  );

-- Appointments: patients see their own, staff see all
create policy "appointments_patient_view" on appointment
  for select using (
    patient_id in (
      select id from patient where email = (select email from app_user where id = auth.uid())
    )
  );

create policy "appointments_staff_all" on appointment
  for all using (
    auth.uid() in (
      select id from app_user where role in ('doctor', 'admin', 'nurse', 'receptionist')
    )
  );

-- Diagnosis: strict access control
create policy "diagnosis_patient_read" on diagnosis
  for select using (
    patient_id in (
      select id from patient where email = (select email from app_user where id = auth.uid())
    )
  );

create policy "diagnosis_doctor_all" on diagnosis
  for all using (
    auth.uid() in (
      select id from app_user where role in ('doctor', 'admin')
    )
  );

-- Users can view their own profile
create policy "users_view_own" on app_user
  for select using (auth.uid() = id);

-- Admins can manage all users
create policy "admin_manage_users" on app_user
  for all using (
    auth.uid() in (
      select id from app_user where role = 'admin'
    )
  );

-- Create updated_at trigger function
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply updated_at triggers
create trigger update_patient_updated_at before update on patient
  for each row execute function update_updated_at_column();

create trigger update_appointment_updated_at before update on appointment
  for each row execute function update_updated_at_column();

create trigger update_diagnosis_updated_at before update on diagnosis
  for each row execute function update_updated_at_column();

create trigger update_app_user_updated_at before update on app_user
  for each row execute function update_updated_at_column();

-- Insert sample data for testing
insert into app_user (id, email, full_name, role, specialization)
values 
  ('00000000-0000-0000-0000-000000000001'::uuid, 'admin@healthcare.com', 'System Admin', 'admin', null),
  ('00000000-0000-0000-0000-000000000002'::uuid, 'doctor@healthcare.com', 'Dr. Smith', 'doctor', 'General Practice');

-- Grant necessary permissions
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
grant all on all functions in schema public to anon, authenticated;