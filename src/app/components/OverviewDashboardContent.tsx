'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  DollarSign,
  Package,
  TrendingUp,
  AlertTriangle,
  Clock,
  Truck,
  Calendar,
} from 'lucide-react';
import KpiCard from './KpiCard';
import ActivityFeed from './ActivityFeed';
import ChatButton from '@/components/ui/ChatButton';
import { CHART_DATA } from './SpendChart';
import { getStoredOrg, onOrgUpdated } from '@/lib/orgStore';
import { productService } from '@/lib/services/dbService';
import { useAuth } from '@/contexts/AuthContext';

const SpendChart = dynamic(() => import('./SpendChart'), { ssr: false });
const QuotesByCategoryChart = dynamic(() => import('./QuotesByCategoryChart'), { ssr: false });

const TIME_RANGES = [
  { id: 'range-7d', label: '7d' },
  { id: 'range-30d', label: '30d' },
  { id: 'range-monthly', label: 'Monthly' },
  { id: 'range-custom', label: 'Custom' },
];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 21) return 'Good evening';
  return 'Good night';
}

// ── Demo account email — this user always sees pre-filled rich data ───────────
const DEMO_EMAILS = new Set(['demo@proquoment.com', 'buyer@proquoment.com']);

// ── Static demo KPI data (shown only to demo account) ────────────────────────
const DEMO_KPI_DATA = {
  'range-7d': {
    spend: '$12,300',
    spendSub: 'vs $9,800 prev. week',
    spendTrend: '+25.5% vs previous period',
    active: '6',
    acceptance: '71%',
    acceptanceTrend: '+2.1% vs previous period',
    actionRequired: '2',
    turnaround: '4.2 days',
    turnaroundTrend: '-0.5 days vs last period',
    ordersInProgress: '3',
  },
  'range-30d': {
    spend: '$38,950',
    spendSub: 'vs $31,200 prev. month',
    spendTrend: '+24.9% vs previous period',
    active: '6',
    acceptance: '68%',
    acceptanceTrend: '-3.1% vs previous period',
    actionRequired: '2',
    turnaround: '5.1 days',
    turnaroundTrend: '-0.8 days vs last period',
    ordersInProgress: '3',
  },
  'range-monthly': {
    spend: '$38,950',
    spendSub: 'April 2026',
    spendTrend: '+24.9% vs March',
    active: '6',
    acceptance: '68%',
    acceptanceTrend: '-3.1% vs March',
    actionRequired: '2',
    turnaround: '5.1 days',
    turnaroundTrend: '-0.8 days vs March',
    ordersInProgress: '3',
  },
  'range-custom': {
    spend: '$172,450',
    spendSub: 'Nov 2025 – May 2026',
    spendTrend: '+31.2% vs prior 6 months',
    active: '6',
    acceptance: '67%',
    acceptanceTrend: '-1.8% overall',
    actionRequired: '2',
    turnaround: '5.4 days',
    turnaroundTrend: 'Period average',
    ordersInProgress: '3',
  },
};

interface LiveKpi {
  spend: string;
  spendSub: string;
  spendTrend: string;
  active: string;
  acceptance: string;
  acceptanceTrend: string;
  actionRequired: string;
  turnaround: string;
  turnaroundTrend: string;
  ordersInProgress: string;
}

const EMPTY_KPI: LiveKpi = {
  spend: '$0',
  spendSub: 'No orders yet',
  spendTrend: 'Create your first product to get started',
  active: '0',
  acceptance: '—',
  acceptanceTrend: 'No quotes received yet',
  actionRequired: '0',
  turnaround: '—',
  turnaroundTrend: 'No RFQs submitted yet',
  ordersInProgress: '0',
};

