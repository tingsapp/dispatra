import { client, unwrap } from '../portal/api';
import type { components } from '../portal/schema';
export type Provider = components['schemas']['ProviderView'];
export const integrationKeys = ['platform', 'integrations'] as const;
export const integrationAdmin = {
  providers: async () => unwrap(await client.GET('/api/v1/platform/integrations/providers')),
};
