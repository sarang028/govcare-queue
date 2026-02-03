import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Department, Doctor } from '@/types/database';
import { DepartmentCard } from '@/components/departments/DepartmentCard';
import { DoctorCard } from '@/components/doctors/DoctorCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Clock, 
  AlertTriangle,
  Loader2,
  CalendarDays,
  Stethoscope
} from 'lucide-react';
import { format, addDays, isBefore, startOfDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type BookingStep = 'department' | 'doctor' | 'datetime' | 'confirm';

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'
];

export default function BookAppointmentPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { patient } = useAuth();
  const { toast } = useToast();
  
  const [step, setStep] = useState<BookingStep>('department');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Booking state
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(
    location.state?.selectedDepartment || null
  );
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(
    location.state?.selectedDoctor || null
  );
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [symptoms, setSymptoms] = useState('');
  const [isEmergency, setIsEmergency] = useState(location.state?.isEmergency || false);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [predictedWaitTime, setPredictedWaitTime] = useState<number | null>(null);

  useEffect(() => {
    if (!patient) {
      navigate('/login');
      return;
    }
    fetchDepartments();
    
    // Auto-advance if coming with pre-selected data
    if (location.state?.selectedDoctor) {
      setStep('datetime');
    } else if (location.state?.selectedDepartment) {
      fetchDoctors(location.state.selectedDepartment.id);
      setStep('doctor');
    }
  }, [patient, navigate, location.state]);

  const fetchDepartments = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('departments')
      .select('*')
      .order('name');
    if (data) setDepartments(data);
    setLoading(false);
  };

  const fetchDoctors = async (departmentId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('doctors')
      .select('*, department:departments(*)')
      .eq('department_id', departmentId)
      .order('name');
    if (data) setDoctors(data);
    setLoading(false);
  };

  const fetchBookedSlots = async (doctorId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const { data } = await supabase
      .from('appointments')
      .select('slot_time')
      .eq('doctor_id', doctorId)
      .eq('appointment_date', dateStr)
      .not('status', 'in', '("cancelled","no_show")');
    
    if (data) {
      setBookedSlots(data.map(a => a.slot_time.slice(0, 5)));
    }
  };

  const fetchPredictedWaitTime = async () => {
    if (!selectedDoctor || !selectedDate) return;
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/predict-wait-time`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            doctor_id: selectedDoctor.id,
            appointment_date: format(selectedDate, 'yyyy-MM-dd'),
            slot_time: selectedTime,
            is_emergency: isEmergency,
          }),
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setPredictedWaitTime(data.predicted_wait_time);
      }
    } catch (error) {
      console.error('Failed to get wait time prediction:', error);
    }
  };

  useEffect(() => {
    if (selectedDoctor && selectedDate) {
      fetchBookedSlots(selectedDoctor.id, selectedDate);
    }
  }, [selectedDoctor, selectedDate]);

  useEffect(() => {
    if (selectedDoctor && selectedDate && selectedTime) {
      fetchPredictedWaitTime();
    }
  }, [selectedDoctor, selectedDate, selectedTime, isEmergency]);

  const handleDepartmentSelect = (dept: Department) => {
    setSelectedDepartment(dept);
    setSelectedDoctor(null);
    fetchDoctors(dept.id);
    setStep('doctor');
  };

  const handleDoctorSelect = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setStep('datetime');
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedTime(null);
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setStep('confirm');
  };

  const handleBack = () => {
    const steps: BookingStep[] = ['department', 'doctor', 'datetime', 'confirm'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };

  const handleSubmit = async () => {
    if (!patient || !selectedDoctor || !selectedDepartment || !selectedDate || !selectedTime) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please complete all booking steps.',
      });
      return;
    }

    setSubmitting(true);

    try {
      // Create appointment - appointment_id is auto-generated by trigger
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .insert({
          appointment_id: 'APT-' + Date.now(), // Temp ID, will be replaced by trigger
          patient_id: patient.id,
          doctor_id: selectedDoctor.id,
          department_id: selectedDepartment.id,
          appointment_date: format(selectedDate, 'yyyy-MM-dd'),
          slot_time: selectedTime + ':00',
          symptoms,
          is_emergency: isEmergency,
          predicted_wait_time: predictedWaitTime,
        } as any)
        .select()
        .single();

      if (appointmentError) throw appointmentError;

      // Get next token number
      const { data: existingTokens } = await supabase
        .from('queue_tokens')
        .select('token_number')
        .eq('doctor_id', selectedDoctor.id)
        .eq('queue_date', format(selectedDate, 'yyyy-MM-dd'))
        .order('token_number', { ascending: false })
        .limit(1);

      const nextTokenNumber = existingTokens && existingTokens.length > 0 
        ? existingTokens[0].token_number + 1 
        : 1;

      // Get current position (emergency patients go to front)
      const { count: waitingCount } = await supabase
        .from('queue_tokens')
        .select('*', { count: 'exact', head: true })
        .eq('doctor_id', selectedDoctor.id)
        .eq('queue_date', format(selectedDate, 'yyyy-MM-dd'))
        .eq('status', 'waiting');

      const position = isEmergency ? 1 : (waitingCount || 0) + 1;

      // Create queue token
      const { error: tokenError } = await supabase
        .from('queue_tokens')
        .insert({
          token_number: nextTokenNumber,
          appointment_id: appointment.id,
          doctor_id: selectedDoctor.id,
          queue_date: format(selectedDate, 'yyyy-MM-dd'),
          position,
          is_emergency: isEmergency,
          check_in_time: new Date().toISOString(),
        });

      if (tokenError) throw tokenError;

      // Create notification
      await supabase
        .from('notifications')
        .insert({
          patient_id: patient.id,
          appointment_id: appointment.id,
          title: 'Appointment Confirmed',
          message: `Your appointment with ${selectedDoctor.name} is confirmed for ${format(selectedDate, 'MMMM d, yyyy')} at ${selectedTime}. Token #${nextTokenNumber}`,
          type: 'success',
        });

      toast({
        title: 'Appointment Booked!',
        description: `Your appointment ID is ${appointment.appointment_id}. Token #${nextTokenNumber}`,
      });

      navigate('/my-appointments');
    } catch (error) {
      console.error('Booking error:', error);
      toast({
        variant: 'destructive',
        title: 'Booking Failed',
        description: 'Unable to book appointment. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const minDate = startOfDay(new Date());
  const maxDate = addDays(minDate, 30);

  return (
    <Layout>
      <div className="container py-8">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            {['department', 'doctor', 'datetime', 'confirm'].map((s, i) => (
              <div key={s} className="flex items-center">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                  step === s ? 'bg-primary text-primary-foreground' :
                  ['department', 'doctor', 'datetime', 'confirm'].indexOf(step) > i 
                    ? 'bg-success text-success-foreground' 
                    : 'bg-muted text-muted-foreground'
                )}>
                  {['department', 'doctor', 'datetime', 'confirm'].indexOf(step) > i ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    i + 1
                  )}
                </div>
                {i < 3 && (
                  <div className={cn(
                    'w-12 h-1 mx-2',
                    ['department', 'doctor', 'datetime', 'confirm'].indexOf(step) > i 
                      ? 'bg-success' 
                      : 'bg-muted'
                  )} />
                )}
              </div>
            ))}
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold">
              {step === 'department' && 'Select Department'}
              {step === 'doctor' && 'Choose Doctor'}
              {step === 'datetime' && 'Pick Date & Time'}
              {step === 'confirm' && 'Confirm Booking'}
            </h1>
          </div>
        </div>

        {/* Back Button */}
        {step !== 'department' && (
          <Button 
            variant="ghost" 
            onClick={handleBack} 
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        )}

        {/* Emergency Toggle */}
        {step !== 'confirm' && (
          <Card className="mb-6 border-destructive/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="font-medium">Emergency Priority</p>
                    <p className="text-sm text-muted-foreground">
                      Enable for urgent medical attention
                    </p>
                  </div>
                </div>
                <Switch 
                  checked={isEmergency} 
                  onCheckedChange={setIsEmergency}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Department Selection */}
            {step === 'department' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {departments.map((dept) => (
                  <DepartmentCard
                    key={dept.id}
                    department={dept}
                    isSelected={selectedDepartment?.id === dept.id}
                    onClick={() => handleDepartmentSelect(dept)}
                  />
                ))}
              </div>
            )}

            {/* Doctor Selection */}
            {step === 'doctor' && (
              <div className="space-y-4">
                {selectedDepartment && (
                  <div className="flex items-center gap-2 text-muted-foreground mb-4">
                    <Stethoscope className="h-4 w-4" />
                    <span>Doctors in {selectedDepartment.name}</span>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {doctors.map((doctor) => (
                    <DoctorCard
                      key={doctor.id}
                      doctor={doctor}
                      onBookAppointment={handleDoctorSelect}
                    />
                  ))}
                </div>
                {doctors.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No doctors available in this department.
                  </p>
                )}
              </div>
            )}

            {/* Date & Time Selection */}
            {step === 'datetime' && (
              <div className="grid md:grid-cols-2 gap-8">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CalendarDays className="h-5 w-5" />
                      Select Date
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={handleDateSelect}
                      disabled={(date) => 
                        isBefore(date, minDate) || 
                        date > maxDate ||
                        date.getDay() === 0 // Disable Sundays
                      }
                      className="rounded-md border"
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Select Time Slot
                    </CardTitle>
                    <CardDescription>
                      {selectedDate 
                        ? format(selectedDate, 'EEEE, MMMM d, yyyy')
                        : 'Please select a date first'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {selectedDate ? (
                      <div className="grid grid-cols-3 gap-2">
                        {TIME_SLOTS.map((time) => {
                          const isBooked = bookedSlots.includes(time);
                          return (
                            <Button
                              key={time}
                              variant={selectedTime === time ? 'default' : 'outline'}
                              disabled={isBooked}
                              onClick={() => handleTimeSelect(time)}
                              className={cn(
                                'h-12',
                                isBooked && 'opacity-50 cursor-not-allowed'
                              )}
                            >
                              {time}
                              {isBooked && (
                                <span className="ml-1 text-xs">(Full)</span>
                              )}
                            </Button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        Select a date to view available time slots
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Confirmation */}
            {step === 'confirm' && (
              <div className="max-w-2xl mx-auto">
                <Card className="gov-card-elevated">
                  <CardHeader>
                    <CardTitle>Confirm Your Appointment</CardTitle>
                    <CardDescription>
                      Please review your booking details
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Booking Summary */}
                    <div className="rounded-lg bg-muted p-4 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Department</span>
                        <span className="font-medium">{selectedDepartment?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Doctor</span>
                        <span className="font-medium">{selectedDoctor?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Date</span>
                        <span className="font-medium">
                          {selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Time</span>
                        <span className="font-medium">{selectedTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Room</span>
                        <span className="font-medium">{selectedDoctor?.room_number || 'TBA'}</span>
                      </div>
                      {isEmergency && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Priority</span>
                          <Badge variant="destructive">Emergency</Badge>
                        </div>
                      )}
                      {predictedWaitTime !== null && (
                        <div className="flex justify-between items-center pt-2 border-t">
                          <span className="text-muted-foreground">Estimated Wait Time</span>
                          <Badge variant="secondary" className="text-lg">
                            ~{predictedWaitTime} min
                          </Badge>
                        </div>
                      )}
                    </div>

                    {/* Symptoms */}
                    <div className="space-y-2">
                      <Label htmlFor="symptoms">Symptoms / Reason for Visit (Optional)</Label>
                      <Textarea
                        id="symptoms"
                        placeholder="Describe your symptoms or reason for the appointment..."
                        value={symptoms}
                        onChange={(e) => setSymptoms(e.target.value)}
                        rows={3}
                      />
                    </div>

                    {/* Patient Info */}
                    <div className="rounded-lg bg-primary/5 p-4">
                      <p className="text-sm font-medium mb-2">Patient Information</p>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p><strong>Name:</strong> {patient?.name}</p>
                        <p><strong>Mobile:</strong> {patient?.mobile}</p>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <Button 
                      onClick={handleSubmit} 
                      className="w-full h-12 text-lg"
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Booking...
                        </>
                      ) : (
                        <>
                          Confirm Appointment
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
