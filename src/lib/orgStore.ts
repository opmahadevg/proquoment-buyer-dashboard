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

const STORAGE_KEY = 'proquoment_org';
const ORG_UPDATED_EVENT = 'proquoment_org_updated';

export const DEFAULT_ORG: StoredOrg = {
  name: "Honey's Org",
  legalName: "Honey Enterprises Pvt. Ltd.",
  type: "Private Limited Company",
  industry: "Textile & Apparel",
  founded: "2018",
  registrationNumber: "REG-2018-HE-04421",
  taxId: "GSTIN: 27AABCH1234F1Z5",
  website: "https://honeysorg.com",
  email: "contact@honeysorg.com",
  phone: "+91 98765 43210",
  street: "42, Industrial Estate, Phase II",
  city: "Mumbai",
  state: "Maharashtra",
  zip: "400072",
  country: "India",
  teamSize: "12–50 employees",
  description:
    "Honey's Org is a sourcing and procurement company specialising in home textiles, apparel, and agricultural commodities. We connect global buyers with verified manufacturers across South Asia.",
};

export function getStoredOrg(): StoredOrg {
  if (typeof window === 'undefined') return DEFAULT_ORG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredOrg>;
      return { ...DEFAULT_ORG, ...parsed };
    }
    return DEFAULT_ORG;
  } catch {
    return DEFAULT_ORG;
  }
}

export async function saveOrg(org: StoredOrg): Promise<void> {
  if (typeof window === 'undefined') return;

  // Always save to localStorage first for instant UI feedback
  localStorage.setItem(STORAGE_KEY, JSON.stringify(org));

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

export function onOrgUpdated(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(ORG_UPDATED_EVENT, callback);
  return () => window.removeEventListener(ORG_UPDATED_EVENT, callback);
}
