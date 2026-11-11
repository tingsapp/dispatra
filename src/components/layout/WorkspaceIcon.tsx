import { createLucideIcon, type LucideIcon } from 'lucide-react';

// Original, rounded navigation drawings. Keep the same visual weight in every role.
const Orders = createLucideIcon('WorkspaceOrders', [
  ['rect', { x: '5', y: '3', width: '14', height: '18', rx: '3', key: 'page' }],
  ['path', { d: 'M9 8h6M9 12h6M9 16h4', key: 'lines' }],
]);
const Drivers = createLucideIcon('WorkspaceDrivers', [
  ['circle', { cx: '9', cy: '8', r: '3', key: 'person' }],
  ['path', { d: 'M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v2', key: 'people' }],
]);
const Vehicles = createLucideIcon('WorkspaceVehicles', [
  ['path', { d: 'M5 18H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v11H9M15 9h3a2 2 0 0 1 1.6.8L22 13v3a2 2 0 0 1-2 2', key: 'van' }],
  ['circle', { cx: '7', cy: '18', r: '2', key: 'wheel1' }],
  ['circle', { cx: '18', cy: '18', r: '2', key: 'wheel2' }],
]);
const Companies = createLucideIcon('WorkspaceCompanies', [
  ['rect', { x: '4', y: '3', width: '16', height: '18', rx: '3', key: 'building' }],
  ['path', { d: 'M8 7h1m6 0h1M8 11h1m6 0h1M10 21v-5h4v5', key: 'windows' }],
]);
const Chat = createLucideIcon('WorkspaceChat', [
  ['path', { d: 'M7 4h10a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4H9l-5 3v-4a4 4 0 0 1-1-3V8a4 4 0 0 1 4-4Z', key: 'bubble' }],
]);
const Analytics = createLucideIcon('WorkspaceAnalytics', [
  ['path', { d: 'M5 20v-7M12 20V4M19 20V9', key: 'bars' }],
]);

const navigationIcons: Record<string, LucideIcon> = {
  Orders, Drivers, Vehicles, Shippers: Companies, Companies, Chat, Analytics,
};

export function WorkspaceIcon({ label, fallback: Fallback }: { label: string; fallback: LucideIcon }) {
  const Icon = navigationIcons[label] ?? Fallback;
  return <Icon className="app-navigation-icon shrink-0" size={18} strokeWidth={1.8} aria-hidden="true" />;
}

export const SidebarToggleIcon = createLucideIcon('SidebarToggle', [
  ['rect', { x: '3', y: '4', width: '18', height: '16', rx: '4', key: 'frame' }],
  ['path', { d: 'M9 4v16', key: 'divider' }],
]);
