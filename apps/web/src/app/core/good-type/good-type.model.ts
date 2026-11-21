export interface GoodType {
  code: string;
  name: string;
  refrigerated_required: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface GoodTypePayload {
  code: string;
  name: string;
  refrigerated_required: boolean;
}

export interface GoodTypeUpdatePayload {
  name: string;
  refrigerated_required: boolean;
}
