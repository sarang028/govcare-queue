import { Doctor } from '@/types/database';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, MapPin, GraduationCap, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DoctorCardProps {
  doctor: Doctor;
  onBookAppointment?: (doctor: Doctor) => void;
}

export function DoctorCard({ doctor, onBookAppointment }: DoctorCardProps) {
  const statusConfig = {
    available: {
      label: 'Available',
      className: 'status-available',
      badgeVariant: 'default' as const,
      badgeClassName: 'bg-success text-success-foreground'
    },
    busy: {
      label: 'Busy',
      className: 'status-busy',
      badgeVariant: 'secondary' as const,
      badgeClassName: 'bg-warning text-warning-foreground'
    },
    offline: {
      label: 'Offline',
      className: 'status-offline',
      badgeVariant: 'outline' as const,
      badgeClassName: ''
    }
  };

  const status = statusConfig[doctor.status];

  return (
    <Card className="gov-card overflow-hidden hover:shadow-lg transition-all duration-200">
      <CardContent className="p-0">
        <div className="p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xl font-bold text-primary">
                  {doctor.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-lg">{doctor.name}</h3>
                <p className="text-sm text-muted-foreground">{doctor.specialization}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn('status-dot', status.className)} />
              <Badge variant={status.badgeVariant} className={status.badgeClassName}>
                {status.label}
              </Badge>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <GraduationCap className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{doctor.qualification}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4 flex-shrink-0" />
              <span>{doctor.experience_years} years exp.</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span>{doctor.room_number || 'TBA'}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4 flex-shrink-0" />
              <span>~{doctor.avg_consultation_time} min/patient</span>
            </div>
          </div>

          {onBookAppointment && (
            <Button 
              className="w-full mt-4" 
              onClick={() => onBookAppointment(doctor)}
              disabled={doctor.status === 'offline'}
            >
              <Calendar className="mr-2 h-4 w-4" />
              Book Appointment
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
