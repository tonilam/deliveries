import { Country } from '../country/country.model';

export interface Zone {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
  country_id: number;
  country: Pick<Country, 'id' | 'name' | 'code'> | null;
}

export interface ZonePayload {
  name: string;
  code: string;
  country_id: number;
  is_active: boolean;
}
