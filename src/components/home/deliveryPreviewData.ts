import { Check, Mail, PackageCheck, Route, ScanLine, Truck } from 'lucide-react';

export const deliveryPreviewEvents = [
  { title: 'Order received from email', label: 'Receive', description: 'The email agent reads an incoming order request.', actor: 'Email agent', time: '09:00', status: 'New', icon: Mail },
  { title: 'Order details prepared', label: 'Prepare', description: 'The email agent prepares pickup, delivery, and order details for review.', actor: 'Email agent', time: '09:01', status: 'New', icon: PackageCheck },
  { title: 'Eligible driver assigned', label: 'Dispatch', description: 'Dispatra automatically assigns ready orders to eligible drivers, then optimizes routes.', actor: 'Dispatch agent · Auto', time: '09:02', status: 'Assigned', icon: Route },
  { title: 'Pickup confirmed', label: 'Pick up', description: 'The driver works through the route and confirms the pickup.', actor: 'Driver', time: '09:18', status: 'In progress', icon: Truck },
  { title: 'Delivery proof captured', label: 'Capture proof', description: 'The driver captures delivery proof against the assigned order.', actor: 'Driver', time: '09:42', status: 'In progress', icon: ScanLine },
  { title: 'Order completed', label: 'Complete', description: 'Submitted delivery proof completes the order and updates its progress.', actor: 'Driver', time: '09:43', status: 'Completed', icon: Check },
] as const;
export type PreviewStageRequest = { index: number; request: number };
