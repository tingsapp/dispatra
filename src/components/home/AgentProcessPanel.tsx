import { Bot, Route, Truck } from 'lucide-react';
import { DriverComparison, OrderIntake, RouteComparison, SignedDelivery } from './AgentProcessScenes';

export const agentProcessSteps = [
  { label: 'Order agent', subtitle: 'Reads & prepares', icon: Bot, description: 'Brings incoming requests into Dispatra’s order format and prepares the details for the next step.' },
  { label: 'Dispatch agent', subtitle: 'Checks & assigns', icon: Bot, description: 'Weighs availability, vehicle fit, and pickup distance to select the best eligible match in Auto mode.' },
  { label: 'Route optimizer', subtitle: 'Find the best path', icon: Route, description: 'Compares feasible routes after assignment and chooses an efficient path between the stops.' },
  { label: 'Driver', subtitle: 'Delivers & confirms', icon: Truck, description: 'The driver captures the signature and required proof, bringing the delivery through to completion.' },
] as const;
const scenes = [OrderIntake, DriverComparison, RouteComparison, SignedDelivery];

export function AgentProcessPanel({ stage }: { stage: number }) {
  const current = agentProcessSteps[stage];
  const Scene = scenes[stage];
  return <div className="agent-process-panel">
    <div className="agent-process-intro"><p>{current.description}</p></div>
    <Scene />
  </div>;
}
