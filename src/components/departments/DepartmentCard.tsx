import { Department } from '@/types/database';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Stethoscope, 
  Baby, 
  Bone, 
  HeartPulse, 
  ScanFace, 
  Ear, 
  Eye, 
  Heart, 
  Brain, 
  Smile,
  LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DepartmentCardProps {
  department: Department;
  doctorCount?: number;
  isSelected?: boolean;
  onClick?: () => void;
}

const iconMap: Record<string, LucideIcon> = {
  stethoscope: Stethoscope,
  baby: Baby,
  bone: Bone,
  'heart-pulse': HeartPulse,
  'scan-face': ScanFace,
  ear: Ear,
  eye: Eye,
  heart: Heart,
  brain: Brain,
  smile: Smile,
};

export function DepartmentCard({ 
  department, 
  doctorCount = 0, 
  isSelected = false,
  onClick 
}: DepartmentCardProps) {
  const IconComponent = iconMap[department.icon || 'stethoscope'] || Stethoscope;

  return (
    <Card 
      className={cn(
        'dept-card',
        isSelected && 'ring-2 ring-primary border-primary'
      )}
      onClick={onClick}
    >
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start gap-4">
          <div className={cn(
            "h-12 w-12 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
            isSelected ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
          )}>
            <IconComponent className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base sm:text-lg truncate">{department.name}</h3>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{department.description}</p>
            {doctorCount > 0 && (
              <p className="text-xs text-primary mt-2 font-medium">
                {doctorCount} Doctor{doctorCount > 1 ? 's' : ''} Available
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
