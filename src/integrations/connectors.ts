import { client, unwrap } from '../portal/api';
import type { components } from '../portal/schema';
export type Connector = components['schemas']['ConnectorView'];
export type ConnectorInput = components['schemas']['ConnectInput'];
export type ConnectorReview = components['schemas']['ReviewItem'];
const path = (slug: string, provider: string) => ({ slug, provider });
const header = (key: string) => ({ 'Idempotency-Key': key });
export const connectors = {
  list: async (slug: string) => unwrap(await client.GET('/api/v1/companies/{slug}/integrations/connectors', { params: { path: { slug } } })),
  connect: async (slug: string, provider: string, body: ConnectorInput, key: string) => unwrap(await client.POST('/api/v1/companies/{slug}/integrations/connectors/{provider}/connect', { body, params: { path: path(slug, provider), header: header(key) } })),
  sync: async (slug: string, row: Connector, key: string) => unwrap(await client.POST('/api/v1/companies/{slug}/integrations/connectors/{provider}/sync', { body: { version: row.version! }, params: { path: path(slug, row.id), header: header(key) } })),
  disconnect: async (slug: string, row: Connector, key: string) => unwrap(await client.POST('/api/v1/companies/{slug}/integrations/connectors/{provider}/disconnect', { body: { version: row.version! }, params: { path: path(slug, row.id), header: header(key) } })),
  review: async (slug: string, provider: string) => unwrap(await client.GET('/api/v1/companies/{slug}/integrations/connectors/{provider}/review', { params: { path: path(slug, provider) } })),
};
