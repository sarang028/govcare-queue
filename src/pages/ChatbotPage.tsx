import { Layout } from '@/components/layout/Layout';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { Card, CardContent } from '@/components/ui/card';
import { MessageCircle, Bot, Clock, Calendar, HelpCircle } from 'lucide-react';

export default function ChatbotPage() {
  return (
    <Layout>
      <div className="container py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-4">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">GovCare Assistant</h1>
            <p className="text-muted-foreground mt-2">
              Get help with appointments, queue status, and hospital services
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <Card className="gov-card">
              <CardContent className="p-4 flex items-center gap-3">
                <Calendar className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-sm">Book Appointments</p>
                  <p className="text-xs text-muted-foreground">Schedule your visit</p>
                </div>
              </CardContent>
            </Card>
            <Card className="gov-card">
              <CardContent className="p-4 flex items-center gap-3">
                <Clock className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-sm">Check Queue</p>
                  <p className="text-xs text-muted-foreground">See your position</p>
                </div>
              </CardContent>
            </Card>
            <Card className="gov-card">
              <CardContent className="p-4 flex items-center gap-3">
                <HelpCircle className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-sm">Hospital Info</p>
                  <p className="text-xs text-muted-foreground">Timings & services</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <ChatInterface />
        </div>
      </div>
    </Layout>
  );
}
