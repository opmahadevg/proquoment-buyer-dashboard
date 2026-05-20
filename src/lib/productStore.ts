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

const STORAGE_KEY = 'proquoment_products';

// ── Local storage helpers (kept for offline/fallback) ──────────────────────

export function getStoredProducts(): StoredProduct[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToLocalStorage(product: StoredProduct): void {
  if (typeof window === 'undefined') return;
  const existing = getStoredProducts();
  const idx = existing.findIndex((p) => p.id === product.id);
  if (idx !== -1) {
    existing[idx] = product;
  } else {
    existing.unshift(product);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

// ── Main save function — persists to Supabase + localStorage ───────────────

export async function saveProduct(product: StoredProduct): Promise<void> {
  // Always save to localStorage as immediate fallback
  saveToLocalStorage(product);

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
