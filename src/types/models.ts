export type CurrencyCode = string; // ISO 4217
export type CountryCode = string; // ISO 3166-1 alpha-2

export type TransactionSource = 'manual' | 'bank';
export type TransactionVisibility = 'private' | 'household';
export type BankProvider = 'plaid';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  householdId: string;
  locale: string;
  expoPushToken?: string | null;
  isPremium?: boolean;
  premiumSyncedAt?: number | null;
  notificationPrefs: {
    syncComplete: boolean;
    weeklyDigest: boolean;
    partnerInvite: boolean;
  };
  createdAt: number;
}

export interface Household {
  id: string;
  memberIds: string[];
  createdAt: number;
  countryCode: CountryCode;
  defaultCurrency: CurrencyCode;
  inviteCode?: string | null;
  inviteExpiresAt?: number | null;
}

export interface SharingPrefs {
  id: string;
  householdId: string;
  userId: string;
  shareTransactions: boolean;
  shareAccountIds: string[];
  displayNameInHousehold?: string | null;
}

export interface Category {
  id: string;
  householdId: string;
  nameKey: string;
  color: string;
  icon: string;
  sortOrder: number;
}

export interface Transaction {
  id: string;
  householdId: string;
  createdBy: string;
  amountMinor: number;
  currency: CurrencyCode;
  date: string; // YYYY-MM-DD
  merchant: string;
  categoryId: string;
  note?: string | null;
  source: TransactionSource;
  provider?: BankProvider | null;
  externalTxnId?: string | null;
  externalAccountId?: string | null;
  pending?: boolean;
  visibility: TransactionVisibility;
  createdAt: number;
  updatedAt: number;
}

export interface MerchantRule {
  id: string;
  userId: string;
  householdId?: string | null;
  merchantKey: string;
  categoryId: string;
  source: 'user_override' | 'heuristic';
  updatedAt: number;
}

export interface HouseholdInvite {
  id: string;
  householdId: string;
  createdBy: string;
  code: string;
  status: 'pending' | 'accepted' | 'revoked';
  createdAt: number;
  expiresAt: number;
}

export interface BankConnection {
  id: string;
  householdId: string;
  userId: string;
  provider: BankProvider;
  institutionName: string;
  institutionId?: string | null;
  countryCode: CountryCode;
  status: 'active' | 'error' | 'disconnected';
  lastSyncedAt?: number | null;
  accountIds: string[];
  errorMessage?: string | null;
}

export interface BankAccount {
  id: string;
  householdId: string;
  connectionId: string;
  provider: BankProvider;
  ownerUserId: string;
  name: string;
  mask?: string | null;
  type?: string | null;
  subtype?: string | null;
  currency: CurrencyCode;
  isHidden?: boolean;
}

export const DEFAULT_CATEGORIES: Omit<Category, 'id' | 'householdId'>[] = [
  { nameKey: 'food', color: '#c4b5a5', icon: 'fork.knife', sortOrder: 0 },
  { nameKey: 'home', color: '#a8b5a0', icon: 'house', sortOrder: 1 },
  { nameKey: 'transport', color: '#9aafbf', icon: 'car', sortOrder: 2 },
  { nameKey: 'shopping', color: '#b8a9b8', icon: 'bag', sortOrder: 3 },
  { nameKey: 'health', color: '#a9b8b0', icon: 'heart', sortOrder: 4 },
  { nameKey: 'fun', color: '#c4b89a', icon: 'sparkles', sortOrder: 5 },
  { nameKey: 'bills', color: '#a3a8b0', icon: 'doc.text', sortOrder: 6 },
  { nameKey: 'subscriptions', color: '#b0a8b8', icon: 'repeat', sortOrder: 7 },
  { nameKey: 'other', color: '#b0aea8', icon: 'circle', sortOrder: 8 },
];
