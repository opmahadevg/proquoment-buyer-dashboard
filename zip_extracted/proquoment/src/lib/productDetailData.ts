// Central data store for all product detail tab content

export interface UpdateTask {
  id: string;
  type: 'Action' | 'Info';
  title: string;
  description: string;
  date: string;
  supplier: string;
  replies: number;
}

export interface UpdateItem {
  id: string;
  title: string;
  description: string;
  date: string;
  supplier: string;
  replies: number;
}

export interface QuoteStep {
  id: number;
  label: string;
  highlight: string | null;
  highlightSuffix: string | null;
  description: string;
  status: 'completed' | 'active' | 'pending';
  inProgress: boolean;
}

export interface Order {
  id: string;
  orderNumber: string;
  description: string;
  status: string;
  statusColor: string;
  supplier: string;
  placedDate: string;
  estimatedDelivery: string;
  amount: string;
}

export interface OrderStep {
  id: string;
  label: string;
  done: boolean;
}

export interface ProductFile {
  id: string;
  name: string;
  date: string;
}

export interface SampleItem {
  id: string;
  image: string;
  imageAlt: string;
  name: string;
  type: string;
  supplier: string;
  stage: string;
  requested: string;
  completion: string;
}

export interface ReferenceItem {
  id: string;
  image: string;
  imageAlt: string;
  name: string;
  type: string;
  creator: string;
  stage: string;
  requested: string;
}

export interface ProductDetailData {
  id: string;
  name: string;
  image: string;
  imageAlt: string;
  stage: 'Quoting' | 'Draft' | 'Sampling' | 'Production' | 'Completed';
  updates: {
    tasks: UpdateTask[];
    updates: UpdateItem[];
  };
  quotes: {
    steps: QuoteStep[];
    supplierCount: number;
    totalSuppliers: number;
  };
  orders: {
    orders: Order[];
    steps: OrderStep[];
  };
  files: ProductFile[];
  samples: {
    samples: SampleItem[];
    references: ReferenceItem[];
  };
}

