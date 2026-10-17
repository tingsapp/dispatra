import { FloatingPanel } from './ui/FloatingPanel';
import React, { useEffect, useState } from 'react';
import { companySlugForCurrentPath } from '../lib/pageRoutes';
import { NotificationPanel, useUnreadNotifications } from '../portal/Notifications';
import { MonitorActivity } from './activity/MonitorActivity';
import type { AssistantReference } from '../operations/api';
import { MonitorBadge } from './monitor/MonitorBadge';
import {
  Bell,
  X,
  AlertTriangle,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { Job } from '../types';

interface MonitorActionsProps {
  metrics?: React.ReactNode;
  active?: boolean;
  showActivityPopover?: boolean;
  setShowActivityPopover?: React.Dispatch<React.SetStateAction<boolean>>;
  onSelectReference?: (reference: AssistantReference) => void;
  showNotificationPopover?: boolean;
  setShowNotificationPopover?: React.Dispatch<React.SetStateAction<boolean>>;
  onSelectJob?: (jobNumber: string) => void;
  /** Order agent notifications open Orders, where emails needing details are listed as drafts. */
  onOpenEmailDrafts?: () => void;
  onActionNotification: (msg: string) => void;
  jobs?: Job[];
}

interface DispatchAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  time: string;
  unread: boolean;
}

export const MonitorActions: React.FC<MonitorActionsProps> = ({
  metrics,
  active = true,
  showActivityPopover: externalShowActivity,
  setShowActivityPopover: externalSetShowActivity,
  onSelectReference,
  showNotificationPopover: externalShowNotification,
  setShowNotificationPopover: externalSetShowNotification,
  onSelectJob,
  onOpenEmailDrafts,
  onActionNotification,
  jobs = []
}) => {
  // Local states if not passed
  const [internalNotificationOpen, setInternalNotificationOpen] = useState(false);
  const [internalActivityOpen, setInternalActivityOpen] = useState(false);
  const activityOpen = externalShowActivity ?? internalActivityOpen;
  const setActivityOpen = externalSetShowActivity || setInternalActivityOpen;


  const isNotificationOpen = externalShowNotification !== undefined ? externalShowNotification : internalNotificationOpen;
  const setIsNotificationOpen = externalSetShowNotification || setInternalNotificationOpen;
  useEffect(() => { if (!active) setIsNotificationOpen(false); }, [active, setIsNotificationOpen]);

  const slug = companySlugForCurrentPath();
  const [alerts, setAlerts] = useState<DispatchAlert[]>([
    {
      id: 'alt-1',
      type: 'critical',
      title: 'Job #461 Delay Detected',
      message: 'Traffic slowdown on Granville Bridge corridor (+22 min delay).',
      time: '4m ago',
      unread: true
    },
    {
      id: 'alt-2',
      type: 'warning',
      title: 'Unassigned Load #439',
      message: 'Medical Supplies at 1055 W Georgia St awaits driver dispatch.',
      time: '12m ago',
      unread: true
    },
    {
      id: 'alt-3',
      type: 'info',
      title: 'Vehicle D14 Telemetry Active',
      message: 'Arles Morgan heading inbound to Vancouver Gastown corridor.',
      time: '18m ago',
      unread: true
    }
  ]);

  // Company workspaces read the API inbox; /prototype keeps its static sample alerts.
  const apiUnread = useUnreadNotifications(slug ?? '');
  const unreadCount = slug ? apiUnread : alerts.filter((a) => a.unread).length;

  const changeNotification = (next: boolean) => {
    setIsNotificationOpen(next);
  };

  const markAllAlertsRead = () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, unread: false })));
    onActionNotification('Marked all alerts as read');
  };

  return (
    <>
      {slug && <div className="absolute bottom-6 left-6 z-40 pointer-events-auto">
        <MonitorActivity key={slug} slug={slug} open={activityOpen} active={active} onSelectReference={onSelectReference} onOpenChange={next => {
          setActivityOpen(next);
          if (next) setIsNotificationOpen(false);
        }} />
      </div>}
    <div className="app-map-toolbar absolute top-5 right-6 z-30 pointer-events-auto flex items-start gap-2.5 select-none">
      {metrics}
      {/* 2. NOTIFICATION ICON BUTTON */}
      <FloatingPanel open={isNotificationOpen} onOpenChange={changeNotification} label="Notifications"
        align="end" size="rich" className="app-map-menu p-3" autoFocusSelector="input" trigger={
        <button
          aria-expanded={isNotificationOpen}
          className="app-metric app-map-icon relative shrink-0"
          title="Dispatch alerts and notifications"
          aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        >
          <Bell className="w-4 h-4 stroke-[2.2]" />
          {unreadCount > 0 && (
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
          )}
        </button>
        }>
        {slug ? isNotificationOpen && <NotificationPanel slug={slug} onClose={() => setIsNotificationOpen(false)} onOpen={row => {
          const job = jobs.find(item => item.id === row.order_id);
          if (/^(intake|mailbox)\./.test(row.kind)) onOpenEmailDrafts?.();
          else if (job) onSelectJob?.(job.jobNumber);
          setIsNotificationOpen(false);
        }} /> : <>


              <div className="flex items-center justify-between pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-slate-900">
                    Dispatch Notifications
                  </span>
                  {unreadCount > 0 && (
                    <MonitorBadge tone="danger">{unreadCount}</MonitorBadge>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={markAllAlertsRead}
                    className="text-xs font-medium text-slate-700 hover:text-slate-700 transition-colors"
                  >
                    Mark read
                  </button>
                  <button
                    onClick={() => setIsNotificationOpen(false)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
                    title="Close Notifications"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-2.5 max-h-64 overflow-y-auto">
                {alerts.map((alt) => (
                  <div
                    key={alt.id}
                    onClick={() => {
                      setAlerts((prev) =>
                        prev.map((a) => (a.id === alt.id ? { ...a, unread: false } : a))
                      );
                      onActionNotification(`Alert: ${alt.title}`);
                    }}
                    className={`py-2.5 px-2 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors ${
                      alt.unread ? 'bg-app-accent-soft/40' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 shrink-0">
                        {alt.type === 'critical' ? (
                          <div className="w-4 h-4 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                            <AlertTriangle className="w-2.5 h-2.5 stroke-[2.5]" />
                          </div>
                        ) : alt.type === 'warning' ? (
                          <div className="w-4 h-4 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                            <Clock className="w-2.5 h-2.5 stroke-[2.5]" />
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-app-accent-soft text-app-accent flex items-center justify-center">
                            <CheckCircle2 className="w-2.5 h-2.5 stroke-[2.5]" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-800 text-xs truncate">
                            {alt.title}
                          </span>
                          <span className="text-xs text-slate-400">{alt.time}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                          {alt.message}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
        </>}
      </FloatingPanel>
    </div>
    </>
  );
};
