import { TrialOffer } from './TrialOffer';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { faqs } from '../../pages/publicInformation';
import { Button } from '../ui/button';
const selectedQuestions = [0, 4, 3, 5, 2, 1];
export function HomeQuestions() {
  return <section id="home-questions" aria-labelledby="home-questions-title" className="home-section home-questions">
    <div className="home-question-intro"><p className="home-eyebrow">A clear place to start</p><h2 id="home-questions-title">Good questions.<br />Straight answers.</h2><p>Getting your team moving starts with the right fit.</p><a href="/contact" className="home-text-link">Ask our team<ArrowRight size={14} aria-hidden="true" /></a></div>
    <div className="home-faq-list">{selectedQuestions.map(index => <details key={faqs[index].question}><summary>{faqs[index].question}<ChevronDown size={16} aria-hidden="true" /></summary><p>{faqs[index].answer}</p></details>)}<a href="/help" className="home-text-link">See all FAQs<ArrowRight size={13} aria-hidden="true" /></a></div>
  </section>;
}
export function HomeClosing() {
  return <TrialOffer>{offer => <section aria-labelledby="home-closing-title" className="home-closing"><div className="home-section"><p className="home-eyebrow">The next delivery day starts here</p><h2 id="home-closing-title">Bring your delivery day together.</h2><p>A connected workspace. A clearer path from order to completion.</p><div className="home-closing-actions"><Button asChild><a href="/plans">{offer.enabled ? 'Start free trial' : 'View plans'}<ArrowRight size={15} aria-hidden="true" /></a></Button><a href="/contact" className="home-text-link">Contact our team<ArrowRight size={14} aria-hidden="true" /></a></div><span className="home-trial-note">{offer.enabled ? `${offer.days} days to explore · No credit card required to start` : 'See current plans and trial availability'}</span></div></section>}</TrialOffer>;
}
