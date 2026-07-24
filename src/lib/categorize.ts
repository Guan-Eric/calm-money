/** Normalize merchant strings for memory matching. */
export function normalizeMerchantKey(merchant: string): string {
  return merchant
    .toUpperCase()
    .replace(/#\d+/g, ' ')
    .replace(/\bSTORE\b/g, ' ')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Keyword heuristics → category nameKey */
export const MERCHANT_HEURISTICS: { pattern: RegExp; nameKey: string }[] = [
  { pattern: /\bUBER\b|\bLYFT\b|\bBOLT\b|\bGRAB\b/, nameKey: 'transport' },
  { pattern: /\bSHELL\b|\bBP\b|\bCHEVRON\b|\bEXXON\b|\bPETRO\b/, nameKey: 'transport' },
  { pattern: /\bNETFLIX\b|\bSPOTIFY\b|\bDISNEY\b|\bHULU\b|\bAPPLE\.COM\/BILL\b/, nameKey: 'subscriptions' },
  { pattern: /\bSTARBUCKS\b|\bCOFFEE\b|\bCAFE\b|\bMCDONALD\b|\bCHIPOTLE\b/, nameKey: 'food' },
  { pattern: /\bWHOLE\s*FDS\b|\bTRADER\s*JOE\b|\bCOSTCO\b|\bWALMART\b|\bTESCO\b|\bSAINSBURY\b/, nameKey: 'food' },
  { pattern: /\bPHARMACY\b|\bCVS\b|\bWALGREENS\b|\bBOOTS\b/, nameKey: 'health' },
  { pattern: /\bAMAZON\b|\bTARGET\b|\bIKEA\b/, nameKey: 'shopping' },
  { pattern: /\bRENT\b|\bLANDLORD\b|\bMORTGAGE\b/, nameKey: 'home' },
  { pattern: /\bELECTRIC\b|\bWATER\b|\bINTERNET\b|\bCOMCAST\b|\bVERIZON\b/, nameKey: 'bills' },
];

/** Plaid personal_finance_category primary → nameKey */
export const PLAID_CATEGORY_MAP: Record<string, string> = {
  FOOD_AND_DRINK: 'food',
  TRANSPORTATION: 'transport',
  TRAVEL: 'transport',
  RENT_AND_UTILITIES: 'bills',
  HOME_IMPROVEMENT: 'home',
  MEDICAL: 'health',
  PERSONAL_CARE: 'health',
  ENTERTAINMENT: 'fun',
  GENERAL_MERCHANDISE: 'shopping',
  GENERAL_SERVICES: 'other',
  GOVERNMENT_AND_NON_PROFIT: 'other',
  INCOME: 'other',
  LOAN_PAYMENTS: 'bills',
  BANK_FEES: 'bills',
  TRANSFER_IN: 'other',
  TRANSFER_OUT: 'other',
};

export type CategorizeInput = {
  merchant: string;
  providerCategoryPrimary?: string | null;
  merchantRuleCategoryId?: string | null;
  categoriesByNameKey: Record<string, string>; // nameKey → categoryId
};

export function categorizeTransaction(input: CategorizeInput): string {
  const { merchant, providerCategoryPrimary, merchantRuleCategoryId, categoriesByNameKey } = input;
  const otherId = categoriesByNameKey.other;

  if (merchantRuleCategoryId) {
    return merchantRuleCategoryId;
  }

  const key = normalizeMerchantKey(merchant);
  for (const h of MERCHANT_HEURISTICS) {
    if (h.pattern.test(key) && categoriesByNameKey[h.nameKey]) {
      return categoriesByNameKey[h.nameKey];
    }
  }

  if (providerCategoryPrimary) {
    const mapped = PLAID_CATEGORY_MAP[providerCategoryPrimary];
    if (mapped && categoriesByNameKey[mapped]) {
      return categoriesByNameKey[mapped];
    }
  }

  return otherId ?? Object.values(categoriesByNameKey)[0] ?? '';
}
