import React, { useState } from 'react';
import {
  ArrowLeft,
  Search,
  HelpCircle,
  PhoneCall,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Send,
  LifeBuoy,
  FileText,
  Keyboard,
  Compass,
  Truck,
  ShieldCheck,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { Select } from '../components/ui/Select';

interface HelpSupportPageProps {
  onBackToMonitor: () => void;
  onNotification?: (msg: string) => void;
}

interface FAQItem {
  id: string;
  question: string;
  category: 'optimization' | 'drivers' | 'fleet' | 'tracking' | 'exceptions';
  categoryLabel: string;
  answer: string;
}

const FAQS: FAQItem[] = [
  {
    id: 'faq-1',
    question: 'How does AI route optimization proposal work in Dispatra?',
    category: 'optimization',
    categoryLabel: 'Route Optimization',
    answer:
      'Dispatra groups pending delivery jobs into optimized multi-stop routes originating from your central hub (e.g. Metro Vancouver Hub). The optimizer runs asynchronously, calculating ETAs, distances, and driver workloads. Once generated, a proposal is presented for dispatcher review. Dispatchers can inspect assignments, adjust stops, and publish the route atomically. If road conditions or driver status changes in the interim, a 409 re-validation prompt ensures safety before committing.'
  },
  {
    id: 'faq-2',
    question: 'How should dispatchers resolve "At Risk" or "Late Start" exceptions?',
    category: 'exceptions',
    categoryLabel: 'Exceptions & Delays',
    answer:
      'When traffic bottlenecks, delayed loading, or driver slowdowns push expected delivery past the customer promise window, Dispatra flags the job in the "Needs Attention" list. Dispatchers can click on the flagged job to view the recommended remedy (e.g., reassigning to an idle nearby driver). Approving the recommendation seamlessly updates the route ETA and alerts the driver. Drivers on duty receive updated stop orders on their mobile terminal.'
  },
  {
    id: 'faq-3',
    question: 'What are the vehicle capacity classes (1 Tonne to 5 Tonnes)?',
    category: 'fleet',
    categoryLabel: 'Fleet & Capacities',
    answer:
      'Dispatra categorizes local delivery fleet into four clear tonnage tiers: 1 Tonne (Courier Cargo Van, max 1,000 kg, 2 standard skids), 2 Tonnes (Standard Sprinter/Cube, max 2,000 kg, 4 skids), 3 Tonnes (Medium Box Truck with liftgate, max 3,500 kg, 6 skids), and 5 Tonnes (Heavy Straight Truck, max 5,000 kg, 10-12 skids). The system automatically blocks assignments if a shipment exceeds the vehicle payload or pallet limits.'
  },
  {
    id: 'faq-4',
    question: 'What customer privacy safeguards are enforced on live tracking links?',
    category: 'tracking',
    categoryLabel: 'Tracking & Privacy',
    answer:
      'Customer tracking links (/track/:token) are strictly restricted and unauthenticated. To protect driver privacy and other clients, customers only see the live vehicle position on the final delivery leg towards their specific address. Full day routes, other delivery stops, internal notes, and driver private cell numbers are never exposed. Tracking automatically deactivates once the delivery is marked completed.'
  },
  {
    id: 'faq-5',
    question: 'What happens when a driver ends their shift or goes Off Duty?',
    category: 'drivers',
    categoryLabel: 'Drivers & Telemetry',
    answer:
      'Drivers control their duty status on their mobile app. When an active route is finished, a driver taps "End Duty". If any undelivered jobs remain on the route, Dispatra flags an operational exception for the dispatcher while respecting the driver’s device boundary. A driver’s GPS is not monitored while in Off-Duty state.'
  },
  {
    id: 'faq-6',
    question: 'What is the Proof of Delivery (POD) policy for unattended deliveries?',
    category: 'exceptions',
    categoryLabel: 'Exceptions & Delays',
    answer:
      'Unattended delivery is strictly forbidden unless explicitly enabled on the job booking ("Unattended Safe-Drop Allowed: Yes"). If enabled, drivers must capture a high-contrast photo of the parcel placed in a concealed, weather-sheltered location. For standard high-value or signature-required deliveries, physical recipient sign-off on glass is mandatory.'
  }
];

export const HelpSupportPage: React.FC<HelpSupportPageProps> = ({
  onBackToMonitor,
  onNotification
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>('faq-1');

  // Support ticket form state
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState('optimization');
  const [ticketUrgency, setTicketUrgency] = useState('normal');
  const [ticketMessage, setTicketMessage] = useState('');
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null);

  const filteredFaqs = FAQS.filter((faq) => {
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
    const matchesSearch =
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.categoryLabel.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleToggleFaq = (id: string) => {
    setExpandedFaqId((prev) => (prev === id ? null : id));
  };

  const handleSubmitTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketMessage.trim()) {
      onNotification?.('Please fill out the ticket subject and description');
      return;
    }

    const randomId = `TK-${Math.floor(1000 + Math.random() * 9000)}`;
    setSubmittedTicketId(randomId);
    setTicketSubject('');
    setTicketMessage('');
    onNotification?.(`Support ticket ${randomId} submitted to Dispatra Engineering`);
  };

  return (
    <div className="h-full w-full bg-slate-50 flex flex-col overflow-hidden font-sans">
      {/* HEADER BAR */}
      <header className="h-16 bg-white border-b border-slate-200/90 px-6 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBackToMonitor}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
            title="Return to Monitor Map"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>Back to Monitor</span>
          </button>

          <div className="h-4 w-px bg-slate-200" />

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600">
              <LifeBuoy className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900 leading-tight flex items-center gap-2">
                Help & Support
                <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full border border-slate-200">
                  Operations Desk
                </span>
              </h1>
              <p className="text-[11px] text-slate-500 leading-tight">
                Standard operating procedures, troubleshooting guides, and urgent dispatch escalation.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="tel:18005553477"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
          >
            <PhoneCall className="w-3.5 h-3.5 text-slate-500" />
            <span>Hotline: 1-800-555-DISP</span>
          </a>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* SYSTEM STATUS BANNER */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <div>
              <div className="text-xs font-semibold text-slate-900 flex items-center gap-2">
                <span>All Dispatra Systems Operational</span>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded-sm font-medium">
                  99.98% Uptime
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Route Optimizer • MapLibre Telemetry Sync • SMS Notifications • Public Tracking API
              </div>
            </div>
          </div>
          <span className="text-[11px] text-slate-400">
            Last checked: Live continuous
          </span>
        </div>

        {/* SEARCH & FILTER BAR */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search operational guides, dispatch rules, troubleshooting..."
              className="w-full pl-10 pr-4 py-2.5 text-xs text-slate-900 bg-white rounded-xl border border-slate-200/90 focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 shadow-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 px-1.5 py-0.5"
              >
                Clear
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {[
              { id: 'all', label: 'All Topics' },
              { id: 'optimization', label: 'Route Optimization' },
              { id: 'exceptions', label: 'Exceptions & Delays' },
              { id: 'fleet', label: 'Fleet & Capacities' },
              { id: 'tracking', label: 'Tracking & Privacy' },
              { id: 'drivers', label: 'Drivers & Telemetry' }
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* FAQS ACCORDION */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs divide-y divide-slate-100 overflow-hidden">
          <div className="p-4 bg-slate-50/60 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" />
              <span>Standard Operational Guides ({filteredFaqs.length})</span>
            </h2>
            <span className="text-[11px] text-slate-400">
              Click any question to expand
            </span>
          </div>

          {filteredFaqs.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <HelpCircle className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="text-xs font-medium text-slate-700">No matching articles found</div>
              <p className="text-[11px] text-slate-500">
                Try searching with different terms or submit a direct question to the dispatch desk below.
              </p>
            </div>
          ) : (
            filteredFaqs.map((faq) => {
              const isExpanded = expandedFaqId === faq.id;
              return (
                <div key={faq.id} className="transition-colors">
                  <button
                    type="button"
                    onClick={() => handleToggleFaq(faq.id)}
                    className="w-full px-5 py-4 text-left flex items-start justify-between gap-4 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200">
                          {faq.categoryLabel}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-slate-900">
                        {faq.question}
                      </div>
                    </div>
                    <div className="pt-1 text-slate-400">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-700" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-4 pt-1 text-xs text-slate-600 leading-relaxed bg-slate-50/40 border-t border-slate-50">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* KEYBOARD SHORTCUTS REFERENCE */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <Keyboard className="w-4 h-4 text-slate-600" />
            <h3 className="text-xs font-semibold text-slate-900">
              Monitor Keyboard Shortcuts
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
              <span className="text-slate-600 text-[11px]">Recenter Map</span>
              <kbd className="px-2 py-0.5 bg-white border border-slate-200 rounded-sm text-[10px] font-mono text-slate-800 shadow-2xs">
                M
              </kbd>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
              <span className="text-slate-600 text-[11px]">Close Overlay</span>
              <kbd className="px-2 py-0.5 bg-white border border-slate-200 rounded-sm text-[10px] font-mono text-slate-800 shadow-2xs">
                Esc
              </kbd>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
              <span className="text-slate-600 text-[11px]">Toggle Telemetry</span>
              <kbd className="px-2 py-0.5 bg-white border border-slate-200 rounded-sm text-[10px] font-mono text-slate-800 shadow-2xs">
                Space
              </kbd>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
              <span className="text-slate-600 text-[11px]">Quick Search</span>
              <kbd className="px-2 py-0.5 bg-white border border-slate-200 rounded-sm text-[10px] font-mono text-slate-800 shadow-2xs">
                /
              </kbd>
            </div>
          </div>
        </div>

        {/* SUBMIT SUPPORT TICKET FORM */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-2xs space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Submit a Dispatch Incident / Support Ticket
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Escalate technical issues or dispatch questions directly to Dispatra tier-2 engineering.
            </p>
          </div>

          {submittedTicketId && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="text-xs font-semibold text-emerald-900">
                  Ticket #{submittedTicketId} Registered
                </div>
                <p className="text-[11px] text-emerald-800">
                  Our operations engineer on duty has been notified. Expected response within 10 minutes.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmitTicket} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Category
                </label>
                <Select
                  aria-label="Ticket category"
                  className="w-full"
                  value={ticketCategory}
                  onValueChange={setTicketCategory}
                  options={[
                    { value: 'optimization', label: 'Route Optimizer / Proposal Anomaly' },
                    { value: 'telemetry', label: 'Driver App GPS / Telemetry Connectivity' },
                    { value: 'pricing', label: 'Services, Accessorials & Simulator' },
                    { value: 'tracking', label: 'Customer Tracking Link' },
                    { value: 'account', label: 'Account & Dispatch Permissions' }
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Urgency Level
                </label>
                <Select
                  aria-label="Urgency level"
                  className="w-full"
                  value={ticketUrgency}
                  onValueChange={setTicketUrgency}
                  options={[
                    { value: 'normal', label: 'Normal (Inquiry / Non-blocking)' },
                    { value: 'high', label: 'High (Active Delivery Delayed)' },
                    { value: 'urgent', label: 'Critical (Active Route Blocked)' }
                  ]}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Issue Summary / Subject
              </label>
              <input
                type="text"
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                placeholder="Brief summary of the dispatch anomaly or question"
                className="w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Detailed Description & Context
              </label>
              <textarea
                rows={4}
                value={ticketMessage}
                onChange={(e) => setTicketMessage(e.target.value)}
                placeholder="Include driver IDs, job numbers (#461), or specific error messages encountered..."
                className="w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-400">
                Logged under dispatcher session: Sarah K.
              </span>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-slate-900 hover:bg-black text-white rounded-lg transition-colors shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Ticket</span>
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};
