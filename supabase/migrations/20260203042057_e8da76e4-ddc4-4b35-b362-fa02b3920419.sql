-- Create enums for status types
CREATE TYPE public.doctor_status AS ENUM ('available', 'busy', 'offline');
CREATE TYPE public.appointment_status AS ENUM ('scheduled', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show');
CREATE TYPE public.token_status AS ENUM ('waiting', 'serving', 'completed', 'skipped');
CREATE TYPE public.gender_type AS ENUM ('male', 'female', 'other');

-- Departments table
CREATE TABLE public.departments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Doctors table
CREATE TABLE public.doctors (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE NOT NULL,
    specialization TEXT,
    qualification TEXT,
    experience_years INTEGER DEFAULT 0,
    status doctor_status NOT NULL DEFAULT 'offline',
    avg_consultation_time INTEGER DEFAULT 15,
    room_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Patients table
CREATE TABLE public.patients (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    name TEXT NOT NULL,
    mobile TEXT NOT NULL,
    age INTEGER,
    gender gender_type,
    address TEXT,
    blood_group TEXT,
    emergency_contact TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Time slots table
CREATE TABLE public.time_slots (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    doctor_id UUID REFERENCES public.doctors(id) ON DELETE CASCADE NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    max_patients INTEGER DEFAULT 20,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Appointments table
CREATE TABLE public.appointments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    appointment_id TEXT NOT NULL UNIQUE,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    doctor_id UUID REFERENCES public.doctors(id) ON DELETE CASCADE NOT NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE NOT NULL,
    appointment_date DATE NOT NULL,
    slot_time TIME NOT NULL,
    status appointment_status NOT NULL DEFAULT 'scheduled',
    symptoms TEXT,
    is_emergency BOOLEAN DEFAULT false,
    predicted_wait_time INTEGER,
    actual_wait_time INTEGER,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Queue tokens table
CREATE TABLE public.queue_tokens (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    token_number INTEGER NOT NULL,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE NOT NULL UNIQUE,
    doctor_id UUID REFERENCES public.doctors(id) ON DELETE CASCADE NOT NULL,
    queue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status token_status NOT NULL DEFAULT 'waiting',
    position INTEGER NOT NULL,
    is_emergency BOOLEAN DEFAULT false,
    check_in_time TIMESTAMP WITH TIME ZONE,
    called_time TIMESTAMP WITH TIME ZONE,
    completed_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(doctor_id, queue_date, token_number)
);

-- Notifications table
CREATE TABLE public.notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    is_read BOOLEAN DEFAULT false,
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Chat messages for AI chatbot
CREATE TABLE public.chat_messages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    language TEXT DEFAULT 'en',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for departments (public read)
CREATE POLICY "Departments are viewable by everyone" 
ON public.departments FOR SELECT 
USING (true);

-- RLS Policies for doctors (public read)
CREATE POLICY "Doctors are viewable by everyone" 
ON public.doctors FOR SELECT 
USING (true);

CREATE POLICY "Doctors can update their own record" 
ON public.doctors FOR UPDATE 
USING (user_id IS NOT NULL AND user_id = (SELECT auth.uid()));

-- RLS Policies for patients
CREATE POLICY "Patients can view their own profile" 
ON public.patients FOR SELECT 
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Patients can insert their own profile" 
ON public.patients FOR INSERT 
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Patients can update their own profile" 
ON public.patients FOR UPDATE 
USING (user_id = (SELECT auth.uid()));

-- RLS Policies for time_slots (public read)
CREATE POLICY "Time slots are viewable by everyone" 
ON public.time_slots FOR SELECT 
USING (true);

-- RLS Policies for appointments
CREATE POLICY "Patients can view own appointments" 
ON public.appointments FOR SELECT 
USING (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = (SELECT auth.uid()))
);

CREATE POLICY "Patients can create appointments" 
ON public.appointments FOR INSERT 
WITH CHECK (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = (SELECT auth.uid()))
);

CREATE POLICY "Patients can update own appointments" 
ON public.appointments FOR UPDATE 
USING (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = (SELECT auth.uid()))
);

CREATE POLICY "Doctors can view their appointments" 
ON public.appointments FOR SELECT 
USING (
    doctor_id IN (SELECT id FROM public.doctors WHERE user_id = (SELECT auth.uid()))
);

CREATE POLICY "Doctors can update their appointments" 
ON public.appointments FOR UPDATE 
USING (
    doctor_id IN (SELECT id FROM public.doctors WHERE user_id = (SELECT auth.uid()))
);

-- RLS Policies for queue_tokens (public read for TV display)
CREATE POLICY "Queue tokens viewable by everyone" 
ON public.queue_tokens FOR SELECT 
USING (true);

CREATE POLICY "Patients can insert tokens" 
ON public.queue_tokens FOR INSERT 
WITH CHECK (
    appointment_id IN (
        SELECT a.id FROM public.appointments a
        JOIN public.patients p ON p.id = a.patient_id
        WHERE p.user_id = (SELECT auth.uid())
    )
);

CREATE POLICY "Doctors can update queue tokens" 
ON public.queue_tokens FOR UPDATE 
USING (
    doctor_id IN (SELECT id FROM public.doctors WHERE user_id = (SELECT auth.uid()))
);

-- RLS Policies for notifications
CREATE POLICY "Patients can view own notifications" 
ON public.notifications FOR SELECT 
USING (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = (SELECT auth.uid()))
);

