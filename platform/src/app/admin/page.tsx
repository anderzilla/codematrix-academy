import { RestrictedSurfaceGate } from '@/components/RestrictedSurfaceGate';
import { ACADEMY_SURFACES } from '@/lib/contracts';

export default function AdminGatePage() {
  const surface = ACADEMY_SURFACES.find((s) => s.id === 'admin')!;
  return <RestrictedSurfaceGate surface={surface} />;
}
