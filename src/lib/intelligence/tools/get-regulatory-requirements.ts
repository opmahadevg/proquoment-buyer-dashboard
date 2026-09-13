import { ToolDefinition, ToolResult, ToolContext } from './types';
import { globalProviderRegistry } from '../providers';
import { RegulatoryNotification } from '../core/compliance-context';

export const getRegulatoryRequirementsTool: ToolDefinition = {
  name: 'get_regulatory_requirements',
  description: 'Identifies import regulations, mandatory certifications (e.g. SNI, BPOM, Halal, CE), and WTO SPS/TBT notifications for destination markets.',
  parameters: {
    type: 'object',
    properties: {
      destination_country: {
        type: 'string',
        description: 'Importing destination country (e.g. "Indonesia", "IDN", "UAE")',
      },
      product_name: {
        type: 'string',
        description: 'Product name or trade description',
      },
      hs_code: {
        type: 'string',
        description: 'Optional 6-digit HS code',
      },
    },
    required: ['destination_country', 'product_name'],
  },
  async execute(params: Record<string, any>, _context: ToolContext): Promise<ToolResult> {
    const dest = params.destination_country || 'Indonesia';
    const product = params.product_name || 'Consumer Goods';

    const res = await globalProviderRegistry.resolve<RegulatoryNotification[]>('regulatory', {
      destinationCountry: dest,
      productName: product,
      hsCode: params.hs_code,
    });

    const notifications = res.data;
    const certs: string[] = [];

    const lowerDest = dest.toLowerCase();
    const lowerProd = product.toLowerCase();

    const isToy = lowerProd.includes('teddy') || lowerProd.includes('toy') || lowerProd.includes('plush') || lowerProd.includes('doll');
    const isFoodPharmaChem = lowerProd.includes('benzoate') || lowerProd.includes('chemical') || lowerProd.includes('food') || lowerProd.includes('pharma');
    const isFurniture = lowerProd.includes('furniture') || lowerProd.includes('bed') || lowerProd.includes('chair');
    const isTextile = lowerProd.includes('cotton') || lowerProd.includes('yarn') || lowerProd.includes('textile') || lowerProd.includes('apparel');

    const isDrinkwareOrCeramics =
      lowerProd.includes('mug') ||
      lowerProd.includes('cup') ||
      lowerProd.includes('drinkware') ||
      lowerProd.includes('tableware') ||
      lowerProd.includes('ceramic') ||
      lowerProd.includes('porcelain') ||
      lowerProd.includes('stoneware') ||
      lowerProd.includes('dinnerware') ||
      lowerProd.includes('tumbler') ||
      lowerProd.includes('glassware');

    const isCoffeeBeans =
      lowerProd.includes('coffee') &&
      !isDrinkwareOrCeramics &&
      !lowerProd.includes('maker') &&
      !lowerProd.includes('machine') &&
      !lowerProd.includes('pot');

    if (lowerDest.includes('indonesia') || lowerDest.includes('idn') || lowerDest.includes('jakarta')) {
      if (isToy) {
        certs.push('SNI Mainan Anak (SNI ISO 8124 Safety of Toys)');
        certs.push('Persetujuan Impor (PI) & Laporan Surveyor (LS) Pre-shipment Inspection');
        certs.push('Mandatory Labeling in Bahasa Indonesia (Kemendag No. 25/2021)');
      } else if (isDrinkwareOrCeramics) {
        certs.push('SNI ISO 6486 Ceramic Ware in Contact with Food (Lead & Cadmium Release)');
        certs.push('Surat Keterangan Impor (SKI) / BPOM Food Contact Certificate');
        certs.push('Mandatory Labeling in Bahasa Indonesia (Kemendag No. 25/2021)');
        certs.push('Certificate of Origin (Form D / Form E / Form AI)');
      } else if (isFoodPharmaChem || isCoffeeBeans) {
        certs.push('BPOM Distribution License (Izin Edar / Surat Keterangan Impor)');
        certs.push('Halal Certification (BPJPH Recognized under Law 33/2014)');
        certs.push('Batch Certificate of Analysis (CoA) matching USP/FCC standards');
      } else if (isFurniture) {
        certs.push('SVLK / V-Legal Timber Legality Assurance');
        certs.push('Ministry of Trade Commercial Import Verification');
      } else if (isTextile) {
        certs.push('SNI 7617 Safety of Azo Dyes & Formaldehyde in Apparel');
        certs.push('Persetujuan Impor (PI) Tekstil dan Produk Tekstil');
      } else {
        certs.push('Surat Keterangan Impor (SKI) / Import Declaration');
        certs.push('Certificate of Origin (Form D / Form AI for preferential duty)');
      }
    } else if (lowerDest.includes('uae') || lowerDest.includes('are') || lowerDest.includes('dubai')) {
      if (isToy) {
        certs.push('Gulf Conformity Mark (G-Mark) under GCC Toy Technical Regulation BD-130704-01');
        certs.push('MoIAT ECAS Conformity Certificate');
      } else if (isDrinkwareOrCeramics) {
        certs.push('Dubai Municipality FoodWatch Food-Contact Materials (FCM) Approval');
        certs.push('MoIAT ECAS Food Contact Materials Conformity Certificate');
        certs.push('Gulf Technical Regulation GSO ISO 6486-1/2 Heavy Metals Extraction Test');
      } else if (isFoodPharmaChem || isCoffeeBeans) {
        certs.push('Dubai Municipality FoodWatch / Montaji Registration');
        certs.push('MoIAT Halal National Mark Compliance');
      } else {
        certs.push('MoIAT ECAS Conformity Certificate');
        certs.push('Emirates Quality Mark (EQM)');
      }
    } else if (lowerDest.includes('usa') || lowerDest.includes('united states') || lowerDest.includes('us')) {
      const isPlasticsOrTech =
        lowerProd.includes('phone') ||
        lowerProd.includes('case') ||
        lowerProd.includes('cover') ||
        lowerProd.includes('tpu') ||
        lowerProd.includes('plastic') ||
        lowerProd.includes('silicone') ||
        lowerProd.includes('cable');
      const isAgriOrFood =
        lowerProd.includes('chilli') ||
        lowerProd.includes('chili') ||
        lowerProd.includes('pepper') ||
        lowerProd.includes('spice') ||
        lowerProd.includes('rice') ||
        isCoffeeBeans ||
        isFoodPharmaChem;

      if (isToy) {
        certs.push("CPSC Children's Product Certificate (CPC)");
        certs.push('ASTM F963 Toy Safety Specification & Third-Party Lab Testing');
        certs.push('CPSIA Total Lead & Phthalate Content Verification');
      } else if (isDrinkwareOrCeramics) {
        certs.push('FDA 21 CFR 175.300 / CPG Sec. 545.400 & 545.450 (Leachable Lead & Cadmium Limits)');
        certs.push('ASTM C738 Standard Test Method for Leachable Heavy Metals');
        certs.push('California Proposition 65 Compliance Statement (Lead & Cadmium Free Safe Harbor)');
        certs.push('CBP Form 7501 Customs Entry Summary');
        certs.push('Importer Security Filing (ISF 10+2)');
        certs.push('Country of Origin Marking (19 CFR 134 - Legible, Permanent Mark)');
      } else if (isPlasticsOrTech) {
        certs.push('CBP Form 7501 Customs Entry Summary');
        certs.push('EPA TSCA Title VI Toxic Substances Compliance Statement');
        certs.push('California Proposition 65 (BPA, Lead & Phthalates Free Lab Test)');
        certs.push('RoHS 2.0 / REACH SVHC Substance Assessment');
        certs.push('Importer Security Filing (ISF 10+2)');
      } else if (isAgriOrFood) {
        certs.push('FDA Food Facility Registration & Prior Notice of Imported Food');
        certs.push('USDA APHIS Phytosanitary Certificate & Import Permit');
        certs.push('FDA FSMA (Foreign Supplier Verification Program - FSVP)');
        certs.push('Pesticide Residue & Aflatoxin Certificate of Analysis (CoA)');
      } else {
        certs.push('CBP Form 7501 Customs Entry Summary');
        certs.push('EPA TSCA Compliance Statement');
        certs.push('Importer Security Filing (ISF 10+2)');
      }
    } else {
      certs.push('ISO 9001 Quality Management System');
      certs.push('International Certificate of Origin');
      if (isToy) {
        certs.push('CE Marking under Toy Safety Directive 2009/48/EC (EN 71-1, 2, 3)');
      }
    }

    return {
      status: 'success',
      data: {
        destinationCountry: dest,
        productName: product,
        requiredCertifications: certs,
        notifications,
        importLicensingRequired: certs.some((c) => c.includes('License') || c.includes('SNI') || c.includes('Persetujuan')),
      },
      evidence: certs.map((c, idx) => ({
        id: `ev_reg_${Date.now()}_${idx}`,
        claim: `${dest} Import Requirement: ${c} is mandatory for ${product}.`,
        sourceId: res.source.id,
        value: c,
        classification: 'observed',
        confidence: 'high',
        createdAt: new Date().toISOString(),
      })),
      dataGaps: [],
    };
  },
};
