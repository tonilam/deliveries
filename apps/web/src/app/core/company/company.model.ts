export interface Company {
  id: number;
  reg_number: string;
  reg_type: string;
  business_name: string;
  invoicee_name: string;
  phone: string;
  email: string;
  address: string;
  allowed_domains: string[];
  created_at: string;
  updated_at: string;
}

export type CompanyPayload = {
  reg_number: string;
  reg_type: string;
  business_name: string;
  invoicee_name: string;
  phone: string;
  email: string;
  address: string;
  allowed_domains: string[];
};
