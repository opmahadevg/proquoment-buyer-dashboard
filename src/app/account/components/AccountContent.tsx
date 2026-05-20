'use client';
import React, { useState, useEffect } from 'react';
import { Building2, MapPin, Phone, FileText, Save, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from 'sonner';
import { getStoredOrg, saveOrg, StoredOrg, DEFAULT_ORG } from '@/lib/orgStore';
import { createClient } from '@/lib/supabase/client';
import { fetchCurrentBuyerProfile, saveCurrentBuyerProfile } from '@/lib/services/procurementApi';

type OrgFormData = StoredOrg;

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
  const [form, setForm] = useState<OrgFormData>(DEFAULT_ORG);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<string>('pending');

  useEffect(() => {
    // Load local first for immediate UI
    setForm(getStoredOrg());

    const loadProfile = async () => {
      try {
        const dbProfile = await fetchCurrentBuyerProfile();
        if (dbProfile) {
          setForm({
            name: dbProfile.organization_name || '',
            legalName: dbProfile.legal_name || '',
            type: dbProfile.company_type || '',
            industry: dbProfile.industry || '',
            founded: dbProfile.founded || '',
            registrationNumber: dbProfile.registration_number || '',
            taxId: dbProfile.tax_id || '',
            website: dbProfile.website || '',
            email: dbProfile.email || '',
            phone: dbProfile.phone || '',
            street: dbProfile.street || '',
            city: dbProfile.city || '',
            state: dbProfile.state || '',
            zip: dbProfile.zip || '',
            country: dbProfile.country || '',
            teamSize: dbProfile.team_size || '',
            description: dbProfile.description || '',
          });
          setVerificationStatus(dbProfile.verification_status || 'pending');
        }
      } catch (err) {
        console.error('Failed to load profile from database:', err);
      }
    };

    loadProfile();

    const supabase = createClient();
    if (!supabase) return;

    let profileSub: any;
    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      profileSub = supabase
        .channel('buyer-profile-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'buyer_profiles', filter: `id=eq.${user.id}` },
          (payload: any) => {
            const updated = payload.new;
            if (updated) {
              setForm({
                name: updated.organization_name || '',
                legalName: updated.legal_name || '',
                type: updated.company_type || '',
                industry: updated.industry || '',
                founded: updated.founded || '',
                registrationNumber: updated.registration_number || '',
                taxId: updated.tax_id || '',
                website: updated.website || '',
                email: updated.email || '',
                phone: updated.phone || '',
                street: updated.street || '',
                city: updated.city || '',
                state: updated.state || '',
                zip: updated.zip || '',
                country: updated.country || '',
                teamSize: updated.team_size || '',
                description: updated.description || '',
              });
              setVerificationStatus(updated.verification_status || 'pending');
              toast.info(`Profile updated (Status: ${updated.verification_status.toUpperCase()})`);
            }
          }
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (profileSub) supabase.removeChannel(profileSub);
    };
  }, []);

  const handleChange = (name: keyof OrgFormData, value: string) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveOrg(form);
      await saveCurrentBuyerProfile({
        organization_name: form.name,
        legal_name: form.legalName,
        company_type: form.type,
        industry: form.industry,
        founded: form.founded,
        registration_number: form.registrationNumber,
        tax_id: form.taxId,
        website: form.website,
        email: form.email,
        phone: form.phone,
        street: form.street,
        city: form.city,
        state: form.state,
        zip: form.zip,
        country: form.country,
        team_size: form.teamSize,
        description: form.description,
      });
      setSaved(true);
      toast.success('Organization saved successfully.');
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      toast.error('Failed to save to database. Saved locally.');
    } finally {
      setSaving(false);
    }
  };

  const SaveButton = ({ extraClass = '' }: { extraClass?: string }) => (
    <button
      onClick={handleSave}
      disabled={saving}
      className={`flex items-center gap-2 px-4 md:px-5 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 disabled:opacity-60 active:scale-95 ${extraClass} ${
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
      {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
    </button>
  );

  return (
    <div className="px-4 md:px-8 py-5 md:py-8 max-w-4xl mx-auto">
      <Toaster position="bottom-right" richColors />

      {/* Header */}
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold text-[var(--foreground)]">Account</h1>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
              verificationStatus === 'verified' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
              verificationStatus === 'rejected' ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
            }`}>
              {verificationStatus}
            </span>
          </div>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            Manage your organization profile
          </p>
        </div>
        <SaveButton />
      </div>

      {/* Organization Identity */}
      <div className="bg-white rounded-xl border border-[var(--border)] p-4 md:p-6 mb-4 md:mb-6">
        <div className="flex items-center gap-2 mb-4 md:mb-5">
          <Building2 size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Organization Identity</h2>
        </div>
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[var(--border)]">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-lg md:text-xl flex-shrink-0">
            {(form.name || 'O').charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">{form.name || 'Organization Name'}</p>
            <p className="text-xs text-[var(--muted-foreground)]">{form.legalName}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
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
      <div className="bg-white rounded-xl border border-[var(--border)] p-4 md:p-6 mb-4 md:mb-6">
        <div className="flex items-center gap-2 mb-4 md:mb-5">
          <Phone size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Contact Details</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <Field label="Email Address" name="email" value={form.email} onChange={handleChange} placeholder="contact@yourorg.com" type="email" />
          <Field label="Phone Number" name="phone" value={form.phone} onChange={handleChange} placeholder="+91 98765 43210" />
          <div className="md:col-span-2">
            <Field label="Website" name="website" value={form.website} onChange={handleChange} placeholder="https://yourorg.com" type="url" />
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="bg-white rounded-xl border border-[var(--border)] p-4 md:p-6 mb-4 md:mb-6">
        <div className="flex items-center gap-2 mb-4 md:mb-5">
          <MapPin size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Address</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
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
      <div className="bg-white rounded-xl border border-[var(--border)] p-4 md:p-6 mb-6 md:mb-8">
        <div className="flex items-center gap-2 mb-4 md:mb-5">
          <FileText size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Business Info</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <Field label="Registration Number" name="registrationNumber" value={form.registrationNumber} onChange={handleChange} placeholder="e.g. REG-2018-HE-04421" />
          <Field label="Tax ID / GSTIN" name="taxId" value={form.taxId} onChange={handleChange} placeholder="e.g. GSTIN: 27AABCH1234F1Z5" />
        </div>
      </div>

      <div className="flex justify-end">
        <SaveButton extraClass="px-6" />
      </div>
    </div>
  );
}