export default function OverviewDashboardContent() {
  const router = useRouter();
  const { user } = useAuth();

  const [activeRange, setActiveRange] = useState('range-30d');
  const [showCustom, setShowCustom] = useState(false);
  const [chartRange, setChartRange] = useState('range-30d');
  const [chartLabel, setChartLabel] = useState(CHART_DATA['range-30d'].label);
  const [kpiKey, setKpiKey] = useState('range-30d');
  const [orgName, setOrgName] = useState('');
  const [greeting, setGreeting] = useState('');
  const [isDemo, setIsDemo] = useState(false);
  const [liveKpi, setLiveKpi] = useState<LiveKpi>(EMPTY_KPI);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const fromRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);

  // ── Load org name + greeting ───────────────────────────────────────────────
  useEffect(() => {
    setOrgName(getStoredOrg().name);
    setGreeting(getGreeting());
    return onOrgUpdated(() => setOrgName(getStoredOrg().name));
  }, []);

  // ── Load user identity + real KPIs ────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    // Extract display name from metadata or email
    const fullName = user.user_metadata?.full_name || '';
    const emailName = user.email?.split('@')[0] || '';
    const displayName = fullName || emailName;
    setUserName(displayName);

    // Check if this is the demo account
    const demo = DEMO_EMAILS.has(user.email || '');
    setIsDemo(demo);

    if (demo) {
      setKpiLoading(false);
      return;
    }

    // ── Real user: calculate live KPIs from their actual Supabase data ──────
    setKpiLoading(true);
    productService
      .getAll()
      .then((products) => {
        // Only count real user products (not static demo ones)
        const userProducts = products.filter((p) => !p.isStatic);
        const total = userProducts.length;

        const activeQuoting = userProducts.filter((p) => p.stage === 'Quoting').length;
        const actionRequired = userProducts.filter((p) => p.status === 'Action Required').length;
        const inProduction = userProducts.filter(
          (p) => p.stage === 'Production' || p.stage === 'Sampling'
        ).length;
        const completed = userProducts.filter((p) => p.stage === 'Completed').length;

        if (total === 0) {
          setLiveKpi(EMPTY_KPI);
        } else {
          setLiveKpi({
            spend: completed > 0 ? `${completed} completed` : 'In progress',
            spendSub: `${total} product${total > 1 ? 's' : ''} sourced`,
            spendTrend:
              activeQuoting > 0 ? `${activeQuoting} currently in quoting` : 'No active quotes',
            active: String(activeQuoting),
            acceptance: total > 0 ? `${Math.round((completed / total) * 100)}%` : '—',
            acceptanceTrend:
              completed > 0
                ? `${completed} product${completed > 1 ? 's' : ''} completed`
                : 'No completed products yet',
            actionRequired: String(actionRequired),
            turnaround: '—',
            turnaroundTrend: 'Based on your RFQ history',
            ordersInProgress: String(inProduction),
          });
        }
        setKpiLoading(false);
      })
      .catch(() => {
        setLiveKpi(EMPTY_KPI);
        setKpiLoading(false);
      });
  }, [user]);

  // ── Decide which KPI set to show ───────────────────────────────────────────
  const kpi = isDemo ? DEMO_KPI_DATA[activeRange as keyof typeof DEMO_KPI_DATA] : liveKpi;

  // ── Greeting name: org name > user name > fallback ─────────────────────────
  const displayName = orgName || userName || '';

  const handleRangeChange = (id: string) => {
    setActiveRange(id);
    setKpiKey(id);
    if (id === 'range-custom') {
      setShowCustom(true);
    } else {
      setShowCustom(false);
      setChartRange(id);
      setChartLabel(CHART_DATA[id]?.label || '');
    }
  };

  const handleApplyCustom = () => {
    const from = fromRef.current?.value;
    const to = toRef.current?.value;
    if (from && to) {
      const fmt = (d: string) => {
        const dt = new Date(d);
        return dt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      };
      setChartLabel(`${fmt(from)} – ${fmt(to)}`);
      setChartRange('range-custom');
    }
  };

  return (
    <div className="px-4 md:px-8 py-5 md:py-8 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[var(--foreground)]">
            {greeting}
            {displayName ? `, ${displayName}` : ''}
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            {isDemo
              ? "Here's what's happening with your sourcing today."
              : kpiLoading
                ? 'Loading your dashboard...'
                : liveKpi.spend === '$0'
                  ? 'Welcome! Create your first product to start sourcing.'
                  : "Here's what's happening with your sourcing today."}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-white border border-[var(--border)] rounded-lg p-1 self-start sm:self-auto">
          {TIME_RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => handleRangeChange(r.id)}
              className={`px-2.5 md:px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                activeRange === r.id
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {showCustom && (
        <div className="mb-5 flex flex-wrap items-center gap-3 bg-white border border-[var(--border)] rounded-xl px-4 py-3 animate-slide-down-in">
          <Calendar size={15} className="text-[var(--muted-foreground)]" />
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fromRef}
              type="date"
              defaultValue="2025-11-01"
              className="text-sm border border-[var(--border)] rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-primary/30 transition-shadow duration-150"
            />
            <span className="text-[var(--muted-foreground)] text-sm">to</span>
            <input
              ref={toRef}
              type="date"
              defaultValue="2026-05-02"
              className="text-sm border border-[var(--border)] rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-primary/30 transition-shadow duration-150"
            />
          </div>
          <button
            onClick={handleApplyCustom}
            className="px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-md hover:bg-[#2e29c4] active:scale-95 transition-all duration-150"
          >
            Apply
          </button>
        </div>
      )}

      {/* New user empty state banner */}
      {!isDemo && !kpiLoading && liveKpi.spend === '$0' && (
        <div className="mb-6 flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <Package size={18} className="text-primary shrink-0" />
          <p className="text-sm text-[var(--foreground)]">
            Your dashboard is ready! Click{' '}
            <button
              onClick={() => router.push('/new-product')}
              className="text-primary font-semibold hover:underline"
            >
              + New Product
            </button>{' '}
            to submit your first RFQ and start sourcing from Indian manufacturers.
          </p>
        </div>
      )}

      {/* KPI Cards */}
      <div
        key={kpiKey}
        className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8 stagger-children"
      >
        <div className="animate-slide-up">
          <KpiCard
            label="Total Spend"
            value={kpiLoading ? '...' : kpi.spend}
            subValue={kpiLoading ? '' : kpi.spendSub}
            trend="up"
            trendValue={kpiLoading ? '' : kpi.spendTrend}
            icon={<DollarSign size={18} className="text-primary" />}
            iconBg="bg-[var(--secondary)]"
          />
        </div>
        <div className="animate-slide-up">
          <KpiCard
            label="Active Requests"
            value={kpiLoading ? '...' : kpi.active}
            subValue="Products in Quoting"
            trend="neutral"
            trendValue={isDemo ? 'Same as last period' : `${kpi.active} active RFQs`}
            icon={<Package size={18} className="text-blue-600" />}
            iconBg="bg-blue-50"
            href="/products-list"
          />
        </div>
        <div className="animate-slide-up">
          <KpiCard
            label="Quote Acceptance"
            value={kpiLoading ? '...' : kpi.acceptance}
            subValue="Of all received quotes"
            trend="down"
            trendValue={kpiLoading ? '' : kpi.acceptanceTrend}
            icon={<TrendingUp size={18} className="text-purple-600" />}
            iconBg="bg-purple-50"
          />
        </div>
        <div className="animate-slide-up">
          <KpiCard
            label="Action Required"
            value={kpiLoading ? '...' : kpi.actionRequired}
            subValue="Needs your response"
            trend="down"
            trendValue={Number(kpi.actionRequired) > 0 ? 'Needs attention now' : 'All clear'}
            alert={Number(kpi.actionRequired) > 0}
            icon={<AlertTriangle size={18} className="text-red-500" />}
            iconBg="bg-red-50"
            href="/products-list"
          />
        </div>
        <div className="animate-slide-up">
          <KpiCard
            label="Avg. Turnaround"
            value={kpiLoading ? '...' : kpi.turnaround}
            subValue="RFQ to first quote"
            trend="up"
            trendValue={kpiLoading ? '' : kpi.turnaroundTrend}
            icon={<Clock size={18} className="text-amber-600" />}
            iconBg="bg-amber-50"
          />
        </div>
        <div className="animate-slide-up">
          <KpiCard
            label="Orders In Progress"
            value={kpiLoading ? '...' : kpi.ordersInProgress}
            subValue="Active production"
            trend="neutral"
            trendValue="On track"
            icon={<Truck size={18} className="text-teal-600" />}
            iconBg="bg-teal-50"
            href="/products-list"
          />
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
        <div className="bg-white rounded-xl border border-[var(--border)] p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm md:text-base font-semibold text-[var(--foreground)]">
                Total Spend Over Time
              </h2>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                Confirmed order value (USD)
              </p>
            </div>
            <span className="text-xs text-[var(--muted-foreground)] bg-[var(--muted)] px-2 py-1 rounded-md">
              {chartLabel}
            </span>
          </div>
          <SpendChart range={chartRange} />
        </div>
        <div className="bg-white rounded-xl border border-[var(--border)] p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm md:text-base font-semibold text-[var(--foreground)]">
                Quotes by Category
              </h2>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Received vs. accepted</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-[#c7c5f8] inline-block" />
                Rcvd
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-primary inline-block" />
                Accpd
              </span>
            </div>
          </div>
          <QuotesByCategoryChart range={activeRange} />
        </div>
      </div>

      {/* Activity Feed */}
      <div className="bg-white rounded-xl border border-[var(--border)] p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm md:text-base font-semibold text-[var(--foreground)]">
            Recent Activity
          </h2>
          <button
            onClick={() => router.push('/products-list')}
            className="text-xs text-primary font-medium hover:underline"
          >
            View all
          </button>
        </div>
        <ActivityFeed limit={6} />
      </div>

      <ChatButton />
    </div>
  );
}
