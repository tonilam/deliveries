export interface CountryState {
  id: number;
  country_id: number;
  name: string;
  code: string;
  created_at: string;
  updated_at: string;
}

export interface Country {
  id: number;
  name: string;
  code: string;
  states: CountryState[];
  created_at: string;
  updated_at: string;
}

export interface CountryPayload {
  name: string;
  code: string;
}

export interface CountryStatePayload {
  name: string;
  code: string;
}
