import { Check, Mail, PackageCheck, Route, ScanLine, Truck } from 'lucide-react';

export const deliveryPreviewEvents = [
  { title: 'Order received from email', label: 'Receive', description: 'An incoming request becomes the start of a connected workflow.', actor: 'Email agent', time: '09:00', status: 'New', icon: Mail },
  { title: 'Order details prepared', label: 'Prepare', description: 'Pickup, delivery, and order details are brought together for review.', actor: 'Email agent', time: '09:01', status: 'New', icon: PackageCheck },
  { title: 'Eligible driver assigned', label: 'Dispatch', description: 'In Auto mode, eligible Ready Orders are matched with an available driver.', actor: 'Dispatch agent · Auto', time: '09:02', status: 'Assigned', icon: Route },
  { title: 'Pickup confirmed', label: 'Pick up', description: 'The driver works through the route and confirms the pickup.', actor: 'Driver', time: '09:18', status: 'In progress', icon: Truck },
  { title: 'Delivery proof captured', label: 'Capture proof', description: 'Delivery evidence stays connected to the order it belongs to.', actor: 'Driver', time: '09:42', status: 'In progress', icon: ScanLine },
  { title: 'Order completed', label: 'Complete', description: 'The completed order brings the team back to the same clear picture.', actor: 'Driver', time: '09:43', status: 'Completed', icon: Check },
] as const;
export type PreviewStageRequest = { index: number; request: number };
