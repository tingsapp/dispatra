import createClient from 'openapi-fetch';
import type { paths, components } from './schema';
export type PaymentTarget = { kind: 'owner'; id: string } | { kind: 'company'; slug: string };
export type Account = components['schemas']['AccountView'];
export type Customer = components['schemas']['CustomerAccessView'];
export type Profile = components['schemas']['CustomerView'];
export type Organization = components['schemas']['OrganizationView'];
export type ProfileInput = components['schemas']['ProfileUpdate'];
export type CustomerInput = components['schemas']['CustomerCreate'];
export type OrganizationInput = components['schemas']['OrganizationCreate'];
export type TrialSignupInput = components['schemas']['TrialSignup'];
export type LoginInput = components['schemas']['Login'];
export type CompanySummary = components['schemas']['CompanySummary'];
export type MonthlyPlan = components['schemas']['MonthlyPlanView'];
export type MonthlyPlanInput = components['schemas']['MonthlyPlanUpdate'];
export type SubscriptionPlan = components['schemas']['SubscriptionPlanView'];
export type CompanySubscription = components['schemas']['CompanySubscriptionView'];
export type CompanySubscriptionInput = components['schemas']['CompanySubscriptionUpdate'];
export type CompanySubscriptionSummary = components['schemas']['CompanySubscriptionSummary'];
export type PlatformRevenue = components['schemas']['PlatformRevenueView'];
export type SubscriptionFilter = { search?: string; status?: CompanySubscription['status'] };
export type PlatformNotification = components['schemas']['PlatformNotificationView'];
export type AgentMonitor = components['schemas']['AgentMonitorView'];
export type AgentStatus = components['schemas']['AgentStatus'];
export type AgentActivity = components['schemas']['AgentLogView'];
export type AgentName = components['schemas']['AgentLogView']['agent'];
export type TechnicalIssue = components['schemas']['TechnicalIssueView'];
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
export type OperationalIncident = components['schemas']['IncidentView'];
export type OperationalQuestion = components['schemas']['QuestionView'];
export type OperationalReply = components['schemas']['Reply'];
export const api = {
  paymentHistory: async (target: PaymentTarget, after?: string) => target.kind === 'owner'
    ? unwrap(await client.GET('/api/v1/platform/organizations/{organization_id}/payments', { params: { path: { organization_id: target.id }, query: { after } } }))
    : unwrap(await client.GET('/api/v1/companies/{slug}/billing/payments', { params: { path: { slug: target.slug }, query: { after } } })),
  paymentMethod: async (target: PaymentTarget) => target.kind === 'owner'
    ? unwrap(await client.GET('/api/v1/platform/organizations/{organization_id}/payment-method', { params: { path: { organization_id: target.id } } }))
    : unwrap(await client.GET('/api/v1/companies/{slug}/billing/payment-method', { params: { path: { slug: target.slug } } })),
  startCardSetup: async (target: PaymentTarget, key: string, termsVersion: number) => target.kind === 'owner'
    ? unwrap(await client.POST('/api/v1/platform/organizations/{organization_id}/payment-method/setup', { body: { consent: true, terms_version: termsVersion }, params: { path: { organization_id: target.id }, header: { 'Idempotency-Key': key } } }))
    : unwrap(await client.POST('/api/v1/companies/{slug}/billing/payment-method/setup', { body: { consent: true, terms_version: termsVersion }, params: { path: { slug: target.slug }, header: { 'Idempotency-Key': key } } })),
  confirmCardSetup: async (target: PaymentTarget, session: string) => target.kind === 'owner'
    ? unwrap(await client.POST('/api/v1/platform/organizations/{organization_id}/payment-method/confirm', { body: { session_id: session }, params: { path: { organization_id: target.id } } }))
    : unwrap(await client.POST('/api/v1/companies/{slug}/billing/payment-method/confirm', { body: { session_id: session }, params: { path: { slug: target.slug } } })),
  refreshPaymentMethod: async (target: PaymentTarget) => target.kind === 'owner'
    ? unwrap(await client.POST('/api/v1/platform/organizations/{organization_id}/payment-method/refresh', { params: { path: { organization_id: target.id } } }))
    : unwrap(await client.POST('/api/v1/companies/{slug}/billing/payment-method/refresh', { params: { path: { slug: target.slug } } })),
  operationalIssues: async (status: 'OPEN' | 'ALL' = 'OPEN', before?: string) => unwrap(await client.GET('/api/v1/platform/agents/operational/issues', { params: { query: { status, before, limit: 12 } } })),
  runOperationalCheck: async (key: string) => unwrap(await client.POST('/api/v1/platform/agents/operational/check', { params: { header: { 'Idempotency-Key': key } } })),
  acknowledgeOperationalIssue: async (row: OperationalIncident) => unwrap(await client.POST('/api/v1/platform/agents/operational/issues/{identity}/acknowledge', { body: { version: row.version }, params: { path: { identity: row.id }, header: { 'Idempotency-Key': crypto.randomUUID() } } })),
  driverOperationalQuestions: async (slug: string) => unwrap(await client.GET('/api/v1/companies/{slug}/driver/operational/questions', { params: { path: { slug } } })),
  replyToOperationalQuestion: async (slug: string, identity: string, body: OperationalReply, key: string) => unwrap(await client.POST('/api/v1/companies/{slug}/driver/operational/questions/{identity}/reply', { body, params: { path: { slug, identity }, header: { 'Idempotency-Key': key } } })),
  companySettings: async (slug: string) => unwrap(await client.GET('/api/v1/companies/{slug}/settings', { params: { path: { slug } } })),
  saveCompanySettings: async (slug: string, body: components['schemas']['SettingsUpdate'], key: string) => unwrap(await client.PUT('/api/v1/companies/{slug}/settings', { body, params: { path: { slug }, header: { 'Idempotency-Key': key } } })),
  me: async () => unwrap(await client.GET('/api/v1/auth/me')),
  signup: async (body: TrialSignupInput, key: string) => unwrap(await client.POST('/api/v1/auth/signup', { body, params: { header: { 'Idempotency-Key': key } } })),
  verification: async () => unwrap(await client.GET('/api/v1/auth/verification')),
  verifyEmail: async (code: string, key: string) => unwrap(await client.POST('/api/v1/auth/verification/confirm', {body:{code},params:{header:{'Idempotency-Key':key}}})),
  resendVerification: async (key: string) => unwrap(await client.POST('/api/v1/auth/verification/resend', {params:{header:{'Idempotency-Key':key}}})),
  login: async (body: LoginInput) => unwrap(await client.POST('/api/v1/auth/login', { body })),
  logout: async () => unwrap(await client.POST('/api/v1/auth/logout')),
  password: async (body: PasswordInput) => unwrap(await client.POST('/api/v1/auth/password', { body })),
  organizations: async (filter: CompanyFilter = {}, after?: string) => unwrap(await client.GET('/api/v1/platform/organizations', { params: { query: { limit: 50, after, search: filter.search || undefined, status: filter.status } } })),
  monthlyPlan: async () => unwrap(await client.GET('/api/v1/platform/billing/plan')),
  companySubscription: async (id: string) => unwrap(await client.GET('/api/v1/platform/organizations/{organization_id}/subscription', { params: { path: { organization_id: id } } })),
  updateCompanySubscription: async (id: string, body: CompanySubscriptionInput, key: string) => unwrap(await client.PATCH('/api/v1/platform/organizations/{organization_id}/subscription', { body, params: { path: { organization_id: id }, header: { 'Idempotency-Key': key } } })),
  companySubscriptions: async (filter: SubscriptionFilter = {}, after?: string) => unwrap(await client.GET('/api/v1/platform/billing/subscriptions', { params: { query: { ...filter, search: filter.search || undefined, after, limit: 50 } } })),
  platformRevenue: async () => unwrap(await client.GET('/api/v1/platform/billing/revenue')),
  subscriptionPlan: async () => unwrap(await client.GET('/api/v1/subscription/plan')),
  updateMonthlyPlan: async (body: MonthlyPlanInput, key: string) => unwrap(await client.PATCH('/api/v1/platform/billing/plan', { body, params: { header: { 'Idempotency-Key': key } } })),
  createOrganization: async (body: OrganizationInput, key: string) => unwrap(await client.POST('/api/v1/platform/organizations', { body, params: { header: { 'Idempotency-Key': key } } })),
  company: async (id: string) => unwrap(await client.GET('/api/v1/platform/organizations/{organization_id}', { params: { path: { organization_id: id } } })),
  updateCompany: async (id: string, body: components['schemas']['CompanyUpdate'], key: string) => unwrap(await client.PATCH('/api/v1/platform/organizations/{organization_id}', { body, params: { path: { organization_id: id }, header: { 'Idempotency-Key': key } } })),
  updateCompanyOverview: async (id: string, body: components['schemas']['CompanyOverviewUpdate'], key: string) => unwrap(await client.PATCH('/api/v1/platform/organizations/{organization_id}/overview', { body, params: { path: { organization_id: id }, header: { 'Idempotency-Key': key } } })),
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
  platformNotifications: async () => unwrap(await client.GET('/api/v1/platform/notifications', { params: { query: { limit: 50 } } })),
  readPlatformNotification: async (row: PlatformNotification, key: string) => unwrap(await client.POST('/api/v1/platform/notifications/{identity}/read', { body: { version: row.version }, params: { path: { identity: row.id }, header: { 'Idempotency-Key': key } } })),
  readAllPlatformNotifications: async (key: string) => unwrap(await client.POST('/api/v1/platform/notifications/read-all', { params: { header: { 'Idempotency-Key': key } } })),
  agentMonitor: async () => unwrap(await client.GET('/api/v1/platform/agents/monitor')),
  agentLogs: async (agent?: AgentName, level?: 'INFO' | 'WARNING' | 'ERROR', before?: string, limit = 25) => unwrap(await client.GET('/api/v1/platform/agents/logs', { params: { query: { agent, level, before, limit } } })),
  technicalReports: async (status: 'OPEN' | 'ALL', before?: string, limit = 12, agent?: AgentName) => unwrap(await client.GET('/api/v1/platform/agents/issues', { params: { query: { status, before, limit, agent } } })),
  runTechnicalCheck: async (key: string) => unwrap(await client.POST('/api/v1/platform/agents/technical/check', { params: { header: { 'Idempotency-Key': key } } })),
  decideTechnicalReport: async (row: TechnicalIssue, approve: boolean, key: string) => {
    const params = { path: { identity: row.id }, header: { 'Idempotency-Key': key } };
    return unwrap(await (approve ? client.POST('/api/v1/platform/agents/issues/{identity}/approve', { body: { version: row.version }, params })
      : client.POST('/api/v1/platform/agents/issues/{identity}/reject', { body: { version: row.version }, params })));
  },
  reportRuntime: async (kind: 'RUNTIME_ERROR' | 'UNHANDLED_REJECTION') => unwrap(await client.POST('/api/v1/diagnostics/runtime', { body: { source: 'WEB', kind } })),
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
