import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { RefreshCw } from 'lucide-react';

interface TokenWithDoctor {
  id: string;
  token_number: number;
  status: string;
  position: number;
  is_emergency: boolean;
  doctor?: { name: string; room_number: string | null };
}

interface TokenDisplayProps {
  doctorId?: string;
}

export function TokenDisplay({ doctorId }: TokenDisplayProps) {
  const [currentToken, setCurrentToken] = useState<TokenWithDoctor | null>(null);
  const [nextTokens, setNextTokens] = useState<TokenWithDoctor[]>([]);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const fetchTokens = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    
    let query = supabase
      .from('queue_tokens')
      .select('*, doctor:doctors(name, room_number)')
      .eq('queue_date', today)
      .order('is_emergency', { ascending: false })
      .order('position', { ascending: true });

    if (doctorId) {
      query = query.eq('doctor_id', doctorId);
    }

    const { data } = await query;
    
    if (data) {
      const serving = data.find(t => t.status === 'serving');
      const waiting = data.filter(t => t.status === 'waiting').slice(0, 5);
      setCurrentToken(serving || null);
      setNextTokens(waiting);
    }
    
    setLastUpdate(new Date());
  };

  useEffect(() => {
    fetchTokens();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('token-display')
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

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchTokens, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [doctorId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">GovCare Hospital</h1>
          <p className="text-primary-foreground/80">Queue Status Display</p>
          <div className="flex items-center justify-center gap-2 mt-4 text-sm text-primary-foreground/60">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Last updated: {format(lastUpdate, 'h:mm:ss a')}</span>
          </div>
        </div>

        {/* Current Token */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 mb-8">
          <p className="text-center text-primary-foreground/80 mb-4 uppercase tracking-wider text-sm font-medium">
            Now Serving
          </p>
          <div className="text-center">
            {currentToken ? (
              <>
                <div className={cn(
                  'token-display animate-token-change',
                  currentToken.is_emergency && 'text-red-300'
                )}>
                  {String(currentToken.token_number).padStart(3, '0')}
                </div>
                {currentToken.is_emergency && (
                  <p className="text-red-300 font-medium mt-2">⚠️ EMERGENCY</p>
                )}
                <p className="text-primary-foreground/80 mt-4">
                  {(currentToken as any).doctor?.room_number || 'Room TBA'}
                </p>
              </>
            ) : (
              <div className="token-display text-primary-foreground/40">
                ---
              </div>
            )}
          </div>
        </div>

        {/* Next in Queue */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8">
          <p className="text-center text-primary-foreground/80 mb-6 uppercase tracking-wider text-sm font-medium">
            Next in Queue
          </p>
          {nextTokens.length > 0 ? (
            <div className="grid grid-cols-5 gap-4">
              {nextTokens.map((token, index) => (
                <div 
                  key={token.id}
                  className={cn(
                    'bg-white/10 rounded-xl p-6 text-center transition-all',
                    index === 0 && 'bg-white/20 scale-105'
                  )}
                >
                  <div className={cn(
                    'text-4xl font-bold',
                    token.is_emergency && 'text-red-300'
                  )}>
                    {String(token.token_number).padStart(3, '0')}
                  </div>
                  <p className="text-sm text-primary-foreground/60 mt-2">
                    Position {token.position}
                  </p>
                  {token.is_emergency && (
                    <p className="text-xs text-red-300 mt-1">Emergency</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-primary-foreground/60">No patients waiting</p>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-primary-foreground/60 text-sm">
          <p>Please wait for your token number to be called</p>
          <p className="mt-1">Emergency patients will be prioritized</p>
        </div>
      </div>
    </div>
  );
}