export const ALL_PRODUCT_DETAIL_DATA: Record<string, ProductDetailData> = {
  'prod-001': {
    id: 'prod-001',
    name: 'Black Puffed Jackets',
    image: "https://images.unsplash.com/photo-1724961222782-c86c1e8e9300",
    imageAlt: 'Black puffed winter jacket close-up product thumbnail',
    stage: 'Quoting',
    updates: {
      tasks: [
      {
        id: 'task-001',
        type: 'Action',
        title: 'Book A Call - Start Sourcing with Cavela',
        description:
        "We'd be glad to discuss your Black Puffed Jackets project. Please book a call and we'll walk through the next steps together.",
        date: 'Apr 20, 2026',
        supplier: 'All suppliers',
        replies: 0
      }],

      updates: []
    },
    quotes: {
      supplierCount: 185,
      totalSuppliers: 208201,
      steps: [
      {
        id: 1,
        label: 'Identified matches',
        highlight: '185',
        highlightSuffix: ' best matches out of 208,201 suppliers',
        description: 'We search for suppliers that match your exact product requirement and location.',
        status: 'completed',
        inProgress: false
      },
      {
        id: 2,
        label: 'Reaching out to suppliers',
        highlight: '185',
        highlightSuffix: ' suppliers',
        description: 'We share your product info with matched suppliers to understand their interest.',
        status: 'active',
        inProgress: true
      },
      {
        id: 3,
        label: 'Engage suppliers',
        highlight: null,
        highlightSuffix: null,
        description: 'We communicate with interested suppliers to verify their terms to prep for quotes.',
        status: 'pending',
        inProgress: false
      },
      {
        id: 4,
        label: 'Receive quotes',
        highlight: null,
        highlightSuffix: null,
        description: 'We receive detailed quote that is ready for you to select.',
        status: 'pending',
        inProgress: false
      }]

    },
    orders: {
      orders: [
      {
        id: 'order-001',
        orderNumber: 'PQ-2026-0041',
        description: 'Pre-production sample — 1 unit',
        status: 'In Production',
        statusColor: 'text-amber-600 bg-amber-50',
        supplier: 'Aftab A.',
        placedDate: 'Apr 30, 2026',
        estimatedDelivery: 'Jun 5–19, 2026',
        amount: '$250.00'
      }],

      steps: [
      { id: 'step-1', label: 'Order Placed', done: true },
      { id: 'step-2', label: 'Sample in Production', done: true },
      { id: 'step-3', label: 'Quality Check', done: false },
      { id: 'step-4', label: 'Shipped', done: false },
      { id: 'step-5', label: 'Delivered', done: false }]

    },
    files: [
    { id: 'file-001', name: 'Black-Puffed-Jacket-RFQ-Spec-Sheet.pdf', date: 'Apr 30, 2026' },
    { id: 'file-002', name: 'Black-Puffed-Jacket-Sample-Photos.zip', date: 'Apr 28, 2026' },
    { id: 'file-003', name: 'Black-Puffed-Jacket-Tech-Pack-v2.pdf', date: 'Apr 25, 2026' },
    { id: 'file-004', name: 'Black-Puffed-Jacket-Supplier-Comparison.xlsx', date: 'Apr 20, 2026' }],

    samples: {
      samples: [
      {
        id: 'smp-001',
        image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1ba13e73e-1772184110682.png',
        imageAlt: 'Black puffed jacket pre-production sample front view',
        name: 'Black Puffed Jacket — Pre-Production Sample',
        type: 'Pre-Production',
        supplier: 'Aftab A.',
        stage: 'In Review',
        requested: 'Apr 30, 2026',
        completion: 'Jun 5, 2026'
      },
      {
        id: 'smp-002',
        image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1ba13e73e-1772184110682.png',
        imageAlt: 'Black puffed jacket prototype with zipper detail',
        name: 'Jacket Prototype — Zipper & Lining Test',
        type: 'Prototype',
        supplier: 'SinoGarment Co.',
        stage: 'Pending',
        requested: 'May 2, 2026',
        completion: 'Jun 15, 2026'
      }],

      references: [
      {
        id: 'ref-001',
        image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1ba13e73e-1772184110682.png',
        imageAlt: 'Reference image of black puffer jacket from brand catalog',
        name: 'Brand Reference — Winter Puffer Style',
        type: 'Brand Reference',
        creator: 'Design Team',
        stage: 'Approved',
        requested: 'Apr 18, 2026'
      }]

    }
  },

  'prod-002': {
    id: 'prod-002',
    name: 'Cotton AC Blankets Bulk Pack 2000 Pieces',
    image: "https://img.rocket.new/generatedImages/rocket_gen_img_15d71d19c-1777719475623.png",
    imageAlt: 'Stack of cotton blankets in bulk packaging',
    stage: 'Quoting',
    updates: {
      tasks: [
      {
        id: 'task-002',
        type: 'Action',
        title: 'Book A Call - Start Sourcing with Cavela',
        description:
        "We'd be glad to discuss your Cotton AC Blankets Bulk Pack 2000 Pieces project. Please book a call and we'll walk through the next steps together.",
        date: 'Apr 20, 2026',
        supplier: 'All suppliers',
        replies: 0
      },
      {
        id: 'task-003',
        type: 'Action',
        title: 'Confirm Fabric Weight & GSM Specification',
        description:
        'We need you to confirm the GSM (grams per square meter) for the cotton blankets. Suppliers are asking for this to provide accurate pricing.',
        date: 'Apr 18, 2026',
        supplier: 'All suppliers',
        replies: 2
      }],

      updates: [
      {
        id: 'upd-001',
        title: 'Supplier Outreach Initiated',
        description:
        '142 suppliers have been contacted regarding your Cotton AC Blankets bulk order. We expect initial responses within 3–5 business days.',
        date: 'Apr 15, 2026',
        supplier: 'Cavela Team',
        replies: 0
      }]

    },
    quotes: {
      supplierCount: 142,
      totalSuppliers: 195430,
      steps: [
      {
        id: 1,
        label: 'Identified matches',
        highlight: '142',
        highlightSuffix: ' best matches out of 195,430 suppliers',
        description: 'We search for suppliers that match your exact product requirement and location.',
        status: 'completed',
        inProgress: false
      },
      {
        id: 2,
        label: 'Reaching out to suppliers',
        highlight: '142',
        highlightSuffix: ' suppliers',
        description: 'We share your product info with matched suppliers to understand their interest.',
        status: 'active',
        inProgress: true
      },
      {
        id: 3,
        label: 'Engage suppliers',
        highlight: null,
        highlightSuffix: null,
        description: 'We communicate with interested suppliers to verify their terms to prep for quotes.',
        status: 'pending',
        inProgress: false
      },
      {
        id: 4,
        label: 'Receive quotes',
        highlight: null,
        highlightSuffix: null,
        description: 'We receive detailed quote that is ready for you to select.',
        status: 'pending',
        inProgress: false
      }]

    },
    orders: {
      orders: [
      {
        id: 'order-002',
        orderNumber: 'PQ-2026-0038',
        description: 'Pre-production sample — 5 units',
        status: 'Quality Check',
        statusColor: 'text-blue-600 bg-blue-50',
        supplier: 'Ravi Textiles',
        placedDate: 'Apr 22, 2026',
        estimatedDelivery: 'May 28–Jun 10, 2026',
        amount: '$180.00'
      }],

      steps: [
      { id: 'step-1', label: 'Order Placed', done: true },
      { id: 'step-2', label: 'Sample in Production', done: true },
      { id: 'step-3', label: 'Quality Check', done: true },
      { id: 'step-4', label: 'Shipped', done: false },
      { id: 'step-5', label: 'Delivered', done: false }]

    },
    files: [
    { id: 'file-005', name: 'Cotton-Blankets-RFQ-Specification.pdf', date: 'Apr 22, 2026' },
    { id: 'file-006', name: 'Cotton-Blankets-Fabric-Swatch-Reference.jpg', date: 'Apr 19, 2026' },
    { id: 'file-007', name: 'Cotton-Blankets-Packaging-Requirements.pdf', date: 'Apr 17, 2026' },
    { id: 'file-008', name: 'Cotton-Blankets-Supplier-Shortlist.xlsx', date: 'Apr 15, 2026' }],

    samples: {
      samples: [
      {
        id: 'smp-003',
        image: "https://img.rocket.new/generatedImages/rocket_gen_img_10a7580e1-1772222839735.png",
        imageAlt: 'Cotton AC blanket fabric swatch showing weave texture',
        name: 'Cotton Blanket — Fabric Swatch 200 GSM',
        type: 'Fabric Swatch',
        supplier: 'Ravi Textiles',
        stage: 'Approved',
        requested: 'Apr 10, 2026',
        completion: 'Apr 22, 2026'
      },
      {
        id: 'smp-004',
        image: "https://img.rocket.new/generatedImages/rocket_gen_img_1aeaff2ca-1777719476038.png",
        imageAlt: 'Cotton AC blanket pre-production sample folded',
        name: 'Blanket Pre-Production Sample — 5 pcs',
        type: 'Pre-Production',
        supplier: 'Ravi Textiles',
        stage: 'In Review',
        requested: 'Apr 22, 2026',
        completion: 'May 28, 2026'
      }],

      references: [
      {
        id: 'ref-002',
        image: "https://img.rocket.new/generatedImages/rocket_gen_img_134c59208-1777719475319.png",
        imageAlt: 'Reference cotton blanket from competitor catalog showing desired quality',
        name: 'Competitor Reference — AC Blanket Quality',
        type: 'Market Reference',
        creator: 'Sourcing Team',
        stage: 'Approved',
        requested: 'Apr 5, 2026'
      },
      {
        id: 'ref-003',
        image: "https://img.rocket.new/generatedImages/rocket_gen_img_14def5fc7-1777719478936.png",
        imageAlt: 'Packaging reference showing bulk blanket packaging standard',
        name: 'Packaging Reference — Bulk Poly Bag',
        type: 'Packaging Reference',
        creator: 'Design Team',
        stage: 'Pending',
        requested: 'Apr 8, 2026'
      }]

    }
  },

  'prod-003': {
    id: 'prod-003',
    name: 'King Size Plain White Cotton Bed Sheets',
    image: "https://img.rocket.new/generatedImages/rocket_gen_img_13ce60e62-1767442220792.png",
    imageAlt: 'White cotton bed sheets neatly folded on white background',
    stage: 'Quoting',
    updates: {
      tasks: [
      {
        id: 'task-004',
        type: 'Action',
        title: 'Approve Sample from Sunrise Textiles',
        description:
        'A sample of the King Size Plain White Cotton Bed Sheets has been prepared by Sunrise Textiles. Please review the attached photos and confirm approval to proceed.',
        date: 'Mar 19, 2026',
        supplier: 'Sunrise Textiles',
        replies: 1
      }],

      updates: [
      {
        id: 'upd-002',
        title: '3 Quotes Received — Review Ready',
        description:
        'We have received 3 competitive quotes for your King Size Plain White Cotton Bed Sheets. Prices range from $4.20 to $6.80 per unit at 500-piece MOQ.',
        date: 'Mar 15, 2026',
        supplier: 'Cavela Team',
        replies: 0
      },
      {
        id: 'upd-003',
        title: 'Thread Count Clarification Resolved',
        description:
        'All suppliers have confirmed 300 TC (thread count) availability. Two suppliers also offer 400 TC at a 12% price premium.',
        date: 'Mar 10, 2026',
        supplier: 'Cavela Team',
        replies: 3
      }]

    },
    quotes: {
      supplierCount: 97,
      totalSuppliers: 175000,
      steps: [
      {
        id: 1,
        label: 'Identified matches',
        highlight: '97',
        highlightSuffix: ' best matches out of 175,000 suppliers',
        description: 'We search for suppliers that match your exact product requirement and location.',
        status: 'completed',
        inProgress: false
      },
      {
        id: 2,
        label: 'Reaching out to suppliers',
        highlight: '97',
        highlightSuffix: ' suppliers',
        description: 'We share your product info with matched suppliers to understand their interest.',
        status: 'completed',
        inProgress: false
      },
      {
        id: 3,
        label: 'Engage suppliers',
        highlight: null,
        highlightSuffix: null,
        description: 'We communicate with interested suppliers to verify their terms to prep for quotes.',
        status: 'active',
        inProgress: true
      },
      {
        id: 4,
        label: 'Receive quotes',
        highlight: null,
        highlightSuffix: null,
        description: 'We receive detailed quote that is ready for you to select.',
        status: 'pending',
        inProgress: false
      }]

    },
    orders: {
      orders: [
      {
        id: 'order-003',
        orderNumber: 'PQ-2026-0029',
        description: 'Sample order — 10 units, 300 TC white',
        status: 'Shipped',
        statusColor: 'text-green-600 bg-green-50',
        supplier: 'Sunrise Textiles',
        placedDate: 'Mar 10, 2026',
        estimatedDelivery: 'Apr 5–15, 2026',
        amount: '$68.00'
      },
      {
        id: 'order-004',
        orderNumber: 'PQ-2026-0031',
        description: 'Sample order — 10 units, 400 TC white',
        status: 'Delivered',
        statusColor: 'text-gray-600 bg-gray-100',
        supplier: 'Linen World Co.',
        placedDate: 'Mar 12, 2026',
        estimatedDelivery: 'Apr 8–18, 2026',
        amount: '$95.00'
      }],

      steps: [
      { id: 'step-1', label: 'Order Placed', done: true },
      { id: 'step-2', label: 'Sample in Production', done: true },
      { id: 'step-3', label: 'Quality Check', done: true },
      { id: 'step-4', label: 'Shipped', done: true },
      { id: 'step-5', label: 'Delivered', done: true }]

    },
    files: [
    { id: 'file-009', name: 'BedSheets-King-RFQ-Spec.pdf', date: 'Mar 19, 2026' },
    { id: 'file-010', name: 'BedSheets-Sample-Photos-Sunrise.zip', date: 'Mar 17, 2026' },
    { id: 'file-011', name: 'BedSheets-Quote-Comparison-3-Suppliers.xlsx', date: 'Mar 15, 2026' },
    { id: 'file-012', name: 'BedSheets-Thread-Count-Reference.pdf', date: 'Mar 10, 2026' }],

    samples: {
      samples: [
      {
        id: 'smp-005',
        image: "https://img.rocket.new/generatedImages/rocket_gen_img_18f8ae602-1777719476000.png",
        imageAlt: 'White cotton bed sheet sample 300 thread count from Sunrise Textiles',
        name: 'Bed Sheet Sample — 300 TC White King',
        type: 'Pre-Production',
        supplier: 'Sunrise Textiles',
        stage: 'Shipped',
        requested: 'Mar 10, 2026',
        completion: 'Apr 5, 2026'
      },
      {
        id: 'smp-006',
        image: "https://img.rocket.new/generatedImages/rocket_gen_img_13e7a81ce-1772980237065.png",
        imageAlt: 'White cotton bed sheet sample 400 thread count from Linen World Co',
        name: 'Bed Sheet Sample — 400 TC White King',
        type: 'Pre-Production',
        supplier: 'Linen World Co.',
        stage: 'Approved',
        requested: 'Mar 12, 2026',
        completion: 'Apr 8, 2026'
      },
      {
        id: 'smp-007',
        image: "https://img.rocket.new/generatedImages/rocket_gen_img_13e7a81ce-1772980237065.png",
        imageAlt: 'Fabric swatch showing cotton weave and thread count comparison',
        name: 'Fabric Swatch — Thread Count Comparison',
        type: 'Fabric Swatch',
        supplier: 'Sunrise Textiles',
        stage: 'Approved',
        requested: 'Mar 5, 2026',
        completion: 'Mar 15, 2026'
      }],

      references: [
      {
        id: 'ref-004',
        image: 'https://img.rocket.new/generatedImages/rocket_gen_img_171e9f2d7-1772974929871.png',
        imageAlt: 'Hotel-grade white bed sheet reference showing premium finish',
        name: 'Hotel Grade Reference — Premium White Sheet',
        type: 'Quality Reference',
        creator: 'Sourcing Team',
        stage: 'Approved',
        requested: 'Mar 1, 2026'
      }]

    }
  },

  'prod-004': {
    id: 'prod-004',
    name: 'Organic Cotton Tote Bags 500 pcs',
    image: "https://img.rocket.new/generatedImages/rocket_gen_img_1b3a49385-1766917621427.png",
    imageAlt: 'Natural cotton tote bag with rope handles',
    stage: 'Quoting',
    updates: {
      tasks: [
      {
        id: 'task-005',
        type: 'Action',
        title: 'Book A Call - Start Sourcing with Cavela',
        description:
        "We'd be glad to discuss your Organic Cotton Tote Bags 500 pcs project. Please book a call and we'll walk through the next steps together.",
        date: 'Mar 12, 2026',
        supplier: 'All suppliers',
        replies: 0
      }],

      updates: []
    },
    quotes: {
      supplierCount: 63,
      totalSuppliers: 88500,
      steps: [
      {
        id: 1,
        label: 'Identified matches',
        highlight: '63',
        highlightSuffix: ' best matches out of 88,500 suppliers',
        description: 'We search for suppliers that match your exact product requirement and location.',
        status: 'completed',
        inProgress: false
      },
      {
        id: 2,
        label: 'Reaching out to suppliers',
        highlight: '63',
        highlightSuffix: ' suppliers',
        description: 'We share your product info with matched suppliers to understand their interest.',
        status: 'active',
        inProgress: true
      },
      {
        id: 3,
        label: 'Engage suppliers',
        highlight: null,
        highlightSuffix: null,
        description: 'We communicate with interested suppliers to verify their terms to prep for quotes.',
        status: 'pending',
        inProgress: false
      },
      {
        id: 4,
        label: 'Receive quotes',
        highlight: null,
        highlightSuffix: null,
        description: 'We receive detailed quote that is ready for you to select.',
        status: 'pending',
        inProgress: false
      }]

    },
    orders: {
      orders: [
      {
        id: 'order-005',
        orderNumber: 'PQ-2026-0035',
        description: 'Sample order — 20 units, natural cotton',
        status: 'In Production',
        statusColor: 'text-amber-600 bg-amber-50',
        supplier: 'EcoWeave India',
        placedDate: 'Mar 8, 2026',
        estimatedDelivery: 'Apr 20–30, 2026',
        amount: '$120.00'
      }],

      steps: [
      { id: 'step-1', label: 'Order Placed', done: true },
      { id: 'step-2', label: 'Sample in Production', done: true },
      { id: 'step-3', label: 'Quality Check', done: false },
      { id: 'step-4', label: 'Shipped', done: false },
      { id: 'step-5', label: 'Delivered', done: false }]

    },
    files: [
    { id: 'file-013', name: 'ToteBags-Organic-RFQ-Brief.pdf', date: 'Mar 12, 2026' },
    { id: 'file-014', name: 'ToteBags-GOTS-Certification-Requirement.pdf', date: 'Mar 10, 2026' },
    { id: 'file-015', name: 'ToteBags-Design-Mockup-v1.png', date: 'Mar 8, 2026' }],

    samples: {
      samples: [
      {
        id: 'smp-008',
        image: "https://img.rocket.new/generatedImages/rocket_gen_img_1d5d1d558-1772832719460.png",
        imageAlt: 'Organic cotton tote bag sample with natural rope handles from EcoWeave India',
        name: 'Tote Bag Sample — Natural Cotton, Rope Handle',
        type: 'Pre-Production',
        supplier: 'EcoWeave India',
        stage: 'Pending',
        requested: 'Mar 8, 2026',
        completion: 'Apr 20, 2026'
      }],

      references: [
      {
        id: 'ref-005',
        image: 'https://img.rocket.new/generatedImages/rocket_gen_img_190e62348-1766926552430.png',
        imageAlt: 'GOTS certified organic tote bag reference from sustainable brand',
        name: 'GOTS Certified Tote — Sustainability Reference',
        type: 'Sustainability Reference',
        creator: 'Sourcing Team',
        stage: 'Approved',
        requested: 'Mar 5, 2026'
      },
      {
        id: 'ref-006',
        image: 'https://img.rocket.new/generatedImages/rocket_gen_img_190e62348-1766926552430.png',
        imageAlt: 'Tote bag print reference showing logo placement and screen print technique',
        name: 'Print Reference — Logo Placement & Screen Print',
        type: 'Print Reference',
        creator: 'Design Team',
        stage: 'In Review',
        requested: 'Mar 7, 2026'
      }]

    }
  },

  'prod-005': {
    id: 'prod-005',
    name: 'Green Cardamoms 6mm+ Bulk 2 Tonnes',
    image: "https://img.rocket.new/generatedImages/rocket_gen_img_1f97d4af3-1767168104931.png",
    imageAlt: 'Green cardamom pods in bulk sack',
    stage: 'Quoting',
    updates: {
      tasks: [
      {
        id: 'task-006',
        type: 'Action',
        title: 'Confirm Moisture Content & Grade Specification',
        description:
        'Suppliers require confirmation of acceptable moisture content (%) and whether AGMARK or equivalent certification is needed for the 6mm+ Green Cardamoms.',
        date: 'Mar 19, 2026',
        supplier: 'All suppliers',
        replies: 1
      }],

      updates: [
      {
        id: 'upd-004',
        title: 'Supplier Outreach Underway — 78 Contacted',
        description:
        '78 spice exporters and agricultural suppliers have been contacted for your 2-tonne Green Cardamom order. Responses expected within 5–7 business days.',
        date: 'Mar 16, 2026',
        supplier: 'Cavela Team',
        replies: 0
      },
      {
        id: 'upd-005',
        title: 'Harvest Season Timing Note',
        description:
        'Current cardamom harvest season in Kerala runs through April. Pricing may be more favorable if the order is placed before May 1st.',
        date: 'Mar 14, 2026',
        supplier: 'Cavela Team',
        replies: 2
      }]

    },
    quotes: {
      supplierCount: 78,
      totalSuppliers: 42000,
      steps: [
      {
        id: 1,
        label: 'Identified matches',
        highlight: '78',
        highlightSuffix: ' best matches out of 42,000 suppliers',
        description: 'We search for suppliers that match your exact product requirement and location.',
        status: 'completed',
        inProgress: false
      },
      {
        id: 2,
        label: 'Reaching out to suppliers',
        highlight: '78',
        highlightSuffix: ' suppliers',
        description: 'We share your product info with matched suppliers to understand their interest.',
        status: 'active',
        inProgress: true
      },
      {
        id: 3,
        label: 'Engage suppliers',
        highlight: null,
        highlightSuffix: null,
        description: 'We communicate with interested suppliers to verify their terms to prep for quotes.',
        status: 'pending',
        inProgress: false
      },
      {
        id: 4,
        label: 'Receive quotes',
        highlight: null,
        highlightSuffix: null,
        description: 'We receive detailed quote that is ready for you to select.',
        status: 'pending',
        inProgress: false
      }]

    },
    orders: {
      orders: [
      {
        id: 'order-006',
        orderNumber: 'PQ-2026-0033',
        description: 'Trial shipment — 50 kg sample lot',
        status: 'Shipped',
        statusColor: 'text-green-600 bg-green-50',
        supplier: 'Kerala Spice Exports',
        placedDate: 'Mar 14, 2026',
        estimatedDelivery: 'Apr 10–20, 2026',
        amount: '$340.00'
      }],

      steps: [
      { id: 'step-1', label: 'Order Placed', done: true },
      { id: 'step-2', label: 'Sample in Production', done: true },
      { id: 'step-3', label: 'Quality Check', done: true },
      { id: 'step-4', label: 'Shipped', done: true },
      { id: 'step-5', label: 'Delivered', done: false }]

    },
    files: [
    { id: 'file-016', name: 'Cardamom-6mm-RFQ-Specification.pdf', date: 'Mar 19, 2026' },
    { id: 'file-017', name: 'Cardamom-Grade-Quality-Standards.pdf', date: 'Mar 17, 2026' },
    { id: 'file-018', name: 'Cardamom-Supplier-Quotes-Comparison.xlsx', date: 'Mar 16, 2026' },
    { id: 'file-019', name: 'Cardamom-Phytosanitary-Certificate-Template.pdf', date: 'Mar 14, 2026' }],

    samples: {
      samples: [
      {
        id: 'smp-009',
        image: "https://img.rocket.new/generatedImages/rocket_gen_img_1f7d183dd-1776871097930.png",
        imageAlt: 'Green cardamom 6mm grade sample lot from Kerala Spice Exports',
        name: 'Cardamom Sample — 6mm+ Grade A, 1 kg',
        type: 'Product Sample',
        supplier: 'Kerala Spice Exports',
        stage: 'Shipped',
        requested: 'Mar 14, 2026',
        completion: 'Apr 10, 2026'
      },
      {
        id: 'smp-010',
        image: "https://img.rocket.new/generatedImages/rocket_gen_img_1f7d183dd-1776871097930.png",
        imageAlt: 'Green cardamom sample from Spice Garden Exports showing moisture content test',
        name: 'Cardamom Sample — Moisture Test Batch',
        type: 'Quality Sample',
        supplier: 'Spice Garden Exports',
        stage: 'In Review',
        requested: 'Mar 18, 2026',
        completion: 'Apr 15, 2026'
      }],

      references: [
      {
        id: 'ref-007',
        image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1623031a4-1772114043806.png',
        imageAlt: 'AGMARK certified green cardamom reference showing grade and quality standard',
        name: 'AGMARK Grade Reference — 6mm+ Standard',
        type: 'Certification Reference',
        creator: 'Sourcing Team',
        stage: 'Approved',
        requested: 'Mar 12, 2026'
      }]

    }
  },

  'prod-006': {
    id: 'prod-006',
    name: 'Us Polo Shirts Bulk Order 50000 Units',
    image: "https://images.unsplash.com/photo-1714317438040-0e8584215699",
    imageAlt: 'US Polo shirts bulk order stacked in warehouse',
    stage: 'Quoting',
    updates: {
      tasks: [
      {
        id: 'task-007',
        type: 'Action',
        title: 'Book A Call - Start Sourcing with Cavela',
        description:
        "We'd be glad to discuss your Us Polo Shirts Bulk Order 50000 Units project. Please book a call and we'll walk through the next steps together.",
        date: 'Apr 25, 2026',
        supplier: 'All suppliers',
        replies: 0
      },
      {
        id: 'task-008',
        type: 'Action',
        title: 'Confirm Size Breakdown & Color Variants',
        description:
        'Suppliers need the size ratio (S/M/L/XL/XXL) and color variants for the 50,000-unit polo shirt order to provide accurate pricing and production timelines.',
        date: 'Apr 23, 2026',
        supplier: 'All suppliers',
        replies: 1
      }],

      updates: [
      {
        id: 'upd-006',
        title: 'RFQ Submitted — Under Review',
        description:
        'Your RFQ for 50,000 units of US Polo Shirts is under review by the sourcing team. We are identifying the best-matched suppliers for your requirements.',
        date: 'Apr 22, 2026',
        supplier: 'Cavela Team',
        replies: 0
      }]

    },
    quotes: {
      supplierCount: 210,
      totalSuppliers: 312000,
      steps: [
      {
        id: 1,
        label: 'Identified matches',
        highlight: '210',
        highlightSuffix: ' best matches out of 312,000 suppliers',
        description: 'We search for suppliers that match your exact product requirement and location.',
        status: 'completed',
        inProgress: false
      },
      {
        id: 2,
        label: 'Reaching out to suppliers',
        highlight: '210',
        highlightSuffix: ' suppliers',
        description: 'We share your product info with matched suppliers to understand their interest.',
        status: 'active',
        inProgress: true
      },
      {
        id: 3,
        label: 'Engage suppliers',
        highlight: null,
        highlightSuffix: null,
        description: 'We communicate with interested suppliers to verify their terms to prep for quotes.',
        status: 'pending',
        inProgress: false
      },
      {
        id: 4,
        label: 'Receive quotes',
        highlight: null,
        highlightSuffix: null,
        description: 'We receive detailed quote that is ready for you to select.',
        status: 'pending',
        inProgress: false
      }]

    },
    orders: {
      orders: [
      {
        id: 'order-007',
        orderNumber: 'PQ-2026-0044',
        description: 'Pre-production sample — 10 units, mixed sizes',
        status: 'In Production',
        statusColor: 'text-amber-600 bg-amber-50',
        supplier: 'Shanghai Garment Co.',
        placedDate: 'Apr 26, 2026',
        estimatedDelivery: 'Jun 10–25, 2026',
        amount: '$320.00'
      }],

      steps: [
      { id: 'step-1', label: 'Order Placed', done: true },
      { id: 'step-2', label: 'Sample in Production', done: true },
      { id: 'step-3', label: 'Quality Check', done: false },
      { id: 'step-4', label: 'Shipped', done: false },
      { id: 'step-5', label: 'Delivered', done: false }]

    },
    files: [
    { id: 'file-020', name: 'PoloShirts-RFQ-Specification.pdf', date: 'Apr 25, 2026' },
    { id: 'file-021', name: 'PoloShirts-Size-Breakdown-Chart.xlsx', date: 'Apr 23, 2026' },
    { id: 'file-022', name: 'PoloShirts-Color-Swatch-Reference.pdf', date: 'Apr 22, 2026' },
    { id: 'file-023', name: 'PoloShirts-Brand-Guidelines.pdf', date: 'Apr 20, 2026' }],

    samples: {
      samples: [
      {
        id: 'smp-011',
        image: "https://img.rocket.new/generatedImages/rocket_gen_img_190cafa6b-1777719475407.png",
        imageAlt: 'US polo shirt pre-production sample in white from Shanghai Garment Co',
        name: 'Polo Shirt Sample — White, Size M',
        type: 'Pre-Production',
        supplier: 'Shanghai Garment Co.',
        stage: 'Pending',
        requested: 'Apr 26, 2026',
        completion: 'Jun 10, 2026'
      }],

      references: [
      {
        id: 'ref-008',
        image: "https://img.rocket.new/generatedImages/rocket_gen_img_1b767d6dc-1766874412455.png",
        imageAlt: 'Brand reference polo shirt showing collar and embroidery placement',
        name: 'Brand Reference — Polo Collar & Embroidery',
        type: 'Brand Reference',
        creator: 'Design Team',
        stage: 'Approved',
        requested: 'Apr 18, 2026'
      }]

    }
  },

  'prod-007': {
    id: 'prod-007',
    name: 'Laptop Charging Cable',
    image: "https://images.unsplash.com/photo-1660945671777-6389d37d6ab4",
    imageAlt: 'Laptop charging cable USB-C coiled on white background',
    stage: 'Quoting',
    updates: {
      tasks: [
      {
        id: 'task-009',
        type: 'Action',
        title: 'Confirm Connector Type & Wattage Specification',
        description:
        'Suppliers need confirmation of the connector type (USB-C, MagSafe, proprietary) and wattage (45W, 65W, 100W) to match your laptop charging cable requirements.',
        date: 'Apr 28, 2026',
        supplier: 'All suppliers',
        replies: 2
      }],

      updates: [
      {
        id: 'upd-007',
        title: 'Supplier Outreach Initiated — 95 Contacted',
        description:
        '95 electronics and cable manufacturers have been contacted for your Laptop Charging Cable order. Initial responses expected within 3–5 business days.',
        date: 'Apr 26, 2026',
        supplier: 'Cavela Team',
        replies: 0
      },
      {
        id: 'upd-008',
        title: 'Certification Requirements Noted',
        description:
        'Suppliers have been informed of CE, RoHS, and UL certification requirements. 62 out of 95 suppliers confirmed they hold the required certifications.',
        date: 'Apr 24, 2026',
        supplier: 'Cavela Team',
        replies: 1
      }]

    },
    quotes: {
      supplierCount: 95,
      totalSuppliers: 145000,
      steps: [
      {
        id: 1,
        label: 'Identified matches',
        highlight: '95',
        highlightSuffix: ' best matches out of 145,000 suppliers',
        description: 'We search for suppliers that match your exact product requirement and location.',
        status: 'completed',
        inProgress: false
      },
      {
        id: 2,
        label: 'Reaching out to suppliers',
        highlight: '95',
        highlightSuffix: ' suppliers',
        description: 'We share your product info with matched suppliers to understand their interest.',
        status: 'completed',
        inProgress: false
      },
      {
        id: 3,
        label: 'Engage suppliers',
        highlight: null,
        highlightSuffix: null,
        description: 'We communicate with interested suppliers to verify their terms to prep for quotes.',
        status: 'active',
        inProgress: true
      },
      {
        id: 4,
        label: 'Receive quotes',
        highlight: null,
        highlightSuffix: null,
        description: 'We receive detailed quote that is ready for you to select.',
        status: 'pending',
        inProgress: false
      }]

    },
    orders: {
      orders: [
      {
        id: 'order-008',
        orderNumber: 'PQ-2026-0039',
        description: 'Sample order — 20 units, USB-C 65W',
        status: 'Quality Check',
        statusColor: 'text-blue-600 bg-blue-50',
        supplier: 'Shenzhen ElecTech',
        placedDate: 'Apr 20, 2026',
        estimatedDelivery: 'May 20–Jun 5, 2026',
        amount: '$95.00'
      }],

      steps: [
      { id: 'step-1', label: 'Order Placed', done: true },
      { id: 'step-2', label: 'Sample in Production', done: true },
      { id: 'step-3', label: 'Quality Check', done: true },
      { id: 'step-4', label: 'Shipped', done: false },
      { id: 'step-5', label: 'Delivered', done: false }]

    },
    files: [
    { id: 'file-024', name: 'LaptopCable-RFQ-Specification.pdf', date: 'Apr 28, 2026' },
    { id: 'file-025', name: 'LaptopCable-Certification-Requirements.pdf', date: 'Apr 26, 2026' },
    { id: 'file-026', name: 'LaptopCable-Supplier-Shortlist.xlsx', date: 'Apr 25, 2026' },
    { id: 'file-027', name: 'LaptopCable-Technical-Spec-Sheet.pdf', date: 'Apr 22, 2026' }],

    samples: {
      samples: [
      {
        id: 'smp-012',
        image: "https://img.rocket.new/generatedImages/rocket_gen_img_1e6189769-1776310648307.png",
        imageAlt: 'USB-C 65W laptop charging cable sample from Shenzhen ElecTech',
        name: 'Charging Cable Sample — USB-C 65W, 1.8m',
        type: 'Product Sample',
        supplier: 'Shenzhen ElecTech',
        stage: 'In Review',
        requested: 'Apr 20, 2026',
        completion: 'May 20, 2026'
      },
      {
        id: 'smp-013',
        image: "https://img.rocket.new/generatedImages/rocket_gen_img_151eefe64-1774133015049.png",
        imageAlt: 'USB-C 100W laptop charging cable sample from Guangzhou Cable Co',
        name: 'Charging Cable Sample — USB-C 100W, 2m',
        type: 'Product Sample',
        supplier: 'Guangzhou Cable Co.',
        stage: 'Pending',
        requested: 'Apr 24, 2026',
        completion: 'Jun 1, 2026'
      }],

      references: [
      {
        id: 'ref-009',
        image: "https://img.rocket.new/generatedImages/rocket_gen_img_1b02e9e43-1765176634845.png",
        imageAlt: 'CE and RoHS certified laptop cable reference showing certification marks',
        name: 'Certification Reference — CE & RoHS Standard',
        type: 'Certification Reference',
        creator: 'Sourcing Team',
        stage: 'Approved',
        requested: 'Apr 18, 2026'
      }]

    }
  }
};

export function getProductDetailData(productId: string): ProductDetailData | null {
  return ALL_PRODUCT_DETAIL_DATA[productId] ?? null;
}