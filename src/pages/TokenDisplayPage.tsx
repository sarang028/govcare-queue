import { useSearchParams } from 'react-router-dom';
import { TokenDisplay } from '@/components/queue/TokenDisplay';

export default function TokenDisplayPage() {
  const [searchParams] = useSearchParams();
  const doctorId = searchParams.get('doctor') || undefined;

  return <TokenDisplay doctorId={doctorId} />;
}
