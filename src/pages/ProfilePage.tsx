import { Button } from '../components/ui/button';
import {
Building,
Camera,
Check,
CheckCircle2,
Clock,
Hash,
Image as ImageIcon,
Mail,
MapPin,
Phone,
RotateCcw,
Shield,
Trash2,
User
} from 'lucide-react';
import React,{ useRef,useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import {
UserProfile,
loadUserProfile,
resetUserProfile,
saveUserProfile
} from '../lib/profileStorage';

interface ProfilePageProps {
  onNotification?: (msg: string) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  onNotification
}) => {
  const [profile, setProfile] = useState<UserProfile>(() => loadUserProfile());
  const [activeSection, setActiveSection] = useState<'details' | 'security'>('details');
  const [isSaved, setIsSaved] = useState(false);

  // File upload refs & drag states
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [isAvatarDragging, setIsAvatarDragging] = useState(false);

  // Password fields state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const processImageFile = (file: File, callback: (dataUrl: string) => void) => {
    if (!file.type.startsWith('image/')) {
      onNotification?.('Please select a valid image file (PNG, JPG, SVG, WebP)');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      onNotification?.('Image size must be under 3 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        callback(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file, (dataUrl) => {
        setProfile((prev) => ({ ...prev, avatarUrl: dataUrl }));
        setIsSaved(false);
        onNotification?.('Dispatcher logo updated. Click "Save Profile" to persist.');
      });
    }
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const handleAvatarDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsAvatarDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file, (dataUrl) => {
        setProfile((prev) => ({ ...prev, avatarUrl: dataUrl }));
        setIsSaved(false);
        onNotification?.('Dispatcher logo updated via drag-and-drop');
      });
    }
  };

  const handleRemoveAvatar = () => {
    setProfile((prev) => ({ ...prev, avatarUrl: undefined }));
    setIsSaved(false);
    onNotification?.('Removed custom logo. Reverted to default monogram.');
  };

  const handleTextChange = (field: keyof UserProfile, val: any) => {
    setProfile((prev) => ({ ...prev, [field]: val }));
    setIsSaved(false);
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    saveUserProfile(profile);
    setIsSaved(true);
    onNotification?.('Dispatcher profile updated successfully');
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleReset = () => {
    const defaults = resetUserProfile();
    setProfile(defaults);
    setIsSaved(false);
    onNotification?.('Profile settings reset to system defaults');
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
    <div className="app-page app-page-reading h-full w-full flex flex-col overflow-hidden font-sans">
      {/* HEADER BAR */}
      <PageHeader title="Profile" description="Your personal details and account security." actions={<>
          <button
            type="button"
            onClick={handleReset}
            className="app-action app-secondary"
            title="Reset to defaults"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={() => handleSave()}
            className={`app-action text-white ${
              isSaved ? 'bg-emerald-600' : 'bg-slate-900 hover:bg-slate-800'
            }`}
          >
            {isSaved ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Changes Saved</span>
              </>
            ) : (
              <span>Save Profile</span>
            )}
          </button>
      </>} />

      {/* SUB-NAVIGATION TABS */}
      <div className="page-content h-12 bg-app-canvas flex items-center gap-2 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSection('details')}
                aria-pressed={activeSection === 'details'}
            className="app-tab inline-flex items-center gap-2 whitespace-nowrap"
          >
            <User className="w-3.5 h-3.5" />
            <span>Personal Details</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('security')}
                aria-pressed={activeSection === 'security'}
            className="app-tab inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Security & Sessions</span>
          </button>
      </div>

      {/* MAIN CONTENT AREA */}
      <main className="page-content flex-1 overflow-y-auto py-6 space-y-6">
        {/* SECTION 1: PERSONAL DETAILS */}
        {activeSection === 'details' && (
          <div className="space-y-6">
            {/* Dispatcher Identity Card with Changeable Logo */}
            <div className="app-panel app-panel-plain">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                {/* Changeable Logo / Avatar with drag & drop */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnter={() => setIsAvatarDragging(true)}
                  onDragLeave={() => setIsAvatarDragging(false)}
                  onDrop={handleAvatarDrop}
                  onClick={() => avatarInputRef.current?.click()}
                  className={`relative w-20 h-20 rounded-full border-2 cursor-pointer transition-all flex items-center justify-center overflow-hidden group select-none shrink-0 ${
                    isAvatarDragging
                      ? 'border-slate-900 bg-slate-50 ring-4 ring-slate-900/10'
                      : 'border-slate-200 bg-slate-100 hover:border-slate-400'
                  }`}
                  title="Click or drag & drop image to change logo"
                >
                  {profile.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt={profile.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="text-slate-800 font-medium text-xl">
                      {profile.avatarInitials}
                    </span>
                  )}

                  {/* Hover Overlay with Camera Icon */}
                  <div className="absolute inset-0 bg-slate-900/60 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-5 h-5 mb-0.5 text-white" />
                    <span className="text-xs font-medium">Change</span>
                  </div>

                </div>

                {/* Hidden Input for avatar file selection */}
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarFileSelect}
                  className="hidden"
                />

                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2.5">
                    <h2 className="app-section-title text-slate-900">{profile.name}</h2>
                  </div>
                  <p className="text-xs text-slate-500 flex items-center gap-2">
                    <span>{profile.role}</span>
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {profile.avatarUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
                        title="Remove custom logo and revert to monogram"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    Click or drop an image on the avatar to change it. PNG, JPG or SVG, max 3MB.
                  </p>
                </div>
              </div>
            </div>

            {/* Profile Form */}
            <div className="app-panel app-panel-plain space-y-5">
              <h3 className="app-section-title text-slate-900">
                Contact Information
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="app-label">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={profile.name}
                      onChange={(e) => handleTextChange('name', e.target.value)}
                      className="app-input w-full pl-9 pr-3"
                    />
                  </div>
                </div>

                <div>
                  <label className="app-label">
                    Work Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      value={profile.email}
                      onChange={(e) => handleTextChange('email', e.target.value)}
                      className="app-input w-full pl-9 pr-3"
                    />
                  </div>
                </div>

                <div>
                  <label className="app-label">
                    Direct Phone / Dispatch Radio
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="tel"
                      value={profile.phone}
                      onChange={(e) => handleTextChange('phone', e.target.value)}
                      className="app-input w-full pl-9 pr-3"
                    />
                  </div>
                </div>

                <div>
                  <label className="app-label">
                    Operational Role
                  </label>
                  <input
                    type="text"
                    value={profile.role}
                    onChange={(e) => handleTextChange('role', e.target.value)}
                    className="app-input w-full"
                  />
                </div>

              </div>
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
                  <label className="app-label">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="app-input w-full max-w-md"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 max-w-xl gap-4">
                  <div>
                    <label className="app-label">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="app-input w-full"
                    />
                  </div>

                  <div>
                    <label className="app-label">
                      Confirm New Password
                    </label>
                    <input
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