CREATE POLICY "Patients can update own notifications" 
ON public.notifications FOR UPDATE 
USING (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = (SELECT auth.uid()))
);

-- RLS Policies for chat_messages
CREATE POLICY "Users can view own chat messages" 
ON public.chat_messages FOR SELECT 
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own chat messages" 
ON public.chat_messages FOR INSERT 
WITH CHECK (user_id = (SELECT auth.uid()));

-- Function to generate appointment ID
CREATE OR REPLACE FUNCTION public.generate_appointment_id()
RETURNS TRIGGER AS $$
BEGIN
    NEW.appointment_id := 'APT-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_appointment_id
BEFORE INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.generate_appointment_id();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_doctors_updated_at
BEFORE UPDATE ON public.doctors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_patients_updated_at
BEFORE UPDATE ON public.patients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_queue_tokens_updated_at
BEFORE UPDATE ON public.queue_tokens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert seed data for departments
INSERT INTO public.departments (name, description, icon) VALUES
('General Medicine', 'Primary healthcare and general consultations', 'stethoscope'),
('Pediatrics', 'Child healthcare and pediatric services', 'baby'),
('Orthopedics', 'Bone, joint, and muscle care', 'bone'),
('Cardiology', 'Heart and cardiovascular care', 'heart-pulse'),
('Dermatology', 'Skin, hair, and nail care', 'scan-face'),
('ENT', 'Ear, nose, and throat specialist', 'ear'),
('Ophthalmology', 'Eye care and vision services', 'eye'),
('Gynecology', 'Women health and reproductive care', 'heart'),
('Neurology', 'Brain and nervous system care', 'brain'),
('Dental', 'Oral health and dental care', 'smile');

-- Insert sample doctors
INSERT INTO public.doctors (name, department_id, specialization, qualification, experience_years, status, avg_consultation_time, room_number) 
SELECT 
    'Dr. Rajesh Kumar', id, 'General Physician', 'MBBS, MD', 15, 'available', 12, 'Room 101'
FROM public.departments WHERE name = 'General Medicine';

INSERT INTO public.doctors (name, department_id, specialization, qualification, experience_years, status, avg_consultation_time, room_number) 
SELECT 
    'Dr. Priya Sharma', id, 'Pediatrician', 'MBBS, DCH', 10, 'available', 15, 'Room 102'
FROM public.departments WHERE name = 'Pediatrics';

INSERT INTO public.doctors (name, department_id, specialization, qualification, experience_years, status, avg_consultation_time, room_number) 
SELECT 
    'Dr. Amit Patel', id, 'Cardiologist', 'MBBS, DM Cardiology', 20, 'busy', 20, 'Room 103'
FROM public.departments WHERE name = 'Cardiology';

INSERT INTO public.doctors (name, department_id, specialization, qualification, experience_years, status, avg_consultation_time, room_number) 
SELECT 
    'Dr. Sneha Gupta', id, 'Orthopedic Surgeon', 'MBBS, MS Ortho', 12, 'available', 18, 'Room 104'
FROM public.departments WHERE name = 'Orthopedics';

INSERT INTO public.doctors (name, department_id, specialization, qualification, experience_years, status, avg_consultation_time, room_number) 
SELECT 
    'Dr. Vikram Singh', id, 'Dermatologist', 'MBBS, MD Dermatology', 8, 'offline', 10, 'Room 105'
FROM public.departments WHERE name = 'Dermatology';

INSERT INTO public.doctors (name, department_id, specialization, qualification, experience_years, status, avg_consultation_time, room_number) 
SELECT 
    'Dr. Anita Desai', id, 'ENT Specialist', 'MBBS, MS ENT', 14, 'available', 15, 'Room 106'
FROM public.departments WHERE name = 'ENT';

-- Enable realtime for queue_tokens and appointments and doctors
ALTER PUBLICATION supabase_realtime ADD TABLE public.queue_tokens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.doctors;