import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

export async function createPlaidLinkToken(countryCodes: string[]): Promise<string> {
  const fn = httpsCallable(functions, 'createLinkToken');
  const res = await fn({ countryCodes });
  return (res.data as { linkToken: string }).linkToken;
}

export async function exchangePlaidPublicToken(params: {
  publicToken: string;
  institutionName?: string;
  institutionId?: string;
  countryCode: string;
}): Promise<void> {
  const fn = httpsCallable(functions, 'exchangePublicToken');
  await fn(params);
}

export async function syncPlaidTransactions(): Promise<{ count: number }> {
  const fn = httpsCallable(functions, 'syncTransactions');
  const res = await fn({});
  return res.data as { count: number };
}
