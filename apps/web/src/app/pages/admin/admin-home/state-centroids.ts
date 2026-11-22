/** Approximate lat/lng centroids for heat layers (AU states + NZ regions). */

export interface StateCentroid {
  lat: number;
  lng: number;
}

const AU: Record<string, StateCentroid> = {
  NSW: { lat: -32.0, lng: 147.0 },
  VIC: { lat: -37.0, lng: 144.5 },
  QLD: { lat: -22.5, lng: 144.5 },
  WA: { lat: -25.5, lng: 122.0 },
  SA: { lat: -30.0, lng: 136.0 },
  TAS: { lat: -42.0, lng: 147.0 },
  ACT: { lat: -35.3, lng: 149.1 },
  NT: { lat: -19.5, lng: 133.0 },
};

const NZ: Record<string, StateCentroid> = {
  NTL: { lat: -35.5, lng: 174.3 },
  AUK: { lat: -36.85, lng: 174.76 },
  WKO: { lat: -37.9, lng: 175.5 },
  BOP: { lat: -37.7, lng: 176.3 },
  GIS: { lat: -38.66, lng: 178.02 },
  HKB: { lat: -39.6, lng: 176.8 },
  TKI: { lat: -39.3, lng: 174.3 },
  MWT: { lat: -39.9, lng: 175.5 },
  WGN: { lat: -41.3, lng: 174.8 },
  TAS: { lat: -41.5, lng: 172.6 },
  NSN: { lat: -41.3, lng: 173.2 },
  MBH: { lat: -41.5, lng: 173.7 },
  WTC: { lat: -42.4, lng: 171.7 },
  CAN: { lat: -43.5, lng: 171.6 },
  OTA: { lat: -45.0, lng: 170.0 },
  STL: { lat: -46.1, lng: 168.3 },
};

export function stateCentroid(countryCode: string, stateCode: string): StateCentroid | null {
  const country = countryCode.toUpperCase();
  const state = stateCode.toUpperCase();
  if (country === 'AU') {
    return AU[state] ?? null;
  }
  if (country === 'NZ') {
    return NZ[state] ?? null;
  }

  return null;
}
