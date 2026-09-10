export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  role: string;
  organization: string;
  hub: string;
  organizationId: string;
  employeeId?: string;
  timezone: string;
  avatarInitials: string;
  avatarUrl?: string;
  orgLogoUrl?: string;
  defaultMapMode: 'map' | 'satellite';
  telemetryThresholdMinutes: number;
  enableSoundAlerts: boolean;
  autoCenterOnSelect: boolean;
  distanceUnits: 'km' | 'mi';
  timeFormat: '12h' | '24h';
  twoFactorEnabled: boolean;
  lastLogin: string;
}

export const DEFAULT_USER_PROFILE: UserProfile = {
  name: 'Sarah Kowalski',
  email: 'support@tingsapp.com',
  phone: '+1 (604) 555-0192',
  role: 'Senior Dispatcher & Logistics Ops',
  organization: 'Dispatra Logistics BC',
  hub: 'Metro Vancouver Origin Hub (#01 - 1055 W Georgia St, Vancouver)',
  organizationId: 'ORG-8842',
  employeeId: 'ORG-8842',
  timezone: 'America/Vancouver (PT, UTC-7)',
  avatarInitials: 'SK',
  defaultMapMode: 'map',
  telemetryThresholdMinutes: 5,
  enableSoundAlerts: true,
  autoCenterOnSelect: true,
  distanceUnits: 'km',
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
      const organizationId = parsed.organizationId || parsed.employeeId || DEFAULT_USER_PROFILE.organizationId;
      return { ...DEFAULT_USER_PROFILE, ...parsed, organizationId };
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
