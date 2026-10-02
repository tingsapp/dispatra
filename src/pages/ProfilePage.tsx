import { useWorkspaceAccount } from '../portal/WorkspaceAccount';
import { CompanyProfilePage } from '../portal/CompanyProfilePage';
import { Button } from '../components/ui/button';
import {
Check,
CheckCircle2,
Building2,
Mail,
Phone,
Shield,
User
} from 'lucide-react';
import React,{ useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { CompanyIdentity, type CompanyIdentityValue } from '../components/settings/CompanyIdentity';
import { useSettingsGuard } from '../components/settings/useSettingsGuard';
import { loadBillingConfig, saveBillingConfig } from '../lib/billingStorage';
import { ContactInput } from '../components/ui/ContactInput';
import { isValidEmail } from '../lib/email';
import {
UserProfile,
loadUserProfile,
saveUserProfile
} from '../lib/profileStorage';

interface ProfilePageProps {
  onNotification?: (msg: string) => void;
  initialSection?: 'company' | 'security';
}

export const ProfilePage: React.FC<ProfilePageProps> = (props) => {
  const workspace = useWorkspaceAccount();
  return workspace ? <CompanyProfilePage initialSection={props.initialSection} /> : <PrototypeProfilePage {...props} />;
};

const PrototypeProfilePage: React.FC<ProfilePageProps> = ({
  onNotification,
  initialSection
}) => {
  const [profile, setProfile] = useState<UserProfile>(() => loadUserProfile());
  const [savedProfile, setSavedProfile] = useState(profile);
  const [companyIdentity, setCompanyIdentity] = useState<CompanyIdentityValue>(() => {
    const { name, address, logoDataUrl } = loadBillingConfig().company;
    return { name, address, logoDataUrl };
  });
  const [savedCompanyIdentity, setSavedCompanyIdentity] = useState(companyIdentity);
  const [activeSection, setActiveSection] = useState<'company' | 'security'>(() => initialSection ?? 'company');
  const companyDirty = Object.keys(companyIdentity).some(key => companyIdentity[key as keyof CompanyIdentityValue] !== savedCompanyIdentity[key as keyof CompanyIdentityValue]);
  const contactDirty = (['name', 'email', 'phone', 'role'] as const).some(key => profile[key] !== savedProfile[key]);
  useSettingsGuard(companyDirty || contactDirty);
  const [isSaved, setIsSaved] = useState(false);

  // Password fields state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handleTextChange = (field: 'name' | 'email' | 'phone' | 'role', val: string) => {
    setProfile((prev) => ({ ...prev, [field]: val }));
    setIsSaved(false);
  };

  const handleSave = () => {
    if (contactDirty && profile.email.trim() && !isValidEmail(profile.email)) { (document.getElementById('company-contact-email') as HTMLInputElement | null)?.reportValidity(); return; }
    if (contactDirty) {
      const latest = loadUserProfile();
      for (const key of ['name', 'email', 'phone', 'role'] as const) {
        if (profile[key] !== savedProfile[key]) latest[key] = profile[key];
      }
      saveUserProfile(latest);
      setProfile(latest);
      setSavedProfile(latest);
    }
    if (companyDirty) {
      const latest = loadBillingConfig();
      const changed: Partial<CompanyIdentityValue> = {};
      for (const key of ['name', 'address', 'logoDataUrl'] as const) {
        if (companyIdentity[key] !== savedCompanyIdentity[key]) changed[key] = companyIdentity[key];
      }
      saveBillingConfig({ ...latest, company: { ...latest.company, ...changed } });
      setSavedCompanyIdentity(companyIdentity);
    }
    setIsSaved(true);
    onNotification?.('Company details saved.');
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      onNotification?.('Please enter your current password');
      return;
    }
    if (newPassword.length < 8) {
      onNotification?.('New password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      onNotification?.('New password and confirmation do not match');
      return;
    }
    setPasswordSuccess(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    onNotification?.('Security password updated successfully');
    setTimeout(() => setPasswordSuccess(false), 4000);
  };

  return (
    <div className="app-page app-page-profile app-page-reading h-full w-full flex flex-col overflow-hidden font-sans">
      {/* HEADER BAR */}
      <PageHeader title="Profile" description="Company details and account security." />

      {/* SUB-NAVIGATION TABS */}
      <div className="page-content h-12 bg-app-canvas flex items-center gap-2 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSection('company')}
                aria-pressed={activeSection === 'company'}
            className="app-tab inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Company</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('security')}
                aria-pressed={activeSection === 'security'}
            className="app-tab inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Security</span>
          </button>

      </div>

      {/* MAIN CONTENT AREA */}
      <main className="page-content flex-1 overflow-y-auto py-6 space-y-6">
        {/* SECTION 1: COMPANY */}
        {activeSection === 'company' && (
          <div className="profile-company-content flex flex-1 flex-col gap-6">
            <CompanyIdentity value={companyIdentity} onChange={change => {
              setCompanyIdentity(previous => ({ ...previous, ...change }));
              setIsSaved(false);
            }}>
              <div>
                <h4 className="app-section-title text-slate-900 mb-4">Contact Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="company-contact-name" className="app-label">
                    Contact Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      id="company-contact-name"
                      type="text"
                      value={profile.name}
                      onChange={(e) => handleTextChange('name', e.target.value)}
                      className="app-input w-full pl-9 pr-3"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="company-contact-email" className="app-label">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <ContactInput
                      id="company-contact-email"
                      type="email"
                      value={profile.email}
                      onChange={(e) => handleTextChange('email', e.target.value)}
                      className="app-input w-full pl-9 pr-3"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="company-contact-phone" className="app-label">
                    Phone
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <ContactInput
                      id="company-contact-phone"
                      type="tel"
                      value={profile.phone}
                      onChange={(e) => handleTextChange('phone', e.target.value)}
                      className="app-input w-full pl-9 pr-3"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="company-contact-role" className="app-label">
                    Role
                  </label>
                  <input
                    id="company-contact-role"
                    type="text"
                    value={profile.role}
                    onChange={(e) => handleTextChange('role', e.target.value)}
                    className="app-input w-full"
                  />
                </div>

                </div>
              </div>
            </CompanyIdentity>
            <div className="mt-auto flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleSave}
                className={`app-action app-primary rounded-full px-4 py-2 text-xs font-medium text-white ${
                  isSaved ? 'bg-emerald-600' : 'bg-slate-900 hover:bg-slate-800'
                }`}
              >
                {isSaved ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Changes Saved</span>
                  </>
                ) : (
                  <span>Save Company</span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* SECTION 2: SECURITY & SESSIONS */}
        {activeSection === 'security' && (
          <div className="space-y-6">
            {/* Change Password */}
            <div className="app-panel app-panel-plain space-y-4">
              <div>
                <h3 className="app-section-title text-slate-900">
                  Account Credentials
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update your authentication password. Minimum 8 characters required.
                </p>
              </div>

              {passwordSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2.5 text-xs text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Your password has been changed successfully.</span>
                </div>
              )}

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <label htmlFor="profile-current-password" className="app-label">
                    Current Password
                  </label>
                  <input
                    id="profile-current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="app-input w-full max-w-md"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 max-w-xl gap-4">
                  <div>
                    <label htmlFor="profile-new-password" className="app-label">
                      New Password
                    </label>
                    <input
                      id="profile-new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="app-input w-full"
                    />
                  </div>

                  <div>
                    <label htmlFor="profile-confirm-password" className="app-label">
                      Confirm New Password
                    </label>
                    <input
                      id="profile-confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      className="app-input w-full"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="app-action app-primary px-4 py-2 text-xs font-medium bg-slate-900 hover:bg-black text-white rounded-full transition-colors"
                >
                  Update Password
                </Button>
              </form>
            </div>

            {/* Two Factor Authentication */}
            <div className="app-panel app-panel-plain space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="app-section-title text-slate-900">
                    Two-Factor Authentication (2FA)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Hardware key or TOTP Authenticator app verification.
                  </p>
                </div>
                <span className="text-xs font-medium bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-200/80 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Enforced & Active</span>
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Your dispatcher account is secured with standard TOTP 6-digit verification codes upon sign in from new workstations.
              </p>
            </div>

          </div>
        )}
      </main>
    </div>
  );
};
