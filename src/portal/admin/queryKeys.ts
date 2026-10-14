import type { CompanyFilter, SubscriptionFilter } from '../api';
/** Owner query keys contain only IDs and filters, never credentials. */
export const companiesKey = (filter?: CompanyFilter) => filter ? ['platform', 'companies', filter] as const : ['platform', 'companies'] as const;
export const companyKey = (id: string) => ['platform', 'company', id] as const;
export const monthlyPlanKey = ['platform', 'billing', 'plan'] as const;
export const subscriptionKey = (id: string) => ['platform', 'subscription', id] as const;
export const subscriptionsKey = (filter?: SubscriptionFilter) => filter ? ['platform', 'subscriptions', filter] as const : ['platform', 'subscriptions'] as const;
export const revenueKey = ['platform', 'revenue'] as const;
export const auditKey = (id: string) => ['platform', 'audit', id] as const;
export const dispatchersKey = (id: string) => ['platform', 'dispatchers', id] as const;
export const agentKeys = ['platform', 'agents'] as const;
export const agentMonitorKey = (accountId: string) => [...agentKeys, 'monitor', accountId] as const;
