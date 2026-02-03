import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface AppointmentView {
  id: string;
  appointment_id: string;
  appointment_date: string;
  slot_time: string;
  status: string;
  symptoms: string | null;
  is_emergency: boolean;
  predicted_wait_time: number | null;
  created_at: string;
  doctor: { name: string; room_number: string | null; specialization: string | null } | null;
  department: { name: string } | null;
  queue_token?: { token_number: number; position: number; status: string } | null;
}

export default function MyAppointmentsPage() {
  const { patient } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<AppointmentView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patient) {
      navigate('/login');
      return;
    }
    fetchAppointments();
  }, [patient, navigate]);

  const fetchAppointments = async () => {
    if (!patient) return;
    
    setLoading(true);
    const { data } = await supabase
      .from('appointments')
      .select(`
        *,
        doctor:doctors(name, room_number, specialization),
        department:departments(name),
        queue_token:queue_tokens(token_number, position, status)
      `)
      .eq('patient_id', patient.id)
      .order('appointment_date', { ascending: false })
      .order('slot_time', { ascending: false });

    if (data) {
      const transformedData = data.map(apt => ({
        ...apt,
        doctor: apt.doctor as any,
        department: apt.department as any,
        queue_token: Array.isArray(apt.queue_token) ? apt.queue_token[0] : apt.queue_token
      }));
      setAppointments(transformedData);
    }
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
      scheduled: { label: 'Scheduled', variant: 'secondary' },
      checked_in: { label: 'Checked In', variant: 'default', className: 'bg-success text-success-foreground' },
      in_progress: { label: 'In Progress', variant: 'default', className: 'bg-warning text-warning-foreground' },
      completed: { label: 'Completed', variant: 'outline' },
      cancelled: { label: 'Cancelled', variant: 'destructive' },
      no_show: { label: 'No Show', variant: 'outline' },
    };
    const c = config[status] || config.scheduled;
    return <Badge variant={c.variant} className={c.className}>{c.label}</Badge>;
  };

  const getDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEE, MMM d');
  };

  const upcomingAppointments = appointments.filter(
    apt => !isPast(parseISO(apt.appointment_date + 'T' + apt.slot_time)) && 
           !['completed', 'cancelled', 'no_show'].includes(apt.status)
  );

  const pastAppointments = appointments.filter(
    apt => isPast(parseISO(apt.appointment_date + 'T' + apt.slot_time)) || 
           ['completed', 'cancelled', 'no_show'].includes(apt.status)
  );

  const AppointmentCard = ({ apt }: { apt: AppointmentView }) => (
    <Card className={cn(
      'gov-card overflow-hidden',
      apt.is_emergency && 'border-destructive/50'
    )}>
      <CardContent className="p-0">
        <div className="flex">
          {/* Date Column */}
          <div className={cn(
            'w-24 flex-shrink-0 flex flex-col items-center justify-center p-4 text-center',
            apt.is_emergency ? 'bg-destructive/10' : 'bg-primary/5'
          )}>
            <span className="text-3xl font-bold text-primary">
              {format(parseISO(apt.appointment_date), 'd')}
            </span>
            <span className="text-sm text-muted-foreground">
              {format(parseISO(apt.appointment_date), 'MMM')}
            </span>
            <span className="text-xs text-muted-foreground mt-1">
              {getDateLabel(apt.appointment_date)}
            </span>
          </div>

          {/* Details Column */}
          <div className="flex-1 p-4">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{apt.doctor?.name}</h3>
                  {apt.is_emergency && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Emergency
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {apt.department?.name} • {apt.doctor?.specialization}
                </p>
              </div>
              {getStatusBadge(apt.status)}
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{apt.slot_time.slice(0, 5)}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{apt.doctor?.room_number || 'TBA'}</span>
              </div>
            </div>

            {/* Token Info */}
            {apt.queue_token && (
              <div className="mt-3 pt-3 border-t flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="queue-position w-10 h-10 text-base">
                    {apt.queue_token.token_number}
                  </div>
                  <div className="text-sm">
                    <p className="font-medium">Token #{apt.queue_token.token_number}</p>
                    <p className="text-muted-foreground">
                      Position: {apt.queue_token.position}
                    </p>
                  </div>
                </div>
                {apt.predicted_wait_time && (
                  <Badge variant="outline">
                    ~{apt.predicted_wait_time} min wait
                  </Badge>
                )}
              </div>
            )}

            {/* Appointment ID */}
            <div className="mt-3 text-xs text-muted-foreground">
              ID: {apt.appointment_id}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Layout>
      <div className="container py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">My Appointments</h1>
            <p className="text-muted-foreground">View and manage your hospital appointments</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={fetchAppointments}>
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
            <Button onClick={() => navigate('/book-appointment')}>
              <Calendar className="mr-2 h-4 w-4" />
              New Appointment
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : appointments.length === 0 ? (
          <Card className="gov-card text-center py-12">
            <CardContent>
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Appointments Yet</h3>
              <p className="text-muted-foreground mb-4">
                You haven't booked any appointments. Book your first appointment now!
              </p>
              <Button onClick={() => navigate('/book-appointment')}>
                Book Appointment
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="upcoming" className="space-y-6">
            <TabsList>
              <TabsTrigger value="upcoming" className="gap-2">
                <Clock className="h-4 w-4" />
                Upcoming ({upcomingAppointments.length})
              </TabsTrigger>
              <TabsTrigger value="past" className="gap-2">
                <CheckCircle className="h-4 w-4" />
                Past ({pastAppointments.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming" className="space-y-4">
              {upcomingAppointments.length === 0 ? (
                <Card className="gov-card text-center py-8">
                  <CardContent>
                    <p className="text-muted-foreground">No upcoming appointments</p>
                  </CardContent>
                </Card>
              ) : (
                upcomingAppointments.map(apt => (
                  <AppointmentCard key={apt.id} apt={apt} />
                ))
              )}
            </TabsContent>

            <TabsContent value="past" className="space-y-4">
              {pastAppointments.length === 0 ? (
                <Card className="gov-card text-center py-8">
                  <CardContent>
                    <p className="text-muted-foreground">No past appointments</p>
                  </CardContent>
                </Card>
              ) : (
                pastAppointments.map(apt => (
                  <AppointmentCard key={apt.id} apt={apt} />
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </Layout>
  );
}
