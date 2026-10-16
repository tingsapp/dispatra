import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { MonitorPreview } from './MonitorPreview';
import { deliveryPreviewEvents, type PreviewStageRequest } from './deliveryPreviewData';

export function DeliveryDemo() {
  const [stage, setStage] = useState(0);
  const [request, setRequest] = useState<PreviewStageRequest>();
  return <section id="how-it-works" aria-labelledby="workflow-title" className="home-section home-demo">
    <div className="home-section-heading"><div><p className="home-eyebrow">From the first request to the final stop</p><h2 id="workflow-title">See a delivery day come together.</h2></div><p>Select a step to explore the workflow.<br />One order. One connected team.</p></div>
    <div className="home-demo-layout">
      <ol className="home-demo-steps" aria-label="Explore the sample order workflow">{deliveryPreviewEvents.map(({ label, description, icon: Icon }, index) => <li key={label}>
        <button type="button" className="home-demo-step" aria-label={`Step ${index + 1}: ${label}`} aria-describedby={stage === index ? `home-step-description-${index}` : undefined} aria-current={stage === index ? 'step' : undefined} aria-controls="home-demo-screen" onClick={() => setRequest(value => ({ index, request: (value?.request ?? 0) + 1 }))}>
          <span className="home-demo-step-icon"><Icon size={17} strokeWidth={1.5} aria-hidden="true" /></span><span className="home-demo-step-copy"><span className="home-demo-step-label"><span className="home-demo-number">0{index + 1}</span>{label}</span>{stage === index && <span id={`home-step-description-${index}`} className="home-demo-step-description">{description}</span>}</span><ChevronRight size={14} className="home-demo-chevron" aria-hidden="true" />
        </button>
      </li>)}</ol>
      <div id="home-demo-screen"><MonitorPreview onStageChange={setStage} requestedStage={request} /></div>
    </div>
    <p className="home-demo-control-note">Your team stays in control. Choose Manual assignment or let Auto dispatch eligible Ready Orders. Both optimize routes after assignment.</p>
  </section>;
}
