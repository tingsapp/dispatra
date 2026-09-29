import type { CompanyFilter } from '../api';
/** Owner query keys contain only IDs and filters, never credentials. */
export const companiesKey = (filter?: CompanyFilter) => filter ? ['platform', 'companies', filter] as const : ['platform', 'companies'] as const;
export const companyKey = (id: string) => ['platform', 'company', id] as const;
export const auditKey = (id: string) => ['platform', 'audit', id] as const;
export const dispatchersKey = (id: string) => ['platform', 'dispatchers', id] as const;
