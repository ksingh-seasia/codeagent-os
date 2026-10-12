import React, { useState } from 'react';
import { usePlatform } from '../../context/PlatformContext';
import { TenantUpgradeTierView } from './TenantUpgradeTierView';
import { TenantBillingInvoicesView } from './TenantBillingInvoicesView';

export const TenantLicenseUsage: React.FC = () => {
  const { currentCompany, currentTenantDevelopers } = usePlatform();
  const [activeTab, setActiveTab] = useState<'overview' | 'upgrade' | 'billing'>('overview');
  const [recentRuns, setRecentRuns] = useState<any[]>([]);
  
  const onNavigateToUpgrade = () => setActiveTab('upgrade');
  const onNavigateToInvoices = () => setActiveTab('billing');
  
  const activeSeats = currentTenantDevelopers.length;
  const totalSeats = currentCompany.totalLicenses;
  const agentRunsUsed = currentCompany.agentRunsUsed ?? 0;
  const agentRunsMax = currentCompany.agentRunsMax ?? 15000;
  const monthlyCost = currentCompany.monthlyCost ?? 199;
  const nextBillingDate = currentCompany.nextBillingDate ?? 'Nov 1, 2026';
  const tokensConsumed = currentCompany.tokensConsumed ?? 0;

  const runsUsedPercent = agentRunsMax > 0 ? Math.round((agentRunsUsed / agentRunsMax) * 100) : 0;
  const avgTokensPerRun = agentRunsUsed > 0 ? Math.round(tokensConsumed / agentRunsUsed) : 10000;

  const [estimatedTokens, setEstimatedTokens] = useState<number>(tokensConsumed || 50000);
  const estimatedRuns = avgTokensPerRun > 0 ? Math.floor(estimatedTokens / avgTokensPerRun) : 0;

  React.useEffect(() => {
    const fetchRecentRuns = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) return;
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/tenant/recent-runs`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setRecentRuns(data);
        }
      } catch (e) {
        // fallback
      }
    };
    fetchRecentRuns();
  }, []);

  const recentActivities = [
    ...recentRuns.slice(0, 3).map((run) => ({
      id: `run_${run.id}`,
      icon: 'smart_toy',
      color: run.status === 'COMPLETED' ? '#005338' : '#3525cd',
      bg: run.status === 'COMPLETED' ? '#ecfdf5' : '#eff4ff',
      title: (
        <span className="text-[13px] text-[#0b1c30]">
          <strong className="font-semibold">Agent Run #{run.id}</strong> on {run.ticketKey} ({run.status})
        </span>
      ),
      subtitle: `${run.tokenUsage || 0} tokens consumed • Branch: ${run.branch || 'main'}`,
      time: run.createdAt || 'Recent',
    })),
    ...currentTenantDevelopers.slice(0, 2).map(dev => ({
      id: dev.id,
      icon: dev.status === 'Active' ? 'person_add' : 'outgoing_mail',
      color: dev.status === 'Active' ? '#3525cd' : '#565e74',
      bg: dev.status === 'Active' ? '#eff4ff' : '#f8f9ff',
      title: (
        <span className="text-[13px] text-[#0b1c30]">
          <strong className="font-semibold">{dev.name}</strong> {dev.status === 'Active' ? 'assigned to seat' : 'invited'}
        </span>
      ),
      subtitle: dev.status === 'Active' ? `Role: ${dev.role}` : 'Invitation pending acceptance',
      time: dev.addedDate,
    })),
  ];

  if (activeTab === 'upgrade') {
    return <TenantUpgradeTierView onBack={() => setActiveTab('overview')} />;
  }

  if (activeTab === 'billing') {
    return (
      <TenantBillingInvoicesView
        onNavigateToOverview={() => setActiveTab('overview')}
        onNavigateToUpgrade={() => setActiveTab('upgrade')}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-5 sm:space-y-6">
      {/* 1. Page Header & Sub-navigation */}
      <div className="flex flex-col gap-4 border-b border-[#c7c4d8]/40 pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0b1c30]">
              License Usage &amp; Quota Overview
            </h1>
            <p className="text-[14px] text-[#565e74] mt-0.5">
              Monitor developer seats and LangGraph agent execution quotas for your organization.
            </p>
          </div>
          <button
            onClick={onNavigateToUpgrade}
            className="h-8 px-3 rounded-lg bg-[#4f46e5] hover:bg-[#3525cd] text-white text-[12px] font-medium flex items-center gap-1.5 transition-colors shadow-sm self-start sm:self-auto"
          >
            <span className="material-symbols-outlined text-[16px]">upgrade</span>
            <span>Upgrade Tier</span>
          </button>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex items-center gap-5 sm:gap-6 -mb-px text-[13px] overflow-x-auto no-scrollbar touch-scroll [&>button]:whitespace-nowrap [&>button]:shrink-0">
          <button className="pb-2.5 text-[#3525cd] font-semibold border-b-2 border-[#3525cd] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">monitoring</span>
            <span>Overview &amp; Quotas</span>
          </button>
          <button
            onClick={onNavigateToUpgrade}
            className="pb-2.5 text-[#565e74] hover:text-[#0b1c30] transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">north_east</span>
            <span>Upgrade Tier</span>
          </button>
          <button
            onClick={onNavigateToInvoices}
            className="pb-2.5 text-[#565e74] hover:text-[#0b1c30] transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">receipt_long</span>
            <span>Billing &amp; Invoices</span>
          </button>
        </div>
      </div>

      {/* 2. Primary Quota Cards (3 Metric Blocks) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Developer Seats */}
        <div className="bg-white border border-[#c7c4d8] rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-mono text-[#565e74] uppercase tracking-wider">
                Developer Seats
              </span>
              <span className="material-symbols-outlined text-[#3525cd] text-[20px]">badge</span>
            </div>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-3xl font-bold text-[#0b1c30] font-mono">
                {activeSeats} / {totalSeats}
              </span>
              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[#e5eeff] text-[#565e74] font-medium">
                {totalSeats > 0 ? Math.round((activeSeats / totalSeats) * 100) : 0}% used
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="w-full h-2 bg-[#eff4ff] rounded-full overflow-hidden border border-[#c7c4d8]/40">
              <div className="h-full bg-[#4f46e5] rounded-full" style={{ width: `${totalSeats > 0 ? Math.min(100, (activeSeats / totalSeats) * 100) : 0}%` }}></div>
            </div>
            <p className="text-[11px] text-[#565e74] flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-[#005338]">check_circle</span>
              <span>{Math.max(0, totalSeats - activeSeats)} seats available for new developers</span>
            </p>
          </div>
        </div>

        {/* Card 2: Monthly Agent Runs */}
        <div className="bg-white border border-[#c7c4d8] rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-mono text-[#565e74] uppercase tracking-wider">
                Monthly Agent Runs
              </span>
              <span className="material-symbols-outlined text-[#3525cd] text-[20px]">smart_toy</span>
            </div>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-3xl font-bold text-[#0b1c30] font-mono">
                {agentRunsUsed.toLocaleString()} / {agentRunsMax.toLocaleString()}
              </span>
              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[#e5eeff] text-[#565e74] font-medium">
                {runsUsedPercent}% used
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="w-full h-2 bg-[#eff4ff] rounded-full overflow-hidden border border-[#c7c4d8]/40">
              <div className="h-full bg-[#4f46e5] rounded-full" style={{ width: `${Math.min(100, runsUsedPercent)}%` }}></div>
            </div>
            <p className="text-[11px] text-[#565e74] flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">memory</span>
              <span>{tokensConsumed.toLocaleString()} tokens consumed across team</span>
            </p>
          </div>
        </div>

        {/* Card 3: Subscription Tier */}
        <div className="bg-white border border-[#c7c4d8] rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-mono text-[#565e74] uppercase tracking-wider">
                Subscription Tier
              </span>
              <span className="material-symbols-outlined text-[#3525cd] text-[20px]">credit_card</span>
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-bold text-[#0b1c30] font-mono">${monthlyCost}</span>
              <span className="text-[13px] text-[#565e74]">/ month</span>
            </div>
            <p className="text-[12px] text-[#565e74] mb-3">{currentCompany.licensePlanTier}</p>
          </div>
          <div className="pt-2 border-t border-[#c7c4d8]/40 flex flex-col gap-1 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-[#565e74]">Next billing</span>
              <span className="font-mono text-[#0b1c30]">{nextBillingDate}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#565e74]">Payment method</span>
              <span className="font-mono text-[#0b1c30]">Visa •••• 4242</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Seat Allocation by Project & Scale Plan Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Seat Allocation Breakdown */}
        <div className="lg:col-span-2 bg-white border border-[#c7c4d8] rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#c7c4d8]/40 mb-4">
            <div>
              <h2 className="text-[16px] font-semibold text-[#0b1c30]">Seat Allocation by Project</h2>
              <p className="text-[12px] text-[#565e74]">
                Developer seats distributed across active team projects.
              </p>
            </div>
            <span className="text-[12px] font-mono text-[#565e74]">10 Assigned</span>
          </div>

          <div className="space-y-4">
            {/* Project 1 */}
            <div>
              <div className="flex items-center justify-between mb-1.5 text-[13px]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#4f46e5]"></span>
                  <span className="font-medium text-[#0b1c30]">Product Platform</span>
                </div>
                <span className="font-mono text-[#0b1c30]">5 seats assigned (50%)</span>
              </div>
              <div className="w-full h-2 bg-[#eff4ff] rounded-full overflow-hidden">
                <div className="h-full bg-[#4f46e5] rounded-full" style={{ width: '50%' }}></div>
              </div>
            </div>

            {/* Project 2 */}
            <div>
              <div className="flex items-center justify-between mb-1.5 text-[13px]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#3525cd]"></span>
                  <span className="font-medium text-[#0b1c30]">Customer Portal</span>
                </div>
                <span className="font-mono text-[#0b1c30]">3 seats assigned (30%)</span>
              </div>
              <div className="w-full h-2 bg-[#eff4ff] rounded-full overflow-hidden">
                <div className="h-full bg-[#3525cd] rounded-full" style={{ width: '30%' }}></div>
              </div>
            </div>

            {/* Project 3 */}
            <div>
              <div className="flex items-center justify-between mb-1.5 text-[13px]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#565e74]"></span>
                  <span className="font-medium text-[#0b1c30]">Data Ingestion</span>
                </div>
                <span className="font-mono text-[#0b1c30]">2 seats assigned (20%)</span>
              </div>
              <div className="w-full h-2 bg-[#eff4ff] rounded-full overflow-hidden">
                <div className="h-full bg-[#565e74] rounded-full" style={{ width: '20%' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Available Tier Upgrade Banner */}
        <div className="bg-[#eff4ff] border border-[#c7c4d8] rounded-xl p-5 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center gap-1.5 text-[#3525cd] mb-1">
              <span className="material-symbols-outlined text-[18px]">bolt</span>
              <span className="text-[11px] font-mono font-semibold tracking-wide">
                AVAILABLE SCALE PLAN
              </span>
            </div>
            <h3 className="text-[15px] font-semibold text-[#0b1c30] mb-2">
              Need more seats or concurrent runs?
            </h3>
            <div className="p-3 bg-white border border-[#c7c4d8]/60 rounded-lg mb-3">
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-[13px] font-semibold text-[#0b1c30]">50 Dev Scale Tier</span>
                <span className="text-[13px] font-mono text-[#3525cd] font-bold">$399/mo</span>
              </div>
              <ul className="space-y-1.5 text-[11px] text-[#565e74] mt-2">
                <li className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-[#005338]">add_circle</span>
                  <span>+30 developer seats</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-[#005338]">check</span>
                  <span>3x LangGraph agent concurrency</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-[#005338]">check</span>
                  <span>LangSmith execution tracing</span>
                </li>
              </ul>
            </div>
          </div>

          <button
            onClick={onNavigateToUpgrade}
            className="w-full h-9 rounded-lg bg-[#3525cd] hover:bg-[#4f46e5] text-white text-[12px] font-medium transition-colors flex items-center justify-center gap-1.5 active:scale-[0.98]"
          >
            <span>Request Upgrade</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Token to Run Estimator */}
        <div className="bg-white border border-[#c7c4d8] rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#c7c4d8]/40 mb-3">
            <div>
              <h2 className="text-[16px] font-semibold text-[#0b1c30]">Agent Run & Token Estimator</h2>
              <p className="text-[12px] text-[#565e74]">
                Calculate how many agent runs your LLM tokens roughly translate to.
              </p>
            </div>
            <span className="material-symbols-outlined text-[#3525cd] text-[20px]">calculate</span>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="text-[12px] font-semibold text-[#0b1c30] mb-1.5 block">Estimated Monthly Token Usage</label>
              <div className="relative">
                <input
                  type="number"
                  value={estimatedTokens}
                  onChange={(e) => setEstimatedTokens(Number(e.target.value))}
                  className="w-full h-9 pl-3 pr-10 rounded-lg border border-[#c7c4d8] text-[13px] font-mono text-[#0b1c30] focus:border-[#3525cd] focus:ring-1 focus:ring-[#3525cd]"
                />
                <span className="absolute right-3 top-2.5 text-[#565e74] text-[11px] font-mono">tokens</span>
              </div>
            </div>
            
            <div className="bg-[#f8f9ff] p-3 rounded-lg border border-[#c7c4d8]/40 flex items-center justify-between">
              <span className="text-[12px] text-[#565e74]">Average Cost per Run:</span>
              <span className="text-[13px] font-mono font-semibold text-[#0b1c30]">~{avgTokensPerRun.toLocaleString()} tokens</span>
            </div>

            <div className="pt-3 border-t border-[#c7c4d8]/40">
              <span className="text-[11px] uppercase tracking-wider text-[#565e74] font-medium font-mono">Estimated Output</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-[#006e4b] font-mono">{estimatedRuns.toLocaleString()}</span>
                <span className="text-[13px] text-[#565e74]">Runs / month</span>
              </div>
              <p className="text-[10px] text-[#777587] mt-1.5 leading-relaxed">
                * Note: Agent runs measure the actual autonomous tasks executed. A simple task might use 10k tokens, while a complex PR might use 200k. This is just a rough conversion estimate.
              </p>
            </div>
          </div>
        </div>

        {/* 4. Recent License Activity */}
        <div className="bg-white border border-[#c7c4d8] rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#c7c4d8]/40 mb-3">
            <div>
              <h2 className="text-[16px] font-semibold text-[#0b1c30]">Recent License Activity</h2>
              <p className="text-[12px] text-[#565e74]">
                Chronological audit trail of team membership and billing modifications.
              </p>
            </div>
            <span className="material-symbols-outlined text-[#565e74] text-[20px]">history</span>
          </div>

          <div className="divide-y divide-[#c7c4d8]/30 max-h-[300px] overflow-y-auto pr-2">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: activity.bg, color: activity.color }}
                  >
                    <span className="material-symbols-outlined text-[16px]">{activity.icon}</span>
                  </div>
                  <div className="flex flex-col">
                    {activity.title}
                    <span className="text-[11px] font-mono text-[#565e74]">{activity.subtitle}</span>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-[#565e74]">{activity.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
