'use client';
import React, { useState, useEffect } from 'react';
import { Building2, MapPin, Phone, Mail, Globe, Users, FileText, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { getStoredOrg, onOrgUpdated, StoredOrg, DEFAULT_ORG } from '@/lib/orgStore';

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  link?: string;
}

function InfoRow({ icon, label, value, link }: InfoRowProps) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-[var(--border)] last:border-0">
      <div className="w-7 h-7 rounded-lg bg-[var(--secondary)] flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-primary">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[var(--muted-foreground)] mb-0.5">{label}</p>
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary hover:underline flex items-center gap-1 break-all"
          >
            {value}
            <ExternalLink size={11} className="flex-shrink-0" />
          </a>
        ) : (
          <p className="text-sm font-medium text-[var(--foreground)] break-words">{value}</p>
        )}
      </div>
    </div>
  );
}

export default function OrganizationContent() {
  const [org, setOrg] = useState<StoredOrg>(DEFAULT_ORG);

  useEffect(() => {
    const unsubscribe = onOrgUpdated(() => {
      setOrg(getStoredOrg());
    });
    return unsubscribe;
  }, []);

  const cityStateZip = [org.city, org.state, org.zip].filter(Boolean).join(', ');

  return (
    <div className="px-4 md:px-8 py-5 md:py-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 md:mb-8 gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[var(--foreground)]">Organization</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            Your organization profile and business details
          </p>
        </div>
        <Link
          href="/account"
          className="flex-shrink-0 px-3 md:px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-[#2e29c4] active:scale-95 transition-all duration-200"
        >
          Edit
        </Link>
      </div>

      {/* Org Identity Card */}
      <div className="bg-white rounded-xl border border-[var(--border)] p-4 md:p-6 mb-5 md:mb-6">
        <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-6">
          <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-xl md:text-2xl flex-shrink-0">
            {(org.name || 'O').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg md:text-xl font-bold text-[var(--foreground)] truncate">
              {org.name}
            </h2>
            <p className="text-sm text-[var(--muted-foreground)] truncate">{org.legalName}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {org.type && (
                <span className="text-xs bg-[var(--secondary)] text-primary font-medium px-2 py-0.5 rounded-full">
                  {org.type}
                </span>
              )}
              {org.industry && (
                <span className="text-xs bg-[var(--muted)] text-[var(--muted-foreground)] font-medium px-2 py-0.5 rounded-full">
                  {org.industry}
                </span>
              )}
            </div>
          </div>
        </div>
        {org.description && (
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed border-t border-[var(--border)] pt-4">
            {org.description}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Contact Details */}
        <div className="bg-white rounded-xl border border-[var(--border)] p-4 md:p-5">
          <h3 className="text-sm font-semibold text-[var(--foreground)] mb-1 flex items-center gap-2">
            <Phone size={15} className="text-primary" />
            Contact Details
          </h3>
          <div className="mt-3">
            <InfoRow
              icon={<Mail size={14} />}
              label="Email"
              value={org.email}
              link={org.email ? `mailto:${org.email}` : undefined}
            />
            <InfoRow icon={<Phone size={14} />} label="Phone" value={org.phone} />
            <InfoRow
              icon={<Globe size={14} />}
              label="Website"
              value={org.website}
              link={org.website || undefined}
            />
          </div>
        </div>

        {/* Address */}
        <div className="bg-white rounded-xl border border-[var(--border)] p-4 md:p-5">
          <h3 className="text-sm font-semibold text-[var(--foreground)] mb-1 flex items-center gap-2">
            <MapPin size={15} className="text-primary" />
            Address
          </h3>
          <div className="mt-3">
            <InfoRow icon={<MapPin size={14} />} label="Street" value={org.street} />
            {cityStateZip && (
              <InfoRow icon={<Building2 size={14} />} label="City / State" value={cityStateZip} />
            )}
            <InfoRow icon={<Globe size={14} />} label="Country" value={org.country} />
          </div>
        </div>

        {/* Business Info */}
        <div className="bg-white rounded-xl border border-[var(--border)] p-4 md:p-5">
          <h3 className="text-sm font-semibold text-[var(--foreground)] mb-1 flex items-center gap-2">
            <FileText size={15} className="text-primary" />
            Business Info
          </h3>
          <div className="mt-3">
            <InfoRow
              icon={<FileText size={14} />}
              label="Registration No."
              value={org.registrationNumber}
            />
            <InfoRow icon={<FileText size={14} />} label="Tax ID" value={org.taxId} />
            <InfoRow icon={<Building2 size={14} />} label="Founded" value={org.founded} />
          </div>
        </div>

        {/* Team */}
        <div className="bg-white rounded-xl border border-[var(--border)] p-4 md:p-5">
          <h3 className="text-sm font-semibold text-[var(--foreground)] mb-1 flex items-center gap-2">
            <Users size={15} className="text-primary" />
            Team
          </h3>
          <div className="mt-3">
            <InfoRow icon={<Users size={14} />} label="Team Size" value={org.teamSize} />
            <InfoRow icon={<Building2 size={14} />} label="Industry" value={org.industry} />
          </div>
        </div>
      </div>
    </div>
  );
}
