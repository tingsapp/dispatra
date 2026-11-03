import { ArrowRight, ArrowUpRight, ChevronDown } from 'lucide-react';
import { faqs } from '../../pages/publicInformation';
import { Button } from '../ui/button';
const selectedQuestions = [7, 4, 0, 3, 2, 1];
export function HomeQuestions() {
  return <section id="home-questions" aria-labelledby="home-questions-title" className="home-section home-questions">
    <div className="home-question-intro"><p className="home-eyebrow">FAQs</p><h2 id="home-questions-title">Get to know Dispatra</h2><p>Your questions about automation, plans, and getting started, answered.</p><a href="/contact" className="home-text-link">Ask Dispatra<ArrowRight size={14} aria-hidden="true" /></a></div>
    <div className="home-faq-list">{selectedQuestions.map(index => <details key={faqs[index].question}><summary>{faqs[index].question}<ChevronDown size={16} aria-hidden="true" /></summary><p>{faqs[index].answer}</p></details>)}<a href="/help" className="home-text-link">See all FAQs<ArrowRight size={13} aria-hidden="true" /></a></div>
  </section>;
}
export function HomeClosing() {
  return <section aria-labelledby="home-closing-title" className="home-closing"><div className="home-section"><h2 id="home-closing-title">Put Dispatra to work</h2><p>Let Dispatra assign the orders and optimize the routes.<br />Keep your team focused on deliveries.</p><div className="home-closing-actions"><Button asChild className="hero-get-started"><a href="/plans"><span>Get Started</span><span className="hero-get-started-icon"><ArrowUpRight className="size-4" aria-hidden="true" /></span></a></Button></div></div></section>;
}
