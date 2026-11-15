import type { ServiceHosting } from '../Hooks/Categories/useCategories';

export const SERVICE_HOSTING_OPTIONS: { value: ServiceHosting; labelKey: string }[] = [
  { value: 'SELF_HOSTED', labelKey: 'services:hosting.selfHosted' },
  { value: 'CLOUD', labelKey: 'services:hosting.cloud' },
];

export const SERVICE_HOSTING_LABELS: Record<ServiceHosting, string> = {
  SELF_HOSTED: 'services:hosting.selfHosted',
  CLOUD: 'services:hosting.cloud',
};
