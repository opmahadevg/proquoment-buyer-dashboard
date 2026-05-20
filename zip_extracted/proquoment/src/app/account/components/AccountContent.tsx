'use client';
import React, { useState, useEffect } from 'react';
import { Building2, MapPin, Phone, FileText, Save, CheckCircle, Loader2 } from 'lucide-react';
import { organizationService, DbOrganization } from '@/lib/services/dbService';
import { toast } from 'sonner';
import { Toaster } from 'sonner';

interface OrgFormData {
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

const EMPTY_FORM: OrgFormData = {
  name: '', legalName: '', type: '', industry: '', founded: '',
  registrationNumber: '', taxId: '', website: '', email: '', phone: '',
  street: '', city: '', state: '', zip: '', country: '', teamSize: '', description: '',
};

interface FieldProps {
  label: string;
  name: keyof OrgFormData;
  value: string;
  onChange: (name: keyof OrgFormData, value: string) => void;
  placeholder?: string;
  type?: string;
}

function Field({ label, name, value, onChange, placeholder, type = 'text' }: FieldProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 text-sm text-[var(--foreground)] bg-white border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
      />
    </div>
  );
}

interface TextAreaFieldProps {
  label: string;
  name: keyof OrgFormData;
  value: string;
  onChange: (name: keyof OrgFormData, value: string) => void;
  placeholder?: string;
}

function TextAreaField({ label, name, value, onChange, placeholder }: TextAreaFieldProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full px-3 py-2.5 text-sm text-[var(--foreground)] bg-white border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
      />
    </div>
  );
}

export default function AccountContent() {
  const [form, setForm] = useState<OrgFormData>(EMPTY_FORM);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const org = await organizationService.get();
        if (org) {
          setOrgId(org.id);
          setForm({
            name: org.name,
            legalName: org.legalName,
            type: org.orgType,
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
        console.error('Failed to load organization:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleChange = (name: keyof OrgFormData, value: string) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);
    try {
      const dbOrg: DbOrganization = {
        id: orgId,
        name: form.name,
        legalName: form.legalName,
        orgType: form.type,
        industry: form.industry,
        founded: form.founded,
        registrationNumber: form.registrationNumber,
        taxId: form.taxId,
        website: form.website,
        email: form.email,
        phone: form.phone,
        street: form.street,
        city: form.city,
        state: form.state,
        zip: form.zip,
        country: form.country,
        teamSize: form.teamSize,
        description: form.description,
      };
      await organizationService.update(dbOrg);
      setSaved(true);
      toast.success('Organization saved successfully.');
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      toast.error('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="px-8 py-8 max-w-4xl mx-auto">
      <Toaster position="bottom-right" richColors />
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Account</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Manage your organization profile and business details
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !orgId}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all disabled:opacity-60 ${
            saved ? 'bg-green-500 text-white' : 'bg-primary text-white hover:bg-[#2e29c4]'
          }`}
        >
          {saving ? (
            <Loader2 size={15} className="animate-spin" />
          ) : saved ? (
            <CheckCircle size={15} />
          ) : (
            <Save size={15} />
          )}
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save Changes'}
        </button>
      </div>

      {/* Organization Identity */}
      <div className="bg-white rounded-xl border border-[var(--border)] p-6 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <Building2 size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Organization Identity</h2>
        </div>
        <div className="flex items-center gap-4 mb-6 pb-5 border-b border-[var(--border)]">
          <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
            {form.name.charAt(0).toUpperCase() || 'O'}
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">{form.name || 'Organization Name'}</p>
            <p className="text-xs text-[var(--muted-foreground)]">{form.legalName}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Organization Name" name="name" value={form.name} onChange={handleChange} placeholder="e.g. Honey's Org" />
          <Field label="Legal Name" name="legalName" value={form.legalName} onChange={handleChange} placeholder="e.g. Honey Enterprises Pvt. Ltd." />
          <Field label="Company Type" name="type" value={form.type} onChange={handleChange} placeholder="e.g. Private Limited Company" />
          <Field label="Industry" name="industry" value={form.industry} onChange={handleChange} placeholder="e.g. Textile & Apparel" />
          <Field label="Founded Year" name="founded" value={form.founded} onChange={handleChange} placeholder="e.g. 2018" />
          <Field label="Team Size" name="teamSize" value={form.teamSize} onChange={handleChange} placeholder="e.g. 12–50 employees" />
          <div className="md:col-span-2">
            <TextAreaField label="Description" name="description" value={form.description} onChange={handleChange} placeholder="Brief description of your organization..." />
          </div>
        </div>
      </div>

      {/* Contact Details */}
      <div className="bg-white rounded-xl border border-[var(--border)] p-6 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <Phone size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Contact Details</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Email Address" name="email" value={form.email} onChange={handleChange} placeholder="contact@yourorg.com" type="email" />
          <Field label="Phone Number" name="phone" value={form.phone} onChange={handleChange} placeholder="+91 98765 43210" />
          <div className="md:col-span-2">
            <Field label="Website" name="website" value={form.website} onChange={handleChange} placeholder="https://yourorg.com" type="url" />
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="bg-white rounded-xl border border-[var(--border)] p-6 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <MapPin size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Address</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Field label="Street Address" name="street" value={form.street} onChange={handleChange} placeholder="Street, Building, Floor" />
          </div>
          <Field label="City" name="city" value={form.city} onChange={handleChange} placeholder="City" />
          <Field label="State / Province" name="state" value={form.state} onChange={handleChange} placeholder="State" />
          <Field label="ZIP / Postal Code" name="zip" value={form.zip} onChange={handleChange} placeholder="ZIP Code" />
          <Field label="Country" name="country" value={form.country} onChange={handleChange} placeholder="Country" />
        </div>
      </div>

      {/* Business Info */}
      <div className="bg-white rounded-xl border border-[var(--border)] p-6 mb-8">
        <div className="flex items-center gap-2 mb-5">
          <FileText size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Business Info</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Registration Number" name="registrationNumber" value={form.registrationNumber} onChange={handleChange} placeholder="e.g. REG-2018-HE-04421" />
          <Field label="Tax ID / GSTIN" name="taxId" value={form.taxId} onChange={handleChange} placeholder="e.g. GSTIN: 27AABCH1234F1Z5" />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || !orgId}
          className={`flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-lg transition-all disabled:opacity-60 ${
            saved ? 'bg-green-500 text-white' : 'bg-primary text-white hover:bg-[#2e29c4]'
          }`}
        >
          {saving ? (
            <Loader2 size={15} className="animate-spin" />
          ) : saved ? (
            <CheckCircle size={15} />
          ) : (
            <Save size={15} />
          )}
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
