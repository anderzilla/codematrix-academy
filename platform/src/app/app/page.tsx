import { RestrictedSurfaceGate } from '@/components/RestrictedSurfaceGate';
import { ACADEMY_SURFACES } from '@/lib/contracts';

export default function StudentAppGatePage() {
  const surface = ACADEMY_SURFACES.find((s) => s.id === 'app')!;
  return <RestrictedSurfaceGate surface={surface} />;
}
