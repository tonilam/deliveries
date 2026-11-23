export type CompanyType = 'customer' | 'provider' | 'broker';

export interface CompanyCountry {
  id: number;
  name: string;
  code: string;
}

export interface Company {
  id: number;
  country_id: number;
  company_type: CompanyType;
  company_type_label: string;
  parent_company_id: number | null;
  parent_business_name: string | null;
  blocked_root_company_types?: CompanyType[];
  country: CompanyCountry | null;
  has_addresses: boolean;
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

export interface CompanyDetailsPayload {
  company_type: CompanyType;
  country_id: number;
  reg_number: string;
  reg_type: string;
  business_name: string;
  phone: string;
  email: string;
  address: string;
  allowed_domains: string[];
}

export interface CompanyFinancePayload {
  invoicee_name: string;
  gst_rate: number;
  tracking_option: string | null;
}

export type CompanyPayload = CompanyDetailsPayload & CompanyFinancePayload;
