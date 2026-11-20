export type FeatureKey = 'user_registration';

export interface AdminFeature {
  key: FeatureKey | string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface PublicFeatureFlags {
  user_registration: boolean;
  [key: string]: boolean;
}
