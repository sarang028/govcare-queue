import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Department, Doctor } from '@/types/database';
import { DepartmentCard } from '@/components/departments/DepartmentCard';
import { DoctorCard } from '@/components/doctors/DoctorCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  Clock, 
  Users, 
  Activity,
  ArrowRight,
  MessageCircle,
  Tv,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';

interface AppointmentWithDoctor {
  id: string;
  appointment_id: string;
  appointment_date: string;
  slot_time: string;
  is_emergency: boolean;
  doctor?: { name: string; room_number: string | null; department?: { name: string } };
}

export default function HomePage() {
  const { user, patient } = useAuth();
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<AppointmentWithDoctor[]>([]);
  const [stats, setStats] = useState({
    totalDoctors: 0,
    availableDoctors: 0,
    todayAppointments: 0,
  });

  useEffect(() => {
    fetchData();
  }, [user, patient]);

  const fetchData = async () => {
    // Fetch departments
    const { data: deptData } = await supabase
      .from('departments')
      .select('*')
      .order('name');
    
    if (deptData) setDepartments(deptData);

    // Fetch doctors with realtime status
    const { data: doctorData } = await supabase
      .from('doctors')
      .select('*, department:departments(*)')
      .order('name');
    
    if (doctorData) {
      setDoctors(doctorData);
      setStats(prev => ({
        ...prev,
        totalDoctors: doctorData.length,
        availableDoctors: doctorData.filter(d => d.status === 'available').length,
      }));
    }

    // Fetch upcoming appointments for logged in patient
    if (patient) {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: appointmentData } = await supabase
        .from('appointments')
        .select('*, doctor:doctors(name, room_number, department:departments(name))')
        .eq('patient_id', patient.id)
        .gte('appointment_date', today)
        .in('status', ['scheduled', 'checked_in'])
        .order('appointment_date')
        .limit(3);
      
      if (appointmentData) {
        setUpcomingAppointments(appointmentData);
      }

      // Today's appointments count
      const { count } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('patient_id', patient.id)
        .eq('appointment_date', today);
      
      setStats(prev => ({
        ...prev,
        todayAppointments: count || 0,
      }));
    }
  };

  // Subscribe to doctor status updates
  useEffect(() => {
    const channel = supabase
      .channel('doctor-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'doctors',
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleBookAppointment = (doctor: Doctor) => {
    navigate('/book-appointment', { state: { selectedDoctor: doctor } });
  };

  return (
    <Layout>
      <div className="hero-gradient">
        <div className="container py-8 sm:py-12">
          {/* Welcome Section */}
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
              {patient ? `Welcome, ${patient.name.split(' ')[0]}!` : 'Welcome to GovCare'}
            </h1>
            <p className="text-muted-foreground text-lg">
              Book appointments and manage your hospital visits easily
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="gov-card">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalDoctors}</p>
                  <p className="text-sm text-muted-foreground">Doctors</p>
                </div>
              </CardContent>
            </Card>
            <Card className="gov-card">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center">
                  <Activity className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-success">{stats.availableDoctors}</p>
                  <p className="text-sm text-muted-foreground">Available Now</p>
                </div>
              </CardContent>
            </Card>
            <Card className="gov-card">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.todayAppointments}</p>
                  <p className="text-sm text-muted-foreground">Today's Appts</p>
                </div>
              </CardContent>
            </Card>
            <Card className="gov-card">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">24/7</p>
                  <p className="text-sm text-muted-foreground">Emergency</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Button 
              size="lg" 
              className="h-auto py-6 flex-col gap-2"
              onClick={() => navigate('/book-appointment')}
            >
              <Calendar className="h-6 w-6" />
              <span>Book Appointment</span>
            </Button>
            <Button 
              size="lg" 
              variant="secondary"
              className="h-auto py-6 flex-col gap-2"
              onClick={() => navigate('/queue-status')}
            >
              <Tv className="h-6 w-6" />
              <span>Queue Status</span>
            </Button>
            <Button 
              size="lg" 
              variant="secondary"
              className="h-auto py-6 flex-col gap-2"
              onClick={() => navigate('/chatbot')}
            >
              <MessageCircle className="h-6 w-6" />
              <span>Get Help</span>
            </Button>
            <Button 
              size="lg" 
              variant="destructive"
              className="h-auto py-6 flex-col gap-2"
              onClick={() => navigate('/book-appointment', { state: { isEmergency: true } })}
            >
              <AlertTriangle className="h-6 w-6" />
              <span>Emergency</span>
            </Button>
          </div>

          {/* Upcoming Appointments */}
          {upcomingAppointments.length > 0 && (
            <Card className="gov-card mb-8">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Upcoming Appointments</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/my-appointments')}>
                    View All <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {upcomingAppointments.map((apt) => (
                    <div 
                      key={apt.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-primary">
                            {format(new Date(apt.appointment_date), 'd')}
                          </p>
                          <p className="text-xs text-muted-foreground uppercase">
                            {format(new Date(apt.appointment_date), 'MMM')}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium">{(apt.doctor as any)?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(apt.doctor as any)?.department?.name} • {apt.slot_time}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline">{apt.appointment_id}</Badge>
                        {apt.is_emergency && (
                          <Badge variant="destructive" className="ml-2">Emergency</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Departments Section */}
      <section className="container py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Departments</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/book-appointment')}>
            View All <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {departments.slice(0, 8).map((dept) => (
            <DepartmentCard 
              key={dept.id} 
              department={dept}
              doctorCount={doctors.filter(d => d.department_id === dept.id && d.status === 'available').length}
              onClick={() => navigate('/book-appointment', { state: { selectedDepartment: dept } })}
            />
          ))}
        </div>
      </section>

      {/* Available Doctors Section */}
      <section className="container py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Available Doctors</h2>
          <div className="flex items-center gap-2">
            <div className="status-dot status-available" />
            <span className="text-sm text-muted-foreground">Live Status</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {doctors.filter(d => d.status !== 'offline').slice(0, 6).map((doctor) => (
            <DoctorCard 
              key={doctor.id} 
              doctor={doctor}
              onBookAppointment={handleBookAppointment}
            />
          ))}
        </div>
      </section>
    </Layout>
  );
}
