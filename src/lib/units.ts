// Unit display helpers. Order facts and Rate Card rates are always stored in
// canonical SI units (km, kg, cm); the organization's display units only change
// how values are shown and entered.

import { OrganizationDefaults } from '../types/billing';

const KM_PER_MI = 1.609344;
const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

export type Units = Pick<OrganizationDefaults, 'distanceUnit' | 'weightUnit' | 'dimensionUnit'>;

export const toDisplayDistance = (km: number, u: Units): number =>
  u.distanceUnit === 'mi' ? km / KM_PER_MI : km;
export const fromDisplayDistance = (value: number, u: Units): number =>
  u.distanceUnit === 'mi' ? value * KM_PER_MI : value;

export const toDisplayWeight = (kg: number, u: Units): number =>
  u.weightUnit === 'lb' ? kg / KG_PER_LB : kg;
export const fromDisplayWeight = (value: number, u: Units): number =>
  u.weightUnit === 'lb' ? value * KG_PER_LB : value;

export const toDisplayDimension = (cm: number, u: Units): number =>
  u.dimensionUnit === 'in' ? cm / CM_PER_IN : cm;
export const fromDisplayDimension = (value: number, u: Units): number =>
  u.dimensionUnit === 'in' ? value * CM_PER_IN : value;

const trim = (n: number, digits = 1): string => {
  const rounded = Number(n.toFixed(digits));
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(digits);
};

export const formatDistance = (km: number, u: Units): string =>
  `${trim(toDisplayDistance(km, u))} ${u.distanceUnit}`;
export const formatWeight = (kg: number, u: Units): string =>
  `${trim(toDisplayWeight(kg, u))} ${u.weightUnit}`;
export const formatDimension = (cm: number, u: Units): string =>
  `${trim(toDisplayDimension(cm, u))} ${u.dimensionUnit}`;

/** "$1.50/km" or "$2.41/mi" — rate per canonical unit shown per display unit. */
export const formatDistanceRate = (perKm: number, u: Units): string =>
  `$${(u.distanceUnit === 'mi' ? perKm * KM_PER_MI : perKm).toFixed(2)}/${u.distanceUnit}`;
export const formatWeightRate = (perKg: number, u: Units): string =>
  `$${(u.weightUnit === 'lb' ? perKg * KG_PER_LB : perKg).toFixed(2)}/${u.weightUnit}`;
