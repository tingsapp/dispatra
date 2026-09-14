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
export type PasswordInput = components['schemas']['PasswordChange'];
const client = createClient<paths>({ credentials: 'same-origin', headers: { 'X-Requested-With': 'Dispatra' } });
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (!result.response.ok) {
    const error = result.error as { error?: { message?: string; field_errors?: { field: string; message: string }[] } };
    const fields = error?.error?.field_errors?.map(f => `${f.field.replace('body.', '')}: ${f.message}`).join(' ');
    throw new ApiError(result.response.status, fields || error?.error?.message || 'Unable to complete the request. Try again.');
  }
  return result.data as T;
}
export const api = {
  me: async () => unwrap(await client.GET('/api/v1/auth/me')),
  login: async (body: LoginInput) => unwrap(await client.POST('/api/v1/auth/login', { body })),
  logout: async () => unwrap(await client.POST('/api/v1/auth/logout')),
  password: async (body: PasswordInput) => unwrap(await client.POST('/api/v1/auth/password', { body })),
  organizations: async (after?: string) => unwrap(await client.GET('/api/v1/platform/organizations', { params: { query: { limit: 50, after } } })),
  createOrganization: async (body: OrganizationInput, key: string) => unwrap(await client.POST('/api/v1/platform/organizations', { body, params: { header: { 'Idempotency-Key': key } } })),
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
