export interface ServiceType {
  id: number;
  name: string;
  monthly_fee: number;
  registration_fee: number;
  is_active: boolean;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: "superadmin" | "admin" | "user";
}

export interface Parent {
  id: number;
  parent_name: string;
  email: string | null;
  address: string | null;
  user_id: number | null;
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
  month: number;
  year: number;
  amount: number;
}

export interface PendingMonth {
  month: number;
  year: number;
  amount: number;
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

export interface OverdueEntry {
  child_id: number;
  child_name: string;
  parent_id: number;
  parent_name: string;
  monthly_fee: number;
  overdue_months: { month: number; year: number }[];
  overdue_count: number;
}
