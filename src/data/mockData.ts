import { Driver, Job, NeedsAttentionItem, EligibleDriver } from '../types';

// Realistic Metro Vancouver GPS Road Coordinates [lat, lng]
export const VANCOUVER_CENTER: [number, number] = [49.2827, -123.1207];
export const TORONTO_CENTER: [number, number] = VANCOUVER_CENTER; // Backward compatibility

// Route 1 (Blue): YVR Vancouver International Airport -> Arthur Laing Bridge -> Granville St -> Downtown Vancouver Gastown
export const BLUE_ROUTE_WAYPOINTS: [number, number][] = [
  [49.1967, -123.1815], // YVR Air Cargo Terminal, Richmond
  [49.2010, -123.1610], // Grant McConachie Way
  [49.2075, -123.1420], // Arthur Laing Bridge
  [49.2155, -123.1400], // Granville St & SW Marine Dr
  [49.2280, -123.1400], // Granville St & 49th Ave
  [49.2395, -123.1395], // Granville St & 37th Ave
  [49.2520, -123.1390], // Granville St & 25th Ave
  [49.2635, -123.1385], // Granville St & W Broadway
  [49.2710, -123.1350], // Granville Bridge Approach
  [49.2770, -123.1290], // Granville Bridge over False Creek
  [49.2810, -123.1230], // Granville & Robson
  [49.2840, -123.1150], // Dunsmuir & Seymour
  [49.2855, -123.1110]  // 200 Water St, Gastown, Vancouver (Final Stop)
];

// Route 2 (Green): East Vancouver / Mount Pleasant / Commercial Drive Loop
export const GREEN_ROUTE_WAYPOINTS: [number, number][] = [
  [49.2815, -123.0690], // Hastings & Commercial Dr
  [49.2720, -123.0690], // Commercial Dr & 1st Ave
  [49.2625, -123.0690], // Commercial Dr & E Broadway
  [49.2600, -123.0900], // E Broadway & Fraser
  [49.2600, -123.1010], // Kingsway & Main St
  [49.2710, -123.1060], // Olympic Village / False Creek
  [49.2795, -123.0990], // Main & Keefer, Chinatown
  [49.2815, -123.0690]  // Loop back to Commercial Dr
];

// Route 3 (Orange): Kitsilano -> Burrard Bridge -> Mount Pleasant
export const ORANGE_ROUTE_WAYPOINTS: [number, number][] = [
  [49.2680, -123.1530], // Job #461 Pickup: 2105 W 4th Ave, Kitsilano
  [49.2685, -123.1380], // W 4th & Burrard
  [49.2760, -123.1310], // Burrard Bridge over False Creek
  [49.2790, -123.1250], // Pacific Blvd
  [49.2700, -123.0980]  // Job #452 Stop: 285 E 1st Ave, Mount Pleasant
];

// Metro Vancouver Major Traffic Corridors
export const TRAFFIC_CORRIDORS: {
  id: string;
  name: string;
  coords: [number, number][];
  status: 'flowing' | 'moderate' | 'congested';
}[] = [
  {
    id: 'lions-gate-causeway',
    name: 'Lions Gate Bridge & Stanley Park',
    coords: [
      [49.3130, -123.1420],
      [49.3030, -123.1380],
      [49.2930, -123.1360],
      [49.2880, -123.1310]
    ],
    status: 'congested'
  },
  {
    id: 'hwy-1-burnaby',
    name: 'Trans-Canada Hwy 1 (Cassiar / Burnaby)',
    coords: [
      [49.2810, -123.0240],
      [49.2700, -123.0180],
      [49.2580, -123.0020],
      [49.2510, -122.9850]
    ],
    status: 'flowing'
  },
  {
    id: 'granville-corridor',
    name: 'Granville Bridge Corridor',
    coords: [
      [49.2600, -123.1390],
      [49.2680, -123.1370],
      [49.2750, -123.1320],
      [49.2820, -123.1220]
    ],
    status: 'moderate'
  },
  {
    id: 'hwy-99-richmond',
    name: 'Hwy 99 / Oak St Bridge to Richmond',
    coords: [
      [49.2250, -123.1280],
      [49.2080, -123.1250],
      [49.1920, -123.1200],
      [49.1750, -123.1180]
    ],
    status: 'flowing'
  }
];

export const INITIAL_DRIVERS: Driver[] = [
  {
    id: 'D14',
    name: 'Arles Morgan',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    status: 'on_route',
    statusLabel: 'On route',
    vehicle: 'V12 (BC L2 ABC 123)',
    currentJob: '#452 - Delivery',
    nextStop: '200 Water St, Vancouver (Gastown)',
    eta: '11 min (5.8 km)',
    distance: '5.8 km',
    lastUpdate: 'Just now (Live)',
    phone: '(604) 555-0188',
    lat: 49.2635,
    lng: -123.1385,
    routeId: 'blue-route'
  },
  {
    id: 'D28',
    name: 'Marcus Vance',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    status: 'on_route',
    statusLabel: 'On route',
    vehicle: 'V08 (BC TRK 882)',
    currentJob: '#419 - Express',
    nextStop: 'E Broadway & Commercial Dr',
    eta: '7 min',
    distance: '3.4 km',
    lastUpdate: 'Just now (Live)',
    phone: '(604) 555-0142',
    lat: 49.2720,
    lng: -123.0690,
    routeId: 'green-route'
  },
  {
    id: 'D09',
    name: 'Maria Garcia',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    status: 'available',
    statusLabel: 'Available',
    vehicle: 'V14 (BC DISP 901)',
    nextStop: 'Olympic Village Staging Dock',
    eta: 'Available now',
    distance: '4.8 km',
    lastUpdate: '1 min ago',
    phone: '(604) 555-0199',
    lat: 49.2705,
    lng: -123.1150,
  },
  {
    id: 'D18',
    name: 'Sam Jenkins',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    status: 'available',
    statusLabel: 'Available',
    vehicle: 'V04 (BC FLT 319)',
    nextStop: 'Mount Pleasant Depot',
    eta: 'Available now',
    distance: '3.2 km',
    lastUpdate: '3 min ago',
    phone: '(604) 555-0163',
    lat: 49.2640,
    lng: -123.1040,
  },
  {
    id: 'D31',
    name: 'Chloe Bennett',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    status: 'available',
    statusLabel: 'Available',
    vehicle: 'V19 (BC VAN 442)',
    nextStop: 'Downtown Coal Harbour Hub',
    eta: 'Available now',
    distance: '2.1 km',
    lastUpdate: '5 min ago',
    phone: '(604) 555-0129',
    lat: 49.2890,
    lng: -123.1250,
  }
];

