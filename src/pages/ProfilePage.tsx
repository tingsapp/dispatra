import React, { useState, useRef } from 'react';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Building,
  MapPin,
  Shield,
  Bell,
  Sliders,
  Check,
  RotateCcw,
  Key,
  Laptop,
  CheckCircle2,
  Clock,
  Navigation,
  Camera,
  Upload,
  Image as ImageIcon,
  Trash2,
  Hash
} from 'lucide-react';
import {
  UserProfile,
  loadUserProfile,
  saveUserProfile,
  resetUserProfile
} from '../lib/profileStorage';

interface ProfilePageProps {
  onBackToMonitor: () => void;
  onNotification?: (msg: string) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  onBackToMonitor,
  onNotification
}) => {
  const [profile, setProfile] = useState<UserProfile>(() => loadUserProfile());
  const [activeSection, setActiveSection] = useState<'details' | 'preferences' | 'security'>('details');
  const [isSaved, setIsSaved] = useState(false);

  // File upload refs & drag states
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const orgLogoInputRef = useRef<HTMLInputElement | null>(null);
  const [isAvatarDragging, setIsAvatarDragging] = useState(false);
  const [isOrgLogoDragging, setIsOrgLogoDragging] = useState(false);

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

  const handleOrgLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file, (dataUrl) => {
        setProfile((prev) => ({ ...prev, orgLogoUrl: dataUrl }));
        setIsSaved(false);
        onNotification?.('Organization & Hub logo updated. Click "Save Profile" to persist.');
      });
    }
    if (orgLogoInputRef.current) orgLogoInputRef.current.value = '';
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

  const handleOrgLogoDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsOrgLogoDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file, (dataUrl) => {
        setProfile((prev) => ({ ...prev, orgLogoUrl: dataUrl }));
        setIsSaved(false);
        onNotification?.('Organization & Hub logo updated via drag-and-drop');
      });
    }
  };

  const handleRemoveAvatar = () => {
    setProfile((prev) => ({ ...prev, avatarUrl: undefined }));
    setIsSaved(false);
    onNotification?.('Removed custom logo. Reverted to default monogram.');
  };

  const handleRemoveOrgLogo = () => {
    setProfile((prev) => ({ ...prev, orgLogoUrl: undefined }));
    setIsSaved(false);
    onNotification?.('Removed custom organization logo.');
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
    <div className="h-full w-full bg-slate-50 flex flex-col overflow-y-auto">
      {/* TOP HEADER */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex-shrink-0 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToMonitor}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Monitor</span>
            </button>
            <div className="h-4 w-px bg-slate-200 hidden sm:block" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-slate-900 tracking-tight">
                  My Profile
                </h1>
                <span className="text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">
                  {profile.role}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage your dispatcher credentials, operating hub, and monitor display preferences.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
              title="Reset to defaults"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Reset</span>
            </button>

            <button
              type="button"
              onClick={() => handleSave()}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                isSaved
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 hover:bg-black text-white shadow-xs'
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
          </div>
        </div>

        {/* SUB-NAVIGATION TABS */}
        <div className="max-w-5xl mx-auto flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setActiveSection('details')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeSection === 'details'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Personal & Hub Details</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('preferences')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeSection === 'preferences'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Dispatch & Monitor Preferences</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('security')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeSection === 'security'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Security & Sessions</span>
          </button>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 space-y-6">
        {/* SECTION 1: PERSONAL & HUB DETAILS */}
        {activeSection === 'details' && (
          <div className="space-y-6">
            {/* Dispatcher Identity Card with Changeable Logo */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
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
                      ? 'border-blue-500 bg-blue-50 ring-4 ring-blue-100'
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
                    <span className="text-slate-800 font-semibold text-xl">
                      {profile.avatarInitials}
                    </span>
                  )}

                  {/* Hover Overlay with Camera Icon */}
                  <div className="absolute inset-0 bg-slate-900/60 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-5 h-5 mb-0.5 text-white" />
                    <span className="text-[10px] font-medium">Change</span>
                  </div>

                  <span
                    className="absolute bottom-0.5 right-0.5 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full pointer-events-none"
                    title="On Duty"
                  />
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
                    <h2 className="text-base font-semibold text-slate-900">{profile.name}</h2>
                    <span className="text-[11px] font-medium bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200/60">
                      On Duty
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 flex items-center gap-2">
                    <span>{profile.role}</span>
                    <span>•</span>
                    <span>Organization ID: {profile.organizationId}</span>
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-md border border-slate-200/80 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5 text-slate-500" />
                      <span>Upload logo</span>
                    </button>

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
                  <p className="text-[11px] text-slate-400">
                    Supports PNG, JPG, or SVG (max 3MB). Drag and drop or click to replace.
                  </p>
                </div>
              </div>
            </div>

            {/* Profile Form */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
              <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-3">
                Contact & Station Information
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={profile.name}
                      onChange={(e) => handleTextChange('name', e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Work Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      value={profile.email}
                      onChange={(e) => handleTextChange('email', e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Direct Phone / Dispatch Radio
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="tel"
                      value={profile.phone}
                      onChange={(e) => handleTextChange('phone', e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Operational Role
                  </label>
                  <input
                    type="text"
                    value={profile.role}
                    onChange={(e) => handleTextChange('role', e.target.value)}
                    className="w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Organization
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={profile.organization}
                      onChange={(e) => handleTextChange('organization', e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Organization ID
                  </label>
                  <div className="relative">
                    <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={profile.organizationId}
                      onChange={(e) => handleTextChange('organizationId', e.target.value)}
                      placeholder="e.g. ORG-8842"
                      className="w-full pl-9 pr-3 py-2 text-xs text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Timezone
                  </label>
                  <div className="relative">
                    <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      disabled
                      value={profile.timezone}
                      className="w-full pl-9 pr-3 py-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Active Operating Origin / Dispatch Hub
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={profile.hub}
                      onChange={(e) => handleTextChange('hub', e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    V1 operates on a single active origin hub model per route. Pickup routes start from this central station.
                  </p>
                </div>

                {/* Organization & Hub Brand Logo Uploader */}
                <div className="sm:col-span-2 pt-4 border-t border-slate-100">
                  <div className="mb-2">
                    <label className="block text-xs font-semibold text-slate-900">
                      Organization & Hub Logo
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Official station brand emblem displayed on reports, dispatch manifests, and customer tracking headers.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-4 bg-slate-50/70 rounded-xl border border-slate-200/80">
                    {/* Logo Dropzone / Box */}
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDragEnter={() => setIsOrgLogoDragging(true)}
                      onDragLeave={() => setIsOrgLogoDragging(false)}
                      onDrop={handleOrgLogoDrop}
                      onClick={() => orgLogoInputRef.current?.click()}
                      className={`relative w-36 h-20 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors bg-white overflow-hidden shrink-0 group select-none ${
                        isOrgLogoDragging
                          ? 'border-blue-500 bg-blue-50 ring-4 ring-blue-100'
                          : 'border-slate-300 hover:border-slate-400'
                      }`}
                      title="Click or drag and drop logo image"
                    >
                      {profile.orgLogoUrl ? (
                        <img
                          src={profile.orgLogoUrl}
                          alt={profile.organization}
                          className="w-full h-full object-contain p-1.5"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                          <ImageIcon className="w-6 h-6 text-slate-400 mb-1" />
                          <span className="text-[10px] font-medium text-slate-600">Dispatra Hub</span>
                        </div>
                      )}

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-slate-900/60 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="w-4 h-4 mb-0.5 text-white" />
                        <span className="text-[10px] font-medium">Change</span>
                      </div>
                    </div>

                    <input
                      ref={orgLogoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleOrgLogoFileSelect}
                      className="hidden"
                    />

                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => orgLogoInputRef.current?.click()}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors shadow-2xs"
                        >
                          <Upload className="w-3.5 h-3.5 text-slate-500" />
                          <span>Upload logo</span>
                        </button>

                        {profile.orgLogoUrl && (
                          <button
                            type="button"
                            onClick={handleRemoveOrgLogo}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-400">
                        Supports SVG, PNG, or JPG (transparent background recommended, max 3MB).
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2: DISPATCH & MONITOR PREFERENCES */}
        {activeSection === 'preferences' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Monitor Canvas & Map Defaults
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure default basemap view and automatic viewport centering when tracking active routes.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2 border-t border-slate-100">
                {/* Default Basemap */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Default Basemap Style
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleTextChange('defaultMapMode', 'map')}
                      className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors text-center ${
                        profile.defaultMapMode === 'map'
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Street Map (Liberty)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTextChange('defaultMapMode', 'satellite')}
                      className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors text-center ${
                        profile.defaultMapMode === 'satellite'
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Satellite Imagery
                    </button>
                  </div>
                </div>

                {/* Distance Units */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Distance Measurement Unit
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleTextChange('distanceUnits', 'km')}
                      className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors text-center ${
                        profile.distanceUnits === 'km'
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Kilometers (km) - Standard
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTextChange('distanceUnits', 'mi')}
                      className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors text-center ${
                        profile.distanceUnits === 'mi'
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Miles (mi)
                    </button>
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-xs font-medium text-slate-900">
                      Auto-Fly on Entity Selection
                    </div>
                    <div className="text-xs text-slate-500">
                      Smoothly center the map view onto drivers or delivery destinations when selected.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTextChange('autoCenterOnSelect', !profile.autoCenterOnSelect)}
                    className={`w-11 h-6 flex items-center rounded-full transition-colors p-1 ${
                      profile.autoCenterOnSelect ? 'bg-slate-900' : 'bg-slate-200'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        profile.autoCenterOnSelect ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-xs font-medium text-slate-900">
                      Exception Sound Chimes
                    </div>
                    <div className="text-xs text-slate-500">
                      Play an audible alert when a delivery is flagged as late start or ETA at risk.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTextChange('enableSoundAlerts', !profile.enableSoundAlerts)}
                    className={`w-11 h-6 flex items-center rounded-full transition-colors p-1 ${
                      profile.enableSoundAlerts ? 'bg-slate-900' : 'bg-slate-200'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        profile.enableSoundAlerts ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Inactive Telemetry Threshold */}
              <div className="pt-4 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-900">
                    Driver Inactive Telemetry Warning Threshold
                  </label>
                  <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                    {profile.telemetryThresholdMinutes} minutes
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Drivers without fresh GPS signal beyond this threshold receive an amber "GPS Stale" warning.
                </p>
                <input
                  type="range"
                  min="2"
                  max="15"
                  step="1"
                  value={profile.telemetryThresholdMinutes}
                  onChange={(e) => handleTextChange('telemetryThresholdMinutes', parseInt(e.target.value, 10))}
                  className="w-full accent-slate-900 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>2 min (Strict)</span>
                  <span>5 min (Recommended)</span>
                  <span>15 min (Relaxed)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 3: SECURITY & SESSIONS */}
        {activeSection === 'security' && (
          <div className="space-y-6">
            {/* Change Password */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
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

              <form onSubmit={handlePasswordSubmit} className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full max-w-md px-3 py-2 text-xs text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 max-w-xl gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      className="w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium bg-slate-900 hover:bg-black text-white rounded-lg transition-colors"
                >
                  Update Password
                </button>
              </form>
            </div>

            {/* Two Factor Authentication */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Two-Factor Authentication (2FA)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Hardware key or TOTP Authenticator app verification.
                  </p>
                </div>
                <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-200/80 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Enforced & Active</span>
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Your dispatcher account is secured with standard TOTP 6-digit verification codes upon sign in from new workstations.
              </p>
            </div>

            {/* Active Session */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-semibold text-slate-900">
                Active Dispatcher Session
              </h3>
              <div className="flex items-start gap-3.5 p-3.5 bg-slate-50 rounded-lg border border-slate-200/80">
                <Laptop className="w-5 h-5 text-slate-600 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="text-xs font-medium text-slate-900 flex items-center gap-2">
                    <span>Current Workstation (Chrome on macOS)</span>
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-sm font-semibold">
                      This Device
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Vancouver, BC, Canada • Session started at 07:15 AM PT
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
