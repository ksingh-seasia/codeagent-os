import React, { useState } from 'react';
import { DeveloperModal } from './DeveloperModal';
import { usePlatform } from '../../context/PlatformContext';



export const TenantOverview: React.FC = () => {
  const {
    currentCompany,
    currentTenantDevelopers,
    addDeveloperSeat,
    updateDeveloperSeat,
    revokeDeveloperSeat,
    setTenantAdminPage
  } = usePlatform();

  const [devName, setDevName] = useState('');
  const [devEmail, setDevEmail] = useState('');
  const [devRole, setDevRole] = useState<'Developer' | 'Senior Dev' | 'Staff Dev' | 'Lead'>('Developer');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const [isProvisionModalOpen, setIsProvisionModalOpen] = useState(false);
  const [manageDrawerDev, setManageDrawerDev] = useState<any | null>(null);

  React.useEffect(() => {
    const handleOpen = () => setIsProvisionModalOpen(true);
    window.addEventListener('open-invite-developer-modal', handleOpen);
    return () => window.removeEventListener('open-invite-developer-modal', handleOpen);
  }, []);

  const totalSeats = currentCompany.totalLicenses;
  const usedSeats = currentTenantDevelopers.length;
  const remainingSeats = Math.max(0, totalSeats - usedSeats);
  const usedPercent = totalSeats > 0 ? Math.min(100, Math.round((usedSeats / totalSeats) * 100)) : 0;

  const handleAddDeveloper = (e: React.FormEvent) => {
    e.preventDefault();
    if (remainingSeats <= 0) {
      alert("License quota reached! Please upgrade your plan tier in License Usage.");
      return;
    }
    addDeveloperSeat({
      name: devName,
      email: devEmail,
      role: devRole
    });
    setToastMessage(`Seat provisioned for ${devName} (${devEmail})! Credentials dispatched.`);
    setDevName('');
    setDevEmail('');
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto flex flex-col gap-5 sm:gap-6">
      {/* Breadcrumbs & Title */}
      <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-[#c7c4d8]/40">
        <div>
          <div className="flex items-center gap-2 text-[#565e74] text-xs font-mono mb-1">
            <span>{currentCompany.name} Inc.</span>
            <span>/</span>
            <span className="text-[#3525cd] font-semibold">Organization Console</span>
            <span>/</span>
            <span>Section 9</span>
          </div>
          <h1 className="text-2xl font-bold text-[#0b1c30] tracking-tight">
            {currentCompany.name} Organization Overview & Team Management
          </h1>
          <p className="text-sm text-[#565e74] mt-1">
            Manage developer seats, monitor LangGraph AI license consumption, and assign project access.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => {
              const headers = "Developer,Email,Role,Status,AddedOn\n";
              const rows = currentTenantDevelopers.map(d => `"${d.name}","${d.email}","${d.role}","${d.status}","${d.addedDate}"`).join("\n");
              const blob = new Blob([headers + rows], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${currentCompany.id}_audit_log.csv`;
              a.click();
            }}
            className="flex items-center gap-1.5 bg-white border border-[#c7c4d8] hover:bg-[#eff4ff] text-[#0b1c30] text-xs font-mono px-3 py-2 rounded-lg font-medium shadow-sm transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>Export Audit Log</span>
          </button>
          <button
            onClick={() => setIsProvisionModalOpen(true)}
            className="flex items-center gap-1.5 bg-[#4f46e5] text-white hover:bg-[#3525cd] text-xs font-mono px-3.5 py-2 rounded-lg font-semibold shadow-sm transition-transform active:scale-[0.98] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Add Developer</span>
          </button>
        </div>
      </section>

      {toastMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-600 text-[16px]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* License Usage Hero Section */}
      <section className="bg-white border border-[#c7c4d8]/60 rounded-xl p-6 shadow-sm" id="license-usage">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 border-b border-[#c7c4d8]/30 pb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-[#4f46e5] text-xl shrink-0">token</span>
            <h2 className="text-sm font-semibold text-[#0b1c30]">LangGraph AI License Usage & Allocation ({currentCompany.licensePlanTier})</h2>
          </div>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#eff4ff] text-[#0b1c30]">
            Billing Cycle: Monthly (Renews in 18 days)
          </span>
        </div>

        {/* Bento Grid: Metric Row + Circular Gauge + Usage Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Metric Blocks (Left, col-4) */}
          <div className="lg:col-span-4 grid grid-cols-3 gap-3">
            <div className="bg-[#f8f9ff] border border-[#c7c4d8]/60 rounded-lg p-3 flex flex-col justify-between">
              <span className="text-[11px] font-mono text-[#565e74]">Total License</span>
              <span className="text-2xl font-bold text-[#0b1c30] mt-2">{totalSeats}</span>
              <span className="text-[10px] text-[#565e74] mt-1 font-mono">Tier Quota</span>
            </div>

            <div className="bg-[#f8f9ff] border border-[#c7c4d8]/60 rounded-lg p-3 flex flex-col justify-between">
              <span className="text-[11px] font-mono text-[#3525cd]">Used</span>
              <span className="text-2xl font-bold text-[#3525cd] mt-2">{usedSeats}</span>
              <span className="text-[10px] text-[#565e74] mt-1 font-mono">{usedPercent}% Allocation</span>
            </div>

            <div className="bg-[#f8f9ff] border border-[#c7c4d8]/60 rounded-lg p-3 flex flex-col justify-between">
              <span className="text-[11px] font-mono text-emerald-700">Remaining</span>
              <span className="text-2xl font-bold text-emerald-700 mt-2">{remainingSeats}</span>
              <span className="text-[10px] text-emerald-700 mt-1 font-mono">Seats Available</span>
            </div>
          </div>

          {/* Circular / Radial Progress Chart (Center, col-4) */}
          <div className="lg:col-span-4 flex items-center justify-center p-2">
            <div className="relative flex items-center justify-center w-36 h-36">
              <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                <circle cx="50" cy="50" fill="transparent" r="40" stroke="#E2E8F0" strokeWidth="9" />
                <circle
                  cx="50"
                  cy="50"
                  fill="transparent"
                  r="40"
                  stroke="#4F46E5"
                  strokeDasharray={`${(usedPercent / 100) * 251.32} 251.32`}
                  strokeLinecap="round"
                  strokeWidth="9"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-bold text-[#0b1c30] leading-none">{usedPercent}%</span>
                <span className="text-[11px] font-mono text-[#565e74] mt-0.5">Used</span>
              </div>
            </div>

            <div className="ml-4 flex flex-col gap-1.5 text-xs font-mono">
              <div className="flex items-center gap-1.5 text-[#0b1c30]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#4f46e5]"></span>
                <span className="font-medium">Assigned Seats</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#565e74]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#c7c4d8]"></span>
                <span>Unallocated</span>
              </div>
              <div className="flex items-center gap-1 mt-1 text-emerald-700">
                <span className="material-symbols-outlined text-[15px]">check_circle</span>
                <span>Normal Capacity</span>
              </div>
            </div>
          </div>

          {/* Quick Banner & Execution Note (Right, col-4) */}
          <div className="lg:col-span-4 bg-[#eff4ff] border border-[#c7c4d8]/60 rounded-lg p-3.5 flex flex-col justify-between">
            <div className="flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[#3525cd] mt-0.5">info</span>
              <div>
                <h4 className="text-xs font-semibold text-[#0b1c30]">Seat Utilization Status</h4>
                <p className="text-xs text-[#565e74] mt-1 leading-relaxed">
                  <strong>{remainingSeats} of {totalSeats} developer seats available.</strong> Add team members to grant access to AI Jira automated execution and PR generation pipelines.
                </p>
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-[#c7c4d8]/40 flex items-center justify-between text-[11px] font-mono">
              <span className="text-[#565e74]">Agent Rate Limit: 1,000 runs/hr</span>
              <button onClick={() => setTenantAdminPage('license-usage')} className="text-[#3525cd] hover:underline font-semibold cursor-pointer">
                Upgrade Tier →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Developer Members Management Section */}
      <section className="flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-[#0b1c30]">Developers</h2>
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-[#3525cd]/10 text-[#3525cd] font-semibold border border-[#3525cd]/20">
              {currentTenantDevelopers.length} Active
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-[#c7c4d8] bg-white p-0.5 text-xs font-mono">
              <button className="px-2.5 py-1 rounded bg-[#dae2fd] text-[#131b2e] font-semibold">
                All Seats ({currentTenantDevelopers.length})
              </button>
            </div>
          </div>
        </div>

        {/* Card: Inline 'Add Developer' Form */}
        <div className="bg-white border border-[#c7c4d8]/60 rounded-xl p-5 shadow-sm" id="add-dev-form">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#3525cd] text-xl">group_add</span>
              <h3 className="text-sm font-semibold text-[#0b1c30]">Provision New Developer Seat</h3>
            </div>
            <span className="text-xs font-mono text-[#565e74]">
              Consumes 1 of {remainingSeats} remaining licenses
            </span>
          </div>

          <form onSubmit={handleAddDeveloper} className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
            <div className="md:col-span-3 flex flex-col gap-1">
              <label className="text-xs font-mono text-[#565e74] font-medium">Full Name</label>
              <input
                type="text"
                required
                value={devName}
                onChange={(e) => setDevName(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full h-8 px-3 text-xs bg-white border border-[#c7c4d8] rounded focus:border-[#4f46e5]"
              />
            </div>

            <div className="md:col-span-4 flex flex-col gap-1">
              <label className="text-xs font-mono text-[#565e74] font-medium">Work Email</label>
              <input
                type="email"
                required
                value={devEmail}
                onChange={(e) => setDevEmail(e.target.value)}
                placeholder="john@techcorp.com"
                className="w-full h-8 px-3 text-xs font-mono bg-white border border-[#c7c4d8] rounded focus:border-[#4f46e5]"
              />
            </div>

            <div className="md:col-span-3 flex flex-col gap-1">
              <label className="text-xs font-mono text-[#565e74] font-medium">Permission Tier</label>
              <select
                value={devRole}
                onChange={(e) => setDevRole(e.target.value as any)}
                className="w-full h-8 px-2 text-xs font-mono bg-white border border-[#c7c4d8] rounded focus:border-[#4f46e5]"
              >
                <option value="Lead">Lead / Principal</option>
                <option value="Staff Dev">Staff Dev</option>
                <option value="Senior Dev">Senior Dev</option>
                <option value="Developer">Developer</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                className="w-full h-8 flex items-center justify-center gap-1.5 bg-[#4f46e5] hover:bg-[#3525cd] text-white text-xs font-mono font-semibold rounded shadow-sm transition-all active:scale-[0.98] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">send</span>
                <span>Send Credentials</span>
              </button>
            </div>
          </form>
        </div>

        {/* Recent Developers Table */}
        <div className="bg-white border border-[#c7c4d8]/60 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-[#c7c4d8]/40 flex items-center justify-between bg-[#f8f9ff]">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[#0b1c30]">Assigned Developer Roster</span>
              <span className="text-xs font-mono text-[#565e74]">
                ({currentTenantDevelopers.length} developers active)
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-[#565e74]">Auto-sync GitHub Team:</span>
              <span className="text-emerald-700 font-semibold">{currentCompany.id}-core-ai</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] md:min-w-0 text-left border-collapse">
              <thead>
                <tr className="bg-[#f8f9ff] border-b border-[#c7c4d8]/40 text-xs font-mono text-[#565e74] uppercase">
                  <th className="py-2.5 px-4 font-semibold">Developer</th>
                  <th className="py-2.5 px-4 font-semibold">Email</th>
                  <th className="py-2.5 px-4 font-semibold">Role</th>
                  <th className="py-2.5 px-4 font-semibold">Status</th>
                  <th className="py-2.5 px-4 font-semibold">Added On</th>
                  <th className="py-2.5 px-4 font-semibold">Integrations</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c7c4d8]/30 text-xs">
                {currentTenantDevelopers.slice(0, 10).map((dev) => (
                  <tr key={dev.id} className="hover:bg-[#f8f9ff] transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#4f46e5]/10 text-[#3525cd] flex items-center justify-center font-mono font-bold text-xs">
                          {dev.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-[#0b1c30]">{dev.name}</span>
                          <span className="text-[10px] font-mono text-[#777587]">{dev.devTag}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-[#0b1c30]">{dev.email}</td>

                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-[#eff4ff] text-[#0b1c30] border border-[#c7c4d8]/40">
                        {dev.role}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        {dev.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono text-[#565e74]">{dev.addedDate}</td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {dev.integrations?.length ? (
                          dev.integrations.map((integration: string, idx: number) => (
                            <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#eff4ff] border border-[#c7c4d8]/60 font-mono text-[10px] text-[#0b1c30]">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {integration}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-[#565e74] italic">None Configured</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => setManageDrawerDev(dev)}
                          className="px-2 py-1 text-xs font-mono text-[#3525cd] hover:underline cursor-pointer"
                        >
                          Manage Seat
                        </button>
                        <button
                          onClick={() => revokeDeveloperSeat(dev.id)}
                          className="px-2 py-1 text-xs font-mono text-rose-700 hover:text-rose-900 cursor-pointer"
                        >
                          Revoke
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <DeveloperModal isOpen={isProvisionModalOpen} onClose={() => setIsProvisionModalOpen(false)} onSave={(dev) => addDeveloperSeat(dev)} />
      <DeveloperModal isOpen={!!manageDrawerDev} developer={manageDrawerDev} onClose={() => setManageDrawerDev(null)} onSave={(dev) => updateDeveloperSeat(manageDrawerDev.id, dev)} />
      {/* Footer */}
      <footer className="mt-4 pt-4 border-t border-[#c7c4d8]/40 flex flex-col sm:flex-row items-center justify-between text-xs text-[#565e74] gap-2 font-mono">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[#0b1c30]">{currentCompany.name} Workspace</span>
          <span>•</span>
          <span>LangGraph Microservice Mesh Node #{currentCompany.id.toUpperCase()}-EAST-1</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-emerald-700 font-semibold">SOC2 Type II Active</span>
          <span>•</span>
          <span>Argon2id Hash</span>
        </div>
      </footer>

    </div>
  );
};
