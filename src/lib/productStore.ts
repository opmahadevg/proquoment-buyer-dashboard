'use client';

import { productService, rfqService } from '@/lib/services/dbService';

export interface StoredProduct {
  id: string;
  name: string;
  category: string;
  description: string;
  moq: string;
  specifications: { label: string; value: string; pending?: boolean }[];
  manufacturingNotes: { label: string; value: string; pending?: boolean }[];
  status: 'New Update';
  stage: 'Quoting';
  updated: string;
  image: string;
  imageAlt: string;
}

function storageKey(userId?: string): string {
  return userId ? `proquoment_products_${userId}` : 'proquoment_products';
}

// ── Local storage helpers (kept for offline/fallback) ──────────────────────

export function getStoredProducts(userId?: string): StoredProduct[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToLocalStorage(product: StoredProduct, userId?: string): void {
  if (typeof window === 'undefined') return;
  const existing = getStoredProducts(userId);
  const idx = existing.findIndex((p) => p.id === product.id);
  if (idx !== -1) {
    existing[idx] = product;
  } else {
    existing.unshift(product);
  }
  localStorage.setItem(storageKey(userId), JSON.stringify(existing));
}

// ── Main save function — persists to Supabase + localStorage ───────────────

export async function saveProduct(product: StoredProduct): Promise<void> {
  // Fetch user ID asynchronously from Supabase for local storage scoping
  let userId: string | undefined = undefined;
  try {
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id;
    }
  } catch (err) {
    console.warn('Failed to fetch user ID for saveProduct scoping:', err);
  }

  // Always save to localStorage as immediate fallback
  saveToLocalStorage(product, userId);

  // Dispatch event for any listeners
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('proquoment_products_updated'));
  }

  // Persist to Supabase
  try {
    await productService.save({
      id: product.id,
      name: product.name,
      category: product.category,
      description: product.description,
      moq: product.moq,
      image: product.image,
      imageAlt: product.imageAlt,
      stage: product.stage,
      status: product.status,
      updated: product.updated,
    });

    // Save RFQ specs separately
    await rfqService.save(product.id, product.specifications, product.manufacturingNotes);
  } catch (err) {
    console.error('Failed to save product to Supabase:', err);
    // localStorage already saved — graceful degradation
  }
}
