import { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TokenCard } from '@/components/queue/TokenCard';
import { Doctor } from '@/types/database';
import { 
  Tv, 
  RefreshCw, 
  Users, 
  Clock, 
  AlertTriangle,
  Loader2,
  Maximize
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface QueueTokenView {
  id: string;
  token_number: number;
  appointment_id: string;
  doctor_id: string;
  queue_date: string;
  status: 'waiting' | 'serving' | 'completed' | 'skipped';
  position: number;
  is_emergency: boolean;
  check_in_time: string | null;
  doctor?: { name: string; room_number: string | null };
}

export default function QueueStatusPage() {
  const { patient } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('all');
  const [tokens, setTokens] = useState<QueueTokenView[]>([]);
  const [loading, setLoading] = useState(true);
  const [userToken, setUserToken] = useState<QueueTokenView | null>(null);
  const [currentServing, setCurrentServing] = useState<QueueTokenView | null>(null);

  useEffect(() => {
    fetchDoctors();
    fetchTokens();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('queue-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_tokens',
        },
        () => {
          fetchTokens();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDoctorId, patient]);

  const fetchDoctors = async () => {
    const { data } = await supabase
      .from('doctors')
      .select('*')
      .neq('status', 'offline')
      .order('name');
    if (data) setDoctors(data as Doctor[]);
  };

  const fetchTokens = async () => {
    setLoading(true);
    const today = format(new Date(), 'yyyy-MM-dd');

    let query = supabase
      .from('queue_tokens')
      .select('*, doctor:doctors(name, room_number)')
      .eq('queue_date', today)
      .order('is_emergency', { ascending: false })
      .order('position', { ascending: true });

    if (selectedDoctorId !== 'all') {
      query = query.eq('doctor_id', selectedDoctorId);
    }

    const { data } = await query;

    if (data) {
      const transformedTokens = data as QueueTokenView[];
      setTokens(transformedTokens);
      
      // Find current serving
      const serving = transformedTokens.find(t => t.status === 'serving');
      setCurrentServing(serving || null);

      // Find user's token if logged in
      if (patient) {
        const { data: appointmentData } = await supabase
          .from('appointments')
          .select('id')
          .eq('patient_id', patient.id)
          .eq('appointment_date', today);

        if (appointmentData) {
          const appointmentIds = appointmentData.map(a => a.id);
          const userT = transformedTokens.find(t => appointmentIds.includes(t.appointment_id));
          setUserToken(userT || null);
        }
      }
    }

    setLoading(false);
  };

  const openTVDisplay = () => {
    const url = selectedDoctorId !== 'all' 
      ? `/token-display?doctor=${selectedDoctorId}` 
      : '/token-display';
    window.open(url, '_blank', 'fullscreen=yes');
  };

  const waitingTokens = tokens.filter(t => t.status === 'waiting');
  const completedToday = tokens.filter(t => t.status === 'completed').length;

  return (
    <Layout>
      <div className="container py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Queue Status</h1>
            <p className="text-muted-foreground">Real-time queue updates for today</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Doctors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Doctors</SelectItem>
                {doctors.map(doctor => (
                  <SelectItem key={doctor.id} value={doctor.id}>
                    {doctor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchTokens}>
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
            <Button onClick={openTVDisplay}>
              <Tv className="mr-2 h-4 w-4" />
              TV Display
              <Maximize className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="gov-card">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{waitingTokens.length}</p>
                <p className="text-sm text-muted-foreground">Waiting</p>
              </div>
            </CardContent>
          </Card>
          <Card className="gov-card">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-success">{completedToday}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </CardContent>
          </Card>
          <Card className="gov-card">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-warning/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {tokens.filter(t => t.is_emergency && t.status === 'waiting').length}
                </p>
                <p className="text-sm text-muted-foreground">Emergency</p>
              </div>
            </CardContent>
          </Card>
          <Card className="gov-card">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Tv className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{doctors.length}</p>
                <p className="text-sm text-muted-foreground">Active Doctors</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* User's Token (if exists) */}
        {userToken && (
          <Card className="gov-card-elevated mb-8 border-primary">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Badge variant="outline">Your Token</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className={cn(
                    'queue-position w-16 h-16 text-2xl',
                    userToken.status === 'serving' && 'bg-success animate-pulse',
                    userToken.is_emergency && 'bg-destructive'
                  )}>
                    {userToken.token_number}
                  </div>
                  <div>
                    <p className="text-xl font-bold">Token #{userToken.token_number}</p>
                    <p className="text-muted-foreground">
                      {userToken.status === 'serving' 
                        ? 'You are being called!' 
                        : `Position in queue: ${userToken.position}`}
                    </p>
                    {userToken.doctor && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {userToken.doctor.name} • {userToken.doctor.room_number}
                      </p>
                    )}
                  </div>
                </div>
                <Badge 
                  className={cn(
                    'text-lg py-2 px-4',
                    userToken.status === 'serving' && 'bg-success text-success-foreground',
                    userToken.status === 'waiting' && 'bg-primary text-primary-foreground'
                  )}
                >
                  {userToken.status === 'serving' ? 'NOW SERVING' : 'WAITING'}
                </Badge>
              </div>
              {userToken.status === 'waiting' && currentServing && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Currently serving: Token #{currentServing.token_number}
                    {userToken.position > 1 && (
                      <span> • Approximately {(userToken.position - 1) * 15} minutes wait</span>
                    )}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Current Serving */}
        {currentServing && (
          <Card className="gov-card-elevated mb-8 bg-success/5 border-success">
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-sm font-medium text-success uppercase tracking-wider mb-2">
                  Now Serving
                </p>
                <div className="text-6xl font-bold text-success mb-2">
                  {String(currentServing.token_number).padStart(3, '0')}
                </div>
                {currentServing.doctor && (
                  <p className="text-muted-foreground">
                    {currentServing.doctor.name} • {currentServing.doctor.room_number}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Queue List */}
        <Card className="gov-card">
          <CardHeader>
            <CardTitle>Waiting Queue</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : waitingTokens.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No patients currently waiting
              </p>
            ) : (
              <div className="space-y-3">
                {waitingTokens.map(token => (
                  <TokenCard 
                    key={token.id} 
                    token={token as any}
                    isCurrentUser={userToken?.id === token.id}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
