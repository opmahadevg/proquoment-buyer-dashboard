'use client';

import { organizationService } from '@/lib/services/dbService';

export interface StoredOrg {
  name: string;
  legalName: string;
  type: string;
  industry: string;
  founded: string;
  registrationNumber: string;
  taxId: string;
  website: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  teamSize: string;
  description: string;
}

// Production default: completely blank — new buyers start fresh
export const DEFAULT_ORG: StoredOrg = {
  name: '',
  legalName: '',
  type: '',
  industry: '',
  founded: '',
  registrationNumber: '',
  taxId: '',
  website: '',
  email: '',
  phone: '',
  street: '',
  city: '',
  state: '',
  zip: '',
  country: '',
  teamSize: '',
  description: '',
};

const ORG_UPDATED_EVENT = 'proquoment_org_updated';

/** Returns the localStorage key scoped to a specific user ID */
function storageKey(userId: string): string {
  return `proquoment_org_${userId}`;
}

/**
 * Reads org from localStorage — scoped to userId so different buyers
 * never share cached profile data.
 */
export function getStoredOrg(userId?: string): StoredOrg {
  if (typeof window === 'undefined') return DEFAULT_ORG;
  if (!userId) return DEFAULT_ORG;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredOrg>;
      return { ...DEFAULT_ORG, ...parsed };
    }
    return DEFAULT_ORG;
  } catch {
    return DEFAULT_ORG;
  }
}

/**
 * Saves org to localStorage (scoped to userId) + Supabase.
 */
export async function saveOrg(org: StoredOrg, userId: string): Promise<void> {
  if (typeof window === 'undefined' || !userId) return;

  // Save to scoped localStorage key first (instant UI feedback)
  localStorage.setItem(storageKey(userId), JSON.stringify(org));

  // Notify all listeners
  window.dispatchEvent(new Event(ORG_UPDATED_EVENT));

  // Try to persist to Supabase (graceful fallback if not authenticated)
  try {
    const existing = await organizationService.get();
    if (existing?.id) {
      await organizationService.update({
        id: existing.id,
        name: org.name,
        legalName: org.legalName,
        orgType: org.type,
        industry: org.industry,
        founded: org.founded,
        registrationNumber: org.registrationNumber,
        taxId: org.taxId,
        website: org.website,
        email: org.email,
        phone: org.phone,
        street: org.street,
        city: org.city,
        state: org.state,
        zip: org.zip,
        country: org.country,
        teamSize: org.teamSize,
        description: org.description,
      });
    }
  } catch (err) {
    // localStorage already saved — graceful degradation
    console.error('Failed to save org to Supabase (localStorage fallback active):', err);
  }
}

/**
 * Clears all cached org data for a user — called on sign-out to prevent
 * the next user who logs in on the same browser from seeing stale data.
 */
export function clearStoredOrg(userId: string): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {
    // ignore
  }
}

export function onOrgUpdated(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(ORG_UPDATED_EVENT, callback);
  return () => window.removeEventListener(ORG_UPDATED_EVENT, callback);
}
