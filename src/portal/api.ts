import createClient from 'openapi-fetch';
import type { paths, components } from './schema';
export type Account = components['schemas']['AccountView'];
export type Customer = components['schemas']['CustomerAccessView'];
export type Profile = components['schemas']['CustomerView'];
export type Organization = components['schemas']['OrganizationView'];
export type ProfileInput = components['schemas']['ProfileUpdate'];
export type CustomerInput = components['schemas']['CustomerCreate'];
export type OrganizationInput = components['schemas']['OrganizationCreate'];
export type LoginInput = components['schemas']['Login'];
export type CompanySummary = components['schemas']['CompanySummary'];
export type CompanyDetail = components['schemas']['CompanyDetail'];
export type DispatcherAccount = components['schemas']['DispatcherView'];
export type DispatcherCredential = components['schemas']['DispatcherCredentialView'];
export type DispatcherInput = components['schemas']['DispatcherCreate'];
export type AuditEntry = components['schemas']['AuditEntry'];
export type CompanyFilter = { search?: string; status?: 'ACTIVE' | 'SUSPENDED' };
export type PasswordInput = components['schemas']['PasswordChange'];
export const client = createClient<paths>({ credentials: 'same-origin', headers: { 'X-Requested-With': 'Dispatra' } });
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (!result.response.ok) {
    const error = result.error as { error?: { message?: string; field_errors?: { field: string; message: string }[] } };
    const fields = error?.error?.field_errors?.map(f => `${f.field.replace('body.', '')}: ${f.message}`).join(' ');
    throw new ApiError(result.response.status, fields || error?.error?.message || 'Unable to complete the request. Try again.');
  }
  return result.data as T;
}
export const api = {
  companySettings: async (slug: string) => unwrap(await client.GET('/api/v1/companies/{slug}/settings', { params: { path: { slug } } })),
  saveCompanySettings: async (slug: string, body: components['schemas']['SettingsUpdate'], key: string) => unwrap(await client.PUT('/api/v1/companies/{slug}/settings', { body, params: { path: { slug }, header: { 'Idempotency-Key': key } } })),
  me: async () => unwrap(await client.GET('/api/v1/auth/me')),
  login: async (body: LoginInput) => unwrap(await client.POST('/api/v1/auth/login', { body })),
  logout: async () => unwrap(await client.POST('/api/v1/auth/logout')),
  password: async (body: PasswordInput) => unwrap(await client.POST('/api/v1/auth/password', { body })),
  organizations: async (filter: CompanyFilter = {}, after?: string) => unwrap(await client.GET('/api/v1/platform/organizations', { params: { query: { limit: 50, after, search: filter.search || undefined, status: filter.status } } })),
  createOrganization: async (body: OrganizationInput, key: string) => unwrap(await client.POST('/api/v1/platform/organizations', { body, params: { header: { 'Idempotency-Key': key } } })),
  company: async (id: string) => unwrap(await client.GET('/api/v1/platform/organizations/{organization_id}', { params: { path: { organization_id: id } } })),
  updateCompany: async (id: string, body: components['schemas']['CompanyUpdate'], key: string) => unwrap(await client.PATCH('/api/v1/platform/organizations/{organization_id}', { body, params: { path: { organization_id: id }, header: { 'Idempotency-Key': key } } })),
  setCompanyActive: async (id: string, active: boolean, version: number, key: string) => unwrap(await (active ? client.POST('/api/v1/platform/organizations/{organization_id}/activate', { body: { version }, params: { path: { organization_id: id }, header: { 'Idempotency-Key': key } } }) : client.POST('/api/v1/platform/organizations/{organization_id}/suspend', { body: { version }, params: { path: { organization_id: id }, header: { 'Idempotency-Key': key } } }))),
  companyAudit: async (id: string) => unwrap(await client.GET('/api/v1/platform/organizations/{organization_id}/audit', { params: { path: { organization_id: id }, query: { limit: 50 } } })),
  dispatchers: async (id: string) => unwrap(await client.GET('/api/v1/platform/organizations/{organization_id}/dispatchers', { params: { path: { organization_id: id } } })),
  createDispatcher: async (id: string, body: DispatcherInput, key: string) => unwrap(await client.POST('/api/v1/platform/organizations/{organization_id}/dispatchers', { body, params: { path: { organization_id: id }, header: { 'Idempotency-Key': key } } })),
  updateDispatcher: async (id: string, userId: string, body: components['schemas']['DispatcherUpdate'], key: string) => unwrap(await client.PATCH('/api/v1/platform/organizations/{organization_id}/dispatchers/{user_id}', { body, params: { path: { organization_id: id, user_id: userId }, header: { 'Idempotency-Key': key } } })),
  dispatcherCommand: async (id: string, userId: string, action: 'activate' | 'deactivate' | 'reset-password', version: number, key: string) => {
    const params = { path: { organization_id: id, user_id: userId }, header: { 'Idempotency-Key': key } };
    const body = { version };
    if (action === 'reset-password') return unwrap(await client.POST('/api/v1/platform/organizations/{organization_id}/dispatchers/{user_id}/reset-password', { body, params }));
    return unwrap(await (action === 'activate' ? client.POST('/api/v1/platform/organizations/{organization_id}/dispatchers/{user_id}/activate', { body, params }) : client.POST('/api/v1/platform/organizations/{organization_id}/dispatchers/{user_id}/deactivate', { body, params })));
  },
  revokeDispatcherSessions: async (id: string, userId: string, key: string) => unwrap(await client.POST('/api/v1/platform/organizations/{organization_id}/dispatchers/{user_id}/revoke-sessions', { params: { path: { organization_id: id, user_id: userId }, header: { 'Idempotency-Key': key } } })),
  customers: async (slug: string, after?: string) => unwrap(await client.GET('/api/v1/companies/{slug}/customers', { params: { path: { slug }, query: { limit: 50, after } } })),
  createCustomer: async (slug: string, body: CustomerInput, key: string) => unwrap(await client.POST('/api/v1/companies/{slug}/customers', { body, params: { path: { slug }, header: { 'Idempotency-Key': key } } })),
  profile: async (slug: string) => unwrap(await client.GET('/api/v1/companies/{slug}/profile', { params: { path: { slug } } })),
  updateProfile: async (slug: string, body: ProfileInput, key: string) => unwrap(await client.PATCH('/api/v1/companies/{slug}/profile', { body, params: { path: { slug }, header: { 'Idempotency-Key': key } } })),
  resetPassword: async (slug: string, id: string, password: string) => unwrap(await client.POST('/api/v1/companies/{slug}/customers/{customer_id}/password', { body: { password }, params: { path: { slug, customer_id: id } } })),
};
export function generatePassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
}
