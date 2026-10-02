const EMAIL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,63}$/;

/** One email rule for every form: local@domain.tld, no spaces, a letter TLD, at most 254 characters. */
export const isValidEmail = (value: string | null | undefined): boolean => { const v = value?.trim() ?? ''; return v.length <= 254 && EMAIL.test(v) && !/\.\.|^\.|\.@/.test(v); };
export const EMAIL_ERROR = 'Enter a valid email address, e.g. name@company.com.';
