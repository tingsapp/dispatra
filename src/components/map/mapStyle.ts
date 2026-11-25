/** Operational maps keep streets, area names, parks and rail lines but drop Google's place and transit-station pins,
 * so stops, vehicles and routes are the only coloured marks (like the driver app). Styles apply only without a cloud Map ID. */
export const CLEAN_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit.station', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];
