export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  role: string;
  employeeId?: string;
  avatarInitials: string;
  avatarUrl?: string;
  defaultMapMode: 'map' | 'satellite';
  telemetryThresholdMinutes: number;
  enableSoundAlerts: boolean;
  autoCenterOnSelect: boolean;
  timeFormat: '12h' | '24h';
  twoFactorEnabled: boolean;
  lastLogin: string;
}

export const DEFAULT_USER_PROFILE: UserProfile = {
  name: 'Sarah Kowalski',
  email: 'dispatcher@dispatra.com',
  phone: '+1 (604) 555-0192',
  role: 'Senior Dispatcher & Logistics Ops',
  employeeId: 'ORG-8842',
  avatarInitials: 'SK',
  defaultMapMode: 'map',
  telemetryThresholdMinutes: 5,
  enableSoundAlerts: true,
  autoCenterOnSelect: true,
  timeFormat: '24h',
  twoFactorEnabled: true,
  lastLogin: 'Today at 07:15 AM (Pacific Time)'
};

export const PROFILE_STORAGE_KEY = 'dispatra_user_profile_v1';

export function loadUserProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Organization-level fields (name, hub, time zone, logo) moved to Organization Settings → Company; drop stale copies.
      const { organization: _org, hub: _hub, organizationId: _orgId, timezone: _tz, orgLogoUrl: _logo, ...personal } = parsed;
      return { ...DEFAULT_USER_PROFILE, ...personal };
    }
  } catch (err) {
    console.warn('Could not load profile from localStorage:', err);
  }
  return { ...DEFAULT_USER_PROFILE };
}

export function saveUserProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch (err) {
    console.warn('Could not save profile to localStorage:', err);
  }
}

export function resetUserProfile(): UserProfile {
  saveUserProfile(DEFAULT_USER_PROFILE);
  return { ...DEFAULT_USER_PROFILE };
}
