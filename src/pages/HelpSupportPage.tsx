import { Button } from '../components/ui/button';
import {
CheckCircle2,
ChevronDown,
ChevronUp,
FileText,
HelpCircle,
Keyboard,
PhoneCall,
Send
} from 'lucide-react';
import React,{ useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Select } from '../components/ui/Select';
import { SearchInput } from '../components/ui/SearchInput';
import { loadBillingConfig } from '../lib/billingStorage';
import { formatWeight, type Units } from '../lib/units';

interface HelpSupportPageProps {
  onNotification?: (msg: string) => void;
}

interface FAQItem {
  id: string;
  question: string;
  category: 'optimization' | 'drivers' | 'fleet' | 'tracking' | 'exceptions';
  categoryLabel: string;
  answer: string;
}

const getFAQs = (units: Units): FAQItem[] => [
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
      'When traffic bottlenecks, delayed loading, or driver slowdowns push expected delivery past the shipper promise window, Dispatra flags the job in the "Needs Attention" list. Dispatchers can click on the flagged job to view the recommended remedy (e.g., reassigning to an idle nearby driver). Approving the recommendation seamlessly updates the route ETA and alerts the driver. Drivers on duty receive updated stop orders on their mobile terminal.'
  },
  {
    id: 'faq-3',
    question: 'What are the vehicle capacity classes (1 Tonne to 5 Tonnes)?',
    category: 'fleet',
    categoryLabel: 'Fleet & Capacities',
    answer:
      `Dispatra categorizes local delivery fleet into four clear tonnage tiers: 1 Tonne (Courier Cargo Van, max ${formatWeight(1000, units)}, 2 standard skids), 2 Tonnes (Standard Sprinter/Cube, max ${formatWeight(2000, units)}, 4 skids), 3 Tonnes (Medium Box Truck with liftgate, max ${formatWeight(3500, units)}, 6 skids), and 5 Tonnes (Heavy Straight Truck, max ${formatWeight(5000, units)}, 10-12 skids). The system automatically blocks assignments if a shipment exceeds the vehicle payload or pallet limits.`
  },
  {
    id: 'faq-4',
    question: 'What shipper privacy safeguards are enforced on live tracking links?',
    category: 'tracking',
    categoryLabel: 'Tracking & Privacy',
    answer:
      'Shipper tracking links (/track/:token) are strictly restricted and unauthenticated. To protect driver privacy and other clients, shippers only see the live vehicle position on the final delivery leg towards their specific address. Full day routes, other delivery stops, internal notes, and driver private cell numbers are never exposed. Tracking automatically deactivates once the delivery is marked completed.'
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

  const filteredFaqs = getFAQs(loadBillingConfig().general).filter((faq) => {
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
    <div className="app-page app-page-reading h-full w-full flex flex-col overflow-hidden font-sans">
      {/* HEADER BAR */}
      <PageHeader title="Help & Support" description="Operational guides, troubleshooting and support." actions={<>
          <a
            href="tel:18005553477"
            className="app-action app-secondary"
          >
            <PhoneCall className="w-3.5 h-3.5 text-slate-500" />
            <span>Hotline: 1-800-555-DISP</span>
          </a>
      </>} />

      {/* MAIN CONTAINER */}
      <main className="page-content flex-1 overflow-y-auto py-6 space-y-6">
        {/* SYSTEM STATUS BANNER */}
        <div className="app-panel app-panel-plain flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <div>
              <div className="text-sm font-medium text-slate-900 flex flex-wrap items-center gap-2">
                <span>All Dispatra Systems Operational</span>
                <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded-sm font-medium">
                  99.98% Uptime
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Route Optimizer • MapLibre Telemetry Sync • SMS Notifications • Public Tracking API
              </div>
            </div>
          </div>
          <span className="text-xs text-slate-400">
            Last checked: Live continuous
          </span>
        </div>

        {/* SEARCH & TOPIC FILTER */}
        <div className="flex items-center gap-3">
          <SearchInput aria-label="Search help articles" placeholder="Search…"
            value={searchQuery} onChange={setSearchQuery} className="min-w-0 flex-1" />
          <Select aria-label="Help topic" value={selectedCategory} onValueChange={setSelectedCategory}
            align="end" className="w-36 sm:w-56 shrink-0" options={[
              { value: 'all', label: 'All Topics' },
              { value: 'optimization', label: 'Route Optimization' },
              { value: 'exceptions', label: 'Exceptions & Delays' },
              { value: 'fleet', label: 'Fleet & Capacities' },
              { value: 'tracking', label: 'Tracking & Privacy' },
              { value: 'drivers', label: 'Drivers & Telemetry' }
            ]} />
        </div>

        {/* FAQS ACCORDION */}
        <div className="app-panel app-panel-plain overflow-hidden">
          <div className="pb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="app-section-title text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" />
              <span>Standard Operational Guides ({filteredFaqs.length})</span>
            </h2>
            <span className="text-xs text-slate-400">
              Click any question to expand
            </span>
          </div>

          {filteredFaqs.length === 0 ? (
            <div className="py-6 text-center space-y-2">
              <HelpCircle className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="text-xs font-medium text-slate-700">No matching articles found</div>
              <p className="text-xs text-slate-500">
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
                    aria-expanded={isExpanded} aria-controls={`help-answer-${faq.id}`}
                    className="w-full py-4 text-left flex items-start justify-between gap-4 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200">
                          {faq.categoryLabel}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-slate-900">
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
                    <div id={`help-answer-${faq.id}`} className="pb-4 pt-1 text-sm text-slate-600 leading-relaxed">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* KEYBOARD SHORTCUTS REFERENCE */}
        <div className="app-panel app-panel-plain space-y-3">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-slate-600" />
            <h3 className="app-section-title text-slate-900">
              Monitor Keyboard Shortcuts
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-600 text-xs">Recenter Map</span>
              <kbd className="px-2 py-0.5 bg-white border border-slate-200 rounded-sm text-xs font-mono text-slate-800 shadow-2xs">
                M
              </kbd>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-600 text-xs">Close Overlay</span>
              <kbd className="px-2 py-0.5 bg-white border border-slate-200 rounded-sm text-xs font-mono text-slate-800 shadow-2xs">
                Esc
              </kbd>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-600 text-xs">Toggle Telemetry</span>
              <kbd className="px-2 py-0.5 bg-white border border-slate-200 rounded-sm text-xs font-mono text-slate-800 shadow-2xs">
                Space
              </kbd>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-600 text-xs">Quick Search</span>
              <kbd className="px-2 py-0.5 bg-white border border-slate-200 rounded-sm text-xs font-mono text-slate-800 shadow-2xs">
                /
              </kbd>
            </div>
          </div>
        </div>

        {/* SUBMIT SUPPORT TICKET FORM */}
        <div className="app-panel app-panel-plain space-y-5">
          <div className="space-y-1">
            <h3 className="app-section-title text-slate-900">
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
                <div className="text-xs font-medium text-emerald-900">
                  Ticket #{submittedTicketId} Registered
                </div>
                <p className="text-xs text-emerald-800">
                  Our operations engineer on duty has been notified. Expected response within 10 minutes.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmitTicket} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="app-label">
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
                    { value: 'pricing', label: 'Services, Accessorials & Pricing' },
                    { value: 'tracking', label: 'Shipper Tracking Link' },
                    { value: 'account', label: 'Account & Dispatch Permissions' }
                  ]}
                />
              </div>

              <div>
                <label className="app-label">
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
              <label className="app-label">
                Issue Summary / Subject
              </label>
              <input
                type="text"
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                placeholder="Brief summary of the dispatch anomaly or question"
                className="app-input w-full"
              />
            </div>

            <div>
              <label className="app-label">
                Detailed Description & Context
              </label>
              <textarea
                rows={4}
                value={ticketMessage}
                onChange={(e) => setTicketMessage(e.target.value)}
                placeholder="Include driver IDs, job numbers (#461), or specific error messages encountered..."
                className="app-input w-full resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-400">
                Logged under dispatcher session: Sarah K.
              </span>
              <Button
                type="submit"
                className="app-action app-primary flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-slate-900 hover:bg-black text-white rounded-full transition-colors shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Ticket</span>
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};
