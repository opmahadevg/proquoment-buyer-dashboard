'use client';
import React from 'react';
import { Building2, MapPin, Phone, Mail, Globe, Users, FileText, ExternalLink } from 'lucide-react';
import Link from 'next/link';

const ORG_DATA = {
  name: "Honey\'s Org",
  legalName: "Honey Enterprises Pvt. Ltd.",
  type: "Private Limited Company",
  industry: "Textile & Apparel",
  founded: "2018",
  registrationNumber: "REG-2018-HE-04421",
  taxId: "GSTIN: 27AABCH1234F1Z5",
  website: "https://honeysorg.com",
  email: "contact@honeysorg.com",
  phone: "+91 98765 43210",
  address: {
    street: "42, Industrial Estate, Phase II",
    city: "Mumbai",
    state: "Maharashtra",
    zip: "400072",
    country: "India",
  },
  teamSize: "12–50 employees",
  description:
    "Honey's Org is a sourcing and procurement company specialising in home textiles, apparel, and agricultural commodities. We connect global buyers with verified manufacturers across South Asia.",
};

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  link?: string;
}

function InfoRow({ icon, label, value, link }: InfoRowProps) {
  return (
    <div className="flex items-start gap-3 py-3.5 border-b border-[var(--border)] last:border-0">
      <div className="w-8 h-8 rounded-lg bg-[var(--secondary)] flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-primary">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[var(--muted-foreground)] mb-0.5">{label}</p>
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
          >
            {value}
            <ExternalLink size={12} />
          </a>
        ) : (
          <p className="text-sm font-medium text-[var(--foreground)]">{value}</p>
        )}
      </div>
    </div>
  );
}

export default function OrganizationContent() {
  return (
    <div className="px-8 py-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Organization</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Your organization profile and business details
          </p>
        </div>
        <Link
          href="/account"
          className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-[#2e29c4] transition-colors"
        >
          Edit in Account
        </Link>
      </div>

      {/* Org Identity Card */}
      <div className="bg-white rounded-xl border border-[var(--border)] p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">
            H
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--foreground)]">{ORG_DATA.name}</h2>
            <p className="text-sm text-[var(--muted-foreground)]">{ORG_DATA.legalName}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs bg-[var(--secondary)] text-primary font-medium px-2.5 py-0.5 rounded-full">
                {ORG_DATA.type}
              </span>
              <span className="text-xs bg-[var(--muted)] text-[var(--muted-foreground)] font-medium px-2.5 py-0.5 rounded-full">
                {ORG_DATA.industry}
              </span>
            </div>
          </div>
        </div>
        <p className="text-sm text-[var(--muted-foreground)] leading-relaxed border-t border-[var(--border)] pt-4">
          {ORG_DATA.description}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact Details */}
        <div className="bg-white rounded-xl border border-[var(--border)] p-5">
          <h3 className="text-sm font-semibold text-[var(--foreground)] mb-1 flex items-center gap-2">
            <Phone size={15} className="text-primary" />
            Contact Details
          </h3>
          <div className="mt-3">
            <InfoRow icon={<Mail size={15} />} label="Email" value={ORG_DATA.email} link={`mailto:${ORG_DATA.email}`} />
            <InfoRow icon={<Phone size={15} />} label="Phone" value={ORG_DATA.phone} />
            <InfoRow icon={<Globe size={15} />} label="Website" value={ORG_DATA.website} link={ORG_DATA.website} />
          </div>
        </div>

        {/* Address */}
        <div className="bg-white rounded-xl border border-[var(--border)] p-5">
          <h3 className="text-sm font-semibold text-[var(--foreground)] mb-1 flex items-center gap-2">
            <MapPin size={15} className="text-primary" />
            Address
          </h3>
          <div className="mt-3">
            <InfoRow icon={<MapPin size={15} />} label="Street" value={ORG_DATA.address.street} />
            <InfoRow icon={<Building2 size={15} />} label="City / State" value={`${ORG_DATA.address.city}, ${ORG_DATA.address.state} ${ORG_DATA.address.zip}`} />
            <InfoRow icon={<Globe size={15} />} label="Country" value={ORG_DATA.address.country} />
          </div>
        </div>

        {/* Business Info */}
        <div className="bg-white rounded-xl border border-[var(--border)] p-5">
          <h3 className="text-sm font-semibold text-[var(--foreground)] mb-1 flex items-center gap-2">
            <FileText size={15} className="text-primary" />
            Business Info
          </h3>
          <div className="mt-3">
            <InfoRow icon={<FileText size={15} />} label="Registration No." value={ORG_DATA.registrationNumber} />
            <InfoRow icon={<FileText size={15} />} label="Tax ID" value={ORG_DATA.taxId} />
            <InfoRow icon={<Building2 size={15} />} label="Founded" value={ORG_DATA.founded} />
          </div>
        </div>

        {/* Team */}
        <div className="bg-white rounded-xl border border-[var(--border)] p-5">
          <h3 className="text-sm font-semibold text-[var(--foreground)] mb-1 flex items-center gap-2">
            <Users size={15} className="text-primary" />
            Team
          </h3>
          <div className="mt-3">
            <InfoRow icon={<Users size={15} />} label="Team Size" value={ORG_DATA.teamSize} />
            <InfoRow icon={<Building2 size={15} />} label="Industry" value={ORG_DATA.industry} />
          </div>
        </div>
      </div>
    </div>
  );
}
