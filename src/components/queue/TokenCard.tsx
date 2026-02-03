import { QueueToken } from '@/types/database';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface TokenCardProps {
  token: QueueToken;
  isCurrentUser?: boolean;
}

export function TokenCard({ token, isCurrentUser = false }: TokenCardProps) {
  const statusConfig = {
    waiting: {
      label: 'Waiting',
      className: 'bg-muted text-muted-foreground',
    },
    serving: {
      label: 'Now Serving',
      className: 'bg-success text-success-foreground animate-pulse',
    },
    completed: {
      label: 'Completed',
      className: 'bg-primary text-primary-foreground',
    },
    skipped: {
      label: 'Skipped',
      className: 'bg-warning text-warning-foreground',
    },
  };

  const status = statusConfig[token.status];

  return (
    <Card className={cn(
      'overflow-hidden transition-all duration-200',
      isCurrentUser && 'ring-2 ring-primary',
      token.status === 'serving' && 'shadow-lg'
    )}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={cn(
              'queue-position',
              token.status === 'serving' && 'bg-success',
              token.status === 'completed' && 'bg-muted text-muted-foreground',
              token.status === 'skipped' && 'bg-warning text-warning-foreground'
            )}>
              {token.token_number}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Token #{token.token_number}</span>
                {token.is_emergency && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Emergency
                  </Badge>
                )}
                {isCurrentUser && (
                  <Badge variant="outline" className="text-xs">
                    <User className="h-3 w-3 mr-1" />
                    You
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <Clock className="h-3 w-3" />
                <span>Position: {token.position}</span>
                {token.check_in_time && (
                  <span>• Check-in: {format(new Date(token.check_in_time), 'h:mm a')}</span>
                )}
              </div>
            </div>
          </div>
          <Badge className={status.className}>
            {status.label}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
