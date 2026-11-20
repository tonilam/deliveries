export interface Company {
  id: number;
  reg_number: string;
  reg_type: string;
  business_name: string;
  invoicee_name: string;
  gst_rate: number;
  tracking_option: string | null;
  phone: string;
  email: string;
  address: string;
  allowed_domains: string[];
  created_at: string;
  updated_at: string;
}

export type CompanyDetailsPayload = {
  reg_number: string;
  reg_type: string;
  business_name: string;
  phone: string;
  email: string;
  address: string;
  allowed_domains: string[];
};

export type CompanyFinancePayload = {
  invoicee_name: string;
  gst_rate: number;
  tracking_option: string | null;
};

export type CompanyPayload = CompanyDetailsPayload & CompanyFinancePayload;
