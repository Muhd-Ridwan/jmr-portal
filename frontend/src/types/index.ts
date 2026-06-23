export interface ServiceType {
  id: number;
  name: string;
  description: string | null;
  monthly_fee: number;
  registration_fee: number;
  is_active: boolean;
  monthly_fee_override?: number | null;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: "superadmin" | "admin" | "user";
}

export interface StaffUser {
  id: number;
  name: string;
  email: string;
  phone_num: string | null;
  address: string | null;
  created_at: string;
  role: "superadmin" | "admin" | "user";
  is_parent: boolean;
  parent_id: number | null;
  needs_onboarding: boolean;
  parent_is_active: boolean | null;
}

export interface Parent {
  id: number;
  parent_name: string;
  email: string | null;
  address: string | null;
  user_id: number | null;
  is_active: boolean;
  created_at: string;
}

export interface PhoneNumber {
  id: number;
  parent_id: number;
  phone_num: string;
}

export interface Child {
  id: number;
  parent_id: number;
  name: string;
  dob: string | null;
  service_types: ServiceType[];
  monthly_fee: number;
  is_active: boolean;
  created_at: string;
  registration_paid?: boolean;
}

export interface ParentDetail extends Parent {
  phone_numbers: PhoneNumber[];
  children: Child[];
}

export interface PaymentSession {
  id: number;
  parent_id: number;
  total_amount: number;
  payment_method: "cash" | "bank_transfer" | "online";
  notes: string | null;
  receipt_key: string | null;
  paid_at: string;
  created_by: number;
  recorded_by: string;
  created_at: string;
  fee_payments: FeePayment[];
}

export interface FeePayment {
  id: number;
  session_id: number;
  child_id: number;
  child_name: string;
  service_type_id: number;
  month: number;
  year: number;
  amount: number;
}

export interface PendingService {
  service_type_id: number;
  name: string;
  amount: number;
  paid: boolean;
}

export interface PendingMonth {
  month: number;
  year: number;
  services: PendingService[];
}

export interface PartialPaymentEntry {
  child_id: number;
  child_name: string;
  parent_id: number;
  parent_name: string;
  partial_months: PendingMonth[];
}

export interface RegistrationPaymentRecord {
  id: number;
  child_id: number;
  child_name: string;
  amount: number;
  payment_method: "cash" | "bank_transfer" | "online";
  paid_at: string;
  recorded_by: string;
}

export interface PendingPayments {
  child_id: number;
  child_name: string;
  registration_paid: boolean;
  registration_payment: RegistrationPaymentRecord | null;
  pending_months: PendingMonth[];
}

export interface PaymentHistory {
  sessions: PaymentSession[];
  registration_payments: RegistrationPaymentRecord[];
}

export interface UnregisteredChild {
  child_id: number;
  child_name: string;
  parent_id: number;
  parent_name: string;
  registration_fee: number;
}

export interface ReportMonth {
  month: number;
  year: number;
  amount: number;
  paid: boolean;
  paid_at: string | null;
  session_id: number | null;
  receipt_key: string | null;
}

export interface ReportChild {
  child_id: number;
  child_name: string;
  is_active: boolean;
  monthly_fee: number;
  service_names: string[];
  registration: {
    paid: boolean;
    amount: number | null;
    paid_at: string | null;
    payment_method: string | null;
  };
  months: ReportMonth[];
}

export interface ReportParent {
  parent_id: number;
  parent_name: string;
  is_active: boolean;
  children: ReportChild[];
}

export interface OverdueEntry {
  child_id: number;
  child_name: string;
  parent_id: number;
  parent_name: string;
  monthly_fee: number;
  overdue_months: { month: number; year: number }[];
  overdue_count: number;
  registration_pending: boolean;
}
