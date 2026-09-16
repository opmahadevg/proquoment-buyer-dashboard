import * as cheerio from 'cheerio';
import { intelligenceCache } from '../cache';

export interface ScrapedDataPoint {
  title: string;
  sourceUrl: string;
  data: Record<string, any>;
  extractedAt: string;
}

export class WebIntelligenceScraper {
  private static instance: WebIntelligenceScraper;
  private lastDomainRequest = new Map<string, number>();

  static getInstance(): WebIntelligenceScraper {
    if (!WebIntelligenceScraper.instance) {
      WebIntelligenceScraper.instance = new WebIntelligenceScraper();
    }
    return WebIntelligenceScraper.instance;
  }

  private async enforceRateLimit(domain: string, minDelayMs = 1500): Promise<void> {
    const last = this.lastDomainRequest.get(domain) || 0;
    const now = Date.now();
    const diff = now - last;
    if (diff < minDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, minDelayMs - diff));
    }
    this.lastDomainRequest.set(domain, Date.now());
  }

  /**
   * Scrapes ITC Trade Map (trademap.org) for bilateral trade flow table
   */
  async scrapeTradeMap(hsCode: string, reporterISO: string): Promise<ScrapedDataPoint | null> {
    const cacheKey = `scrape_trademap_${reporterISO}_${hsCode}`;
    const cached = await intelligenceCache.get<ScrapedDataPoint>(cacheKey);
    if (cached) return cached.normalizedResponse;

    const url = `https://www.trademap.org/Product_SelProduct_TS.aspx?nvpm=1%7c${encodeURIComponent(reporterISO)}%7c%7c%7c%7c${encodeURIComponent(hsCode)}`;
    await this.enforceRateLimit('trademap.org');

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(6000),
      });

      if (!res.ok) return null;
      const html = await res.text();
      const $ = cheerio.load(html);

      const rows: Array<{ partner: string; valueUSD: number; quantity: number }> = [];
      $('table tr').each((_, el) => {
        const text = $(el).text();
        if (text && text.includes('$')) {
          const cells = $(el).find('td').map((__, td) => $(td).text().trim()).get();
          if (cells.length >= 3) {
            rows.push({
              partner: cells[0],
              valueUSD: parseFloat(cells[1].replace(/[^0-9.]/g, '')) || 0,
              quantity: parseFloat(cells[2].replace(/[^0-9.]/g, '')) || 0,
            });
          }
        }
      });

      const result: ScrapedDataPoint = {
        title: `ITC Trade Map - HS ${hsCode} Import Trade Data`,
        sourceUrl: url,
        data: { rows: rows.slice(0, 10) },
        extractedAt: new Date().toISOString(),
      };

      await intelligenceCache.set({
        capability: 'trade_flows',
        provider: 'ITC Trade Map Web Intelligence',
        params: { hsCode, reporterISO },
        normalizedResponse: result,
        source: {
          id: 'src_itc_trademap',
          name: 'ITC Trade Map',
          publisher: 'International Trade Centre',
          type: 'official',
          retrievedAt: new Date().toISOString(),
        },
      });

      return result;
    } catch {
      return null;
    }
  }

  /**
   * Scrapes OEKO-TEX label check to verify standard certification
   */
  async verifyOekoTexCert(certNumber: string): Promise<{ valid: boolean; statusText?: string } | null> {
    const cleanNum = certNumber.trim();
    if (!cleanNum) return null;

    const cacheKey = `scrape_oekotex_${cleanNum}`;
    const cached = await intelligenceCache.get<{ valid: boolean; statusText?: string }>(cacheKey);
    if (cached) return cached.normalizedResponse;

    const url = `https://www.oeko-tex.com/en/label-check`;
    await this.enforceRateLimit('oeko-tex.com');

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        body: new URLSearchParams({ number: cleanNum }),
        signal: AbortSignal.timeout(6000),
      });

      if (!res.ok) return null;
      const html = await res.text();
      const $ = cheerio.load(html);

      const isValid = !html.toLowerCase().includes('not found') && !html.toLowerCase().includes('invalid');
      const statusText = $('.result-text').text().trim() || (isValid ? 'Certificate verified in OEKO-TEX database' : 'Unconfirmed');

      const result = { valid: isValid, statusText };
      return result;
    } catch {
      return null;
    }
  }

  /**
   * Scrapes India DGFT public export statistics for HS code
   */
  async scrapeDGFTExportStats(hsCode: string): Promise<Record<string, any> | null> {
    const cacheKey = `scrape_dgft_${hsCode}`;
    const cached = await intelligenceCache.get<Record<string, any>>(cacheKey);
    if (cached) return cached.normalizedResponse;

    const url = `https://www.dgft.gov.in/CP/?opt=imex&code=${encodeURIComponent(hsCode)}`;
    await this.enforceRateLimit('dgft.gov.in');

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) return null;
      const html = await res.text();
      const $ = cheerio.load(html);

      const tables = $('table').length;
      return {
        found: tables > 0,
        hsCode,
        source: 'DGFT Export Intelligence Portal',
      };
    } catch {
      return null;
    }
  }
}

export const webIntelligenceScraper = WebIntelligenceScraper.getInstance();