export const INITIAL_JOBS: Job[] = [
  {
    id: 'job-461',
    jobNumber: '#461',
    status: 'at_risk',
    statusLabel: 'At Risk',
    riskText: 'ETA: 22 min late',
    customerName: 'John Smith',
    customerPhone: '(604) 555-0123',
    pickupAddress: '2105 W 4th Ave, Kitsilano, Vancouver, BC',
    dropoffAddress: '285 E 1st Ave, Mount Pleasant, Vancouver, BC',
    scheduledTime: '10:00 AM – 12:00 AM',
    jobType: 'Standard Delivery',
    assignedDriverId: 'D14',
    stopsCount: 2,
    lat: 49.2680,
    lng: -123.1530,
    routeId: 'orange-route'
  },
  {
    id: 'job-452',
    jobNumber: '#452',
    status: 'late_start',
    statusLabel: 'Late Start',
    riskText: 'Start 15 min late',
    customerName: 'Elena Rostova',
    customerPhone: '(604) 555-0774',
    pickupAddress: '285 E 1st Ave, Mount Pleasant, Vancouver, BC',
    dropoffAddress: '800 Robson St, Vancouver, BC',
    scheduledTime: '10:30 AM – 12:30 PM',
    jobType: 'Priority Freight',
    stopsCount: 3,
    lat: 49.2700,
    lng: -123.0980,
    routeId: 'orange-route'
  },
  {
    id: 'job-439',
    jobNumber: '#439',
    status: 'no_driver',
    statusLabel: 'No Driver',
    riskText: 'Needs dispatch',
    customerName: 'Pacific Coast Health Clinics',
    customerPhone: '(604) 555-0322',
    pickupAddress: '1055 W Georgia St, Vancouver, BC',
    dropoffAddress: '1150 Station St, Vancouver, BC',
    scheduledTime: '11:00 AM – 01:00 PM',
    jobType: 'Medical Supplies',
    stopsCount: 1,
    lat: 49.2855,
    lng: -123.1215
  },
  {
    id: 'job-421',
    jobNumber: '#421',
    status: 'on_time',
    statusLabel: 'On Time',
    riskText: 'On schedule',
    customerName: 'Granville Island Artisans',
    customerPhone: '(604) 555-0911',
    pickupAddress: '1661 Duranleau St, Vancouver, BC',
    dropoffAddress: '555 Burrard St, Vancouver, BC',
    scheduledTime: '01:00 PM – 03:00 PM',
    jobType: 'Express Courier',
    assignedDriverId: 'D28',
    stopsCount: 2,
    lat: 49.2715,
    lng: -123.1340
  }
];

export const INITIAL_NEEDS_ATTENTION: NeedsAttentionItem[] = [
  {
    id: 'att-1',
    jobNumber: '#461',
    statusType: 'at_risk',
    statusLabel: 'At Risk',
    subtitle: 'ETA: 22 min late',
    pickupAddress: '2105 W 4th Ave, Kitsilano, Vancouver, BC',
    badgeColor: 'red',
    bulletColor: 'green'
  },
  {
    id: 'att-2',
    jobNumber: '#452',
    statusType: 'late_start',
    statusLabel: 'Late Start',
    subtitle: 'Start 15 min late',
    pickupAddress: '285 E 1st Ave, Mount Pleasant, Vancouver, BC',
    badgeColor: 'red',
    bulletColor: 'red'
  },
  {
    id: 'att-3',
    jobNumber: '#439',
    statusType: 'no_driver',
    statusLabel: 'No Driver',
    subtitle: 'Unassigned load',
    pickupAddress: '1055 W Georgia St, Vancouver, BC',
    badgeColor: 'amber',
    bulletColor: 'orange'
  }
];

export const ELIGIBLE_DRIVERS: EligibleDriver[] = [
  {
    id: 'D09',
    code: 'D09',
    name: 'Maria Garcia',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    distance: '4.8 km away (Olympic Village)',
    status: 'available',
    eta: '14 min improvement',
    selected: true
  },
  {
    id: 'D18',
    code: 'D18',
    name: 'Sam Jenkins',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    distance: '3.2 km away (Mount Pleasant)',
    status: 'available',
    eta: '11 min improvement',
    selected: false
  },
  {
    id: 'D31',
    code: 'D31',
    name: 'Chloe Bennett',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    distance: '2.1 km away (Coal Harbour)',
    status: 'available',
    eta: 'On schedule',
    selected: false
  },
  {
    id: 'D28',
    code: 'D28',
    name: 'Marcus Vance',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    distance: '6.5 km away (East Vancouver)',
    status: 'on_route',
    eta: '+6 min delay',
    selected: false
  }
];

