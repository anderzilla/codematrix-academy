import { RestrictedSurfaceGate } from '@/components/RestrictedSurfaceGate';
import { ACADEMY_SURFACES } from '@/lib/contracts';

export default function PartnersGatePage() {
  const surface = ACADEMY_SURFACES.find((s) => s.id === 'partners')!;
  return <RestrictedSurfaceGate surface={surface} />;
}
