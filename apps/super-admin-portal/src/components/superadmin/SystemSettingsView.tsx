import React, { useEffect, useState } from 'react';
import { usePlatform } from '../../context/PlatformContext';
import { api } from '../../api/client';

export const SystemSettingsView: React.FC = () => {
  const {
    minPasswordLength,
    setMinPasswordLength,
    requireSpecialChars,
    setRequireSpecialChars,
    enforceMfa,
    setEnforceMfa,
    sessionTimeout,
    setSessionTimeout,
    autoSuspendBilling,
    setAutoSuspendBilling,
    circuitBreaker,
    setCircuitBreaker,
    quotaThreshold,
    setQuotaThreshold,
    smtpHost,
    setSmtpHost,
    smtpPort,
    setSmtpPort,
    smtpUser,
    setSmtpUser,
    smtpPass,
    setSmtpPass,
    fromEmail,
    setFromEmail
  } = usePlatform();

  const [activeTab, setActiveTab] = useState<'general' | 'email' | 'quotas' | 'account'>('general');
  const [saveToast, setSaveToast] = useState(false);
  const [testPingStatus, setTestPingStatus] = useState<string | null>(null);
  const [testPingOk, setTestPingOk] = useState<boolean | null>(null);
  const [emailStatus, setEmailStatus] = useState<any>(null);

  const loadEmailStatus = async () => {
    try {
      setEmailStatus(await api.superAdmin.getEmailStatus());
    } catch (e) {
      console.error(e);
      setEmailStatus(null);
    }
  };

  useEffect(() => { loadEmailStatus(); }, []);
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSave = async () => {
    try {
      await api.superAdmin.updateSettings({
        min_password_length: minPasswordLength,
        require_special_chars: requireSpecialChars,
        enforce_mfa: enforceMfa,
        session_timeout: sessionTimeout,
        auto_suspend_billing: autoSuspendBilling,
        circuit_breaker: circuitBreaker,
        quota_threshold: quotaThreshold,
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_user: smtpUser,
        smtp_pass: smtpPass,
        from_email: fromEmail
      });
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 2500);
    } catch (e) {
      console.error(e);
      alert("Failed to save settings.");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      import('react-hot-toast').then(m => m.default.error("Passwords do not match"));
      return;
    }
    if (!currentPassword || !newPassword) {
      import('react-hot-toast').then(m => m.default.error("Please fill all fields"));
      return;
    }
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to change password');
      }
      
      import('react-hot-toast').then(m => m.default.success("Password changed successfully"));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      import('react-hot-toast').then(m => m.default.error(e.message || "An error occurred"));
    }
  };

  const handleTestPing = async () => {
    setTestPingStatus('Sending test email...');
    setTestPingOk(null);
    try {
      // No recipient: the API sends to the signed-in super admin's own address.
      const result = await api.superAdmin.testEmail();
      setTestPingOk(true);
      setTestPingStatus(result.message || 'Test email sent.');
    } catch (e: any) {
      console.error(e);
      setTestPingOk(false);
      setTestPingStatus(
        e?.response?.data?.detail || e?.message || 'Failed to send test email.'
      );
    } finally {
      loadEmailStatus();
    }
  };

  return (
    <div className="flex-1 pb-24 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 w-full">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono text-[#565e74] uppercase tracking-wider">Super Admin Console</span>
          <span className="text-[#565e74]">/</span>
          <span className="text-xs font-mono text-[#3525cd] font-medium">Settings</span>
        </div>
        <h1 className="text-2xl font-bold text-[#0b1c30]">System Settings & Security</h1>
        <p className="text-sm text-[#565e74] mt-1">
          Configure global authentication policies, email dispatch, and tenant guardrails.
        </p>
      </div>

      {saveToast && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-600">check_circle</span>
          <span>Platform security and dispatch configurations saved successfully!</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex items-center gap-5 sm:gap-6 border-b border-[#c7c4d8]/60 mb-6 sm:mb-8 overflow-x-auto no-scrollbar touch-scroll -mx-4 px-4 sm:mx-0 sm:px-0">
        <button
          onClick={() => setActiveTab('general')}
          className={`pb-3 text-xs font-mono font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-colors border-b-2 ${
            activeTab === 'general'
              ? 'text-[#3525cd] border-[#3525cd]'
              : 'text-[#565e74] border-transparent hover:text-[#0b1c30]'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">security</span>
          <span>General & Security</span>
        </button>

        <button
          onClick={() => setActiveTab('email')}
          className={`pb-3 text-xs font-mono font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-colors border-b-2 ${
            activeTab === 'email'
              ? 'text-[#3525cd] border-[#3525cd]'
              : 'text-[#565e74] border-transparent hover:text-[#0b1c30]'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">mail</span>
          <span>Email & SMTP</span>
        </button>

        <button
          onClick={() => setActiveTab('quotas')}
          className={`pb-3 text-xs font-mono font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-colors border-b-2 ${
            activeTab === 'quotas'
              ? 'text-[#3525cd] border-[#3525cd]'
              : 'text-[#565e74] border-transparent hover:text-[#0b1c30]'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">tune</span>
          <span>Tenant Quota Rules</span>
        </button>
        
        <button
          onClick={() => setActiveTab('account')}
          className={`pb-3 text-xs font-mono font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-colors border-b-2 ${
            activeTab === 'account'
              ? 'text-[#3525cd] border-[#3525cd]'
              : 'text-[#565e74] border-transparent hover:text-[#0b1c30]'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
          <span>My Account</span>
        </button>
      </div>

      {/* Settings Cards Stack */}
      <div className="space-y-6">
        {/* Card 1: Authentication & Password Policies */}
        {(activeTab === 'general' || activeTab === 'quotas') && (
          <section className="bg-white border border-[#c7c4d8]/60 rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-[#c7c4d8]/40 bg-[#eff4ff]/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[#3525cd] text-[20px]">lock_reset</span>
                <h2 className="text-sm font-semibold text-[#0b1c30]">Authentication & Password Policies</h2>
              </div>
              <span className="text-xs font-mono text-[#565e74] bg-white border border-[#c7c4d8] px-2 py-0.5 rounded">
                Tenant Strict
              </span>
            </div>

            <div className="p-6 space-y-5">
              {/* Row: Minimum Password Length */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#c7c4d8]/30">
                <div className="space-y-0.5 max-w-lg">
                  <label className="text-xs font-semibold text-[#0b1c30]">Minimum Password Length</label>
                  <p className="text-xs text-[#565e74]">
                    Set the floor length requirement across all tenant and administrator accounts.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="8"
                    max="64"
                    value={minPasswordLength}
                    onChange={(e) => setMinPasswordLength(Number(e.target.value))}
                    className="h-8 w-24 text-center font-mono text-xs bg-[#f8f9ff] border border-[#c7c4d8] rounded text-[#0b1c30] focus:border-[#3525cd]"
                  />
                  <span className="text-xs font-mono text-[#565e74]">characters</span>
                </div>
              </div>

              {/* Row: Special Characters Toggle */}
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#c7c4d8]/30">
                <div className="space-y-0.5 max-w-lg">
                  <div className="text-xs font-semibold text-[#0b1c30]">Require Special Characters & Numbers</div>
                  <p className="text-xs text-[#565e74]">
                    Enforces at least one numeral [0-9] and one non-alphanumeric token in credentials.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRequireSpecialChars(!requireSpecialChars)}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
                    requireSpecialChars ? 'bg-[#4f46e5]' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                      requireSpecialChars ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Row: Enforce MFA */}
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#c7c4d8]/30">
                <div className="space-y-0.5 max-w-lg">
                  <div className="text-xs font-semibold text-[#0b1c30]">
                    Enforce Multi-Factor Authentication (MFA) for All Admins
                  </div>
                  <p className="text-xs text-[#565e74]">
                    Require TOTP or FIDO2 WebAuthn keys for any identity assigned to Admin or Owner roles.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEnforceMfa(!enforceMfa)}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
                    enforceMfa ? 'bg-[#4f46e5]' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                      enforceMfa ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Row: Session Inactivity Timeout */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5 max-w-lg">
                  <label className="text-xs font-semibold text-[#0b1c30]">Session Inactivity Timeout</label>
                  <p className="text-xs text-[#565e74]">
                    Automatically terminate inactive dashboard and super-admin sessions.
                  </p>
                </div>
                <select
                  value={sessionTimeout}
                  onChange={(e) => setSessionTimeout(e.target.value)}
                  className="h-8 px-3 text-xs font-mono bg-[#f8f9ff] border border-[#c7c4d8] rounded text-[#0b1c30] focus:border-[#3525cd]"
                >
                  <option value="30m">30 minutes</option>
                  <option value="1h">1 hour</option>
                  <option value="4h">4 hours</option>
                </select>
              </div>
            </div>
          </section>
        )}

        {/* Card 2: Tenant Quota & Safety Guardrails */}
        {(activeTab === 'general' || activeTab === 'quotas') && (
          <section className="bg-white border border-[#c7c4d8]/60 rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-[#c7c4d8]/40 bg-[#eff4ff]/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[#3525cd] text-[20px]">shield</span>
                <h2 className="text-sm font-semibold text-[#0b1c30]">Tenant Quota & Safety Guardrails</h2>
              </div>
              <span className="text-xs font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                Active Enforcement
              </span>
            </div>

            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#c7c4d8]/30">
                <div className="space-y-0.5 max-w-lg">
                  <div className="text-xs font-semibold text-[#0b1c30]">
                    Auto-suspend tenant on billing grace period lapse
                  </div>
                  <p className="text-xs text-[#565e74]">
                    Grace period is locked at 7 business days following recurring payment decline.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoSuspendBilling(!autoSuspendBilling)}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
                    autoSuspendBilling ? 'bg-[#4f46e5]' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                      autoSuspendBilling ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#c7c4d8]/30">
                <div className="space-y-0.5 max-w-lg">
                  <div className="text-xs font-semibold text-[#0b1c30]">
                    LangGraph agent concurrency circuit-breaker
                  </div>
                  <p className="text-xs text-[#565e74]">
                    Halts multi-agent loops when graph step iterations exceed token consumption ceilings.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCircuitBreaker(!circuitBreaker)}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
                    circuitBreaker ? 'bg-[#4f46e5]' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                      circuitBreaker ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5 max-w-lg">
                  <label className="text-xs font-semibold text-[#0b1c30]">
                    Default tenant quota warning threshold
                  </label>
                  <p className="text-xs text-[#565e74]">
                    Dispatches automated email and webhook warnings to organization administrators.
                  </p>
                </div>
                <input
                  type="text"
                  value={quotaThreshold}
                  onChange={(e) => setQuotaThreshold(e.target.value)}
                  className="h-8 w-20 text-center font-mono text-xs bg-[#f8f9ff] border border-[#c7c4d8] rounded text-[#0b1c30] focus:border-[#3525cd]"
                />
              </div>
            </div>
          </section>
        )}

        {/* Card 3: Notification & SMTP Dispatch */}
        {(activeTab === 'general' || activeTab === 'email') && (
          <section className="bg-white border border-[#c7c4d8]/60 rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-[#c7c4d8]/40 bg-[#eff4ff]/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[#3525cd] text-[20px]">outgoing_mail</span>
                <h2 className="text-sm font-semibold text-[#0b1c30]">Notification & SMTP Dispatch</h2>
              </div>
              {(() => {
                const ok = emailStatus?.configured;
                const cls = ok
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-300';
                const dot = ok ? 'bg-emerald-600' : 'bg-amber-500';
                return (
                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-mono ${cls}`} title={emailStatus?.detail || ''}>
                    <span className={`w-1.5 h-1.5 rounded-full ${dot}`}></span>
                    <span>{emailStatus ? (emailStatus.label || 'Not configured') : 'Checking...'}</span>
                  </div>
                );
              })()}
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-mono text-[#565e74]">SMTP Host</label>
                  <div className="flex items-center">
                    <span className="h-8 px-2.5 bg-[#eff4ff] border border-r-0 border-[#c7c4d8] text-[#565e74] rounded-l flex items-center">
                      <span className="material-symbols-outlined text-[16px]">dns</span>
                    </span>
                    <input
                      type="text"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      className="h-8 w-full font-mono text-xs bg-[#f8f9ff] border border-[#c7c4d8] rounded-r text-[#0b1c30] px-2.5"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-[#565e74]">SMTP Port</label>
                  <div className="flex items-center">
                    <span className="h-8 px-2.5 bg-[#eff4ff] border border-r-0 border-[#c7c4d8] text-[#565e74] rounded-l flex items-center">
                      <span className="material-symbols-outlined text-[16px]">numbers</span>
                    </span>
                    <input
                      type="text"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                      className="h-8 w-full font-mono text-xs bg-[#f8f9ff] border border-[#c7c4d8] rounded-r text-[#0b1c30] px-2.5"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-mono text-[#565e74]">SMTP User</label>
                  <div className="flex items-center">
                    <span className="h-8 px-2.5 bg-[#eff4ff] border border-r-0 border-[#c7c4d8] text-[#565e74] rounded-l flex items-center">
                      <span className="material-symbols-outlined text-[16px]">person</span>
                    </span>
                    <input
                      type="text"
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value)}
                      className="h-8 w-full font-mono text-xs bg-[#f8f9ff] border border-[#c7c4d8] rounded-r text-[#0b1c30] px-2.5"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-mono text-[#565e74]">SMTP Password</label>
                  <div className="flex items-center">
                    <span className="h-8 px-2.5 bg-[#eff4ff] border border-r-0 border-[#c7c4d8] text-[#565e74] rounded-l flex items-center">
                      <span className="material-symbols-outlined text-[16px]">key</span>
                    </span>
                    <input
                      type="password"
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                      className="h-8 w-full font-mono text-xs bg-[#f8f9ff] border border-[#c7c4d8] rounded-r text-[#0b1c30] px-2.5"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-mono text-[#565e74]">From Email Dispatcher</label>
                  <div className="flex items-center">
                    <span className="h-8 px-2.5 bg-[#eff4ff] border border-r-0 border-[#c7c4d8] text-[#565e74] rounded-l flex items-center">
                      <span className="material-symbols-outlined text-[16px]">alternate_email</span>
                    </span>
                    <input
                      type="email"
                      value={fromEmail}
                      onChange={(e) => setFromEmail(e.target.value)}
                      className="h-8 w-full font-mono text-xs bg-[#f8f9ff] border border-[#c7c4d8] rounded-r text-[#0b1c30] px-2.5"
                    />
                  </div>
                </div>
              </div>

              {emailStatus && !emailStatus.configured && (
                <div className="p-2.5 bg-amber-50 border border-amber-300 text-amber-900 text-xs rounded">
                  No mail transport is configured, so no email is being sent.
                  Set <span className="font-mono">BREVO_API_KEY</span> (or
                  <span className="font-mono"> RESEND_API_KEY</span>) in the backend
                  environment, or fill in the SMTP fields above.
                </div>
              )}

              {emailStatus?.configured && emailStatus.transport !== 'smtp' && (
                <div className="p-2.5 bg-[#eff4ff] border border-[#c7c4d8] text-[#565e74] text-xs rounded">
                  {emailStatus.detail} Sending as
                  <strong className="text-[#0b1c30] font-mono"> {emailStatus.from_email}</strong>.
                </div>
              )}

              {testPingStatus && (
                <div
                  className={`p-2.5 border text-xs rounded font-mono ${
                    testPingOk === false
                      ? 'bg-red-50 border-red-300 text-red-800'
                      : testPingOk
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-[#eff4ff] border-[#c7c4d8] text-[#565e74]'
                  }`}
                >
                  {testPingStatus}
                </div>
              )}

              <div className="p-3 rounded-lg bg-[#f8f9ff] border border-[#c7c4d8]/60 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-[#565e74]">
                  {(() => {
                    const last = emailStatus?.last_delivery;
                    if (!last) {
                      return (
                        <>
                          <span className="material-symbols-outlined text-[16px] text-[#565e74]">schedule</span>
                          <span>No email has been sent since this backend instance started.</span>
                        </>
                      );
                    }
                    const when = new Date(last.at).toLocaleString();
                    return (
                      <>
                        <span className={`material-symbols-outlined text-[16px] ${last.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                          {last.ok ? 'verified' : 'error'}
                        </span>
                        <span>
                          Last send {last.ok ? 'delivered to' : 'FAILED for'}{' '}
                          <strong className="text-[#0b1c30] font-mono">{last.to}</strong> at {when}
                          {!last.ok && <span className="block text-red-700 mt-0.5">{last.detail}</span>}
                        </span>
                      </>
                    );
                  })()}
                </div>
                <button
                  type="button"
                  onClick={handleTestPing}
                  className="text-[#3525cd] hover:underline text-xs font-mono font-medium cursor-pointer whitespace-nowrap"
                >
                  Send Test Email
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Card: Account Settings */}
        {activeTab === 'account' && (
          <section className="bg-white border border-[#c7c4d8]/60 rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-[#c7c4d8]/40 bg-[#eff4ff]/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[#3525cd]">manage_accounts</span>
                <div>
                  <h3 className="text-[16px] font-semibold text-[#0b1c30]">Change Password</h3>
                  <p className="text-xs text-[#565e74]">Update your super admin account password.</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
                <div>
                  <label className="block text-xs font-mono text-[#565e74] mb-1">Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-[#f8f9ff] border border-[#c7c4d8] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#3525cd]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-[#565e74] mb-1">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-[#f8f9ff] border border-[#c7c4d8] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#3525cd]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-[#565e74] mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-[#f8f9ff] border border-[#c7c4d8] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#3525cd]"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#3525cd] text-white rounded-lg text-xs font-semibold hover:bg-[#281b9e] transition-colors"
                >
                  Update Password
                </button>
              </form>
            </div>
          </section>
        )}
      </div>

      {/* Sticky Bottom Action Bar */}
      <aside
        className="fixed bottom-0 right-0 left-0 lg:left-60 bg-white/95 backdrop-blur border-t border-[#c7c4d8] px-4 sm:px-6 lg:px-8 py-3 sm:py-3.5 flex items-center justify-between gap-3 z-20 shadow-[0_-4px_12px_rgba(11,28,48,0.06)]"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="hidden sm:flex items-center gap-2 text-[#565e74] text-xs font-mono min-w-0">
          <span className="material-symbols-outlined text-[16px] text-emerald-600 shrink-0">check_circle</span>
          <span className="truncate">All current changes are staged in local cache.</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={() => alert("Discarded unsaved setting modifications")}
            className="flex-1 sm:flex-none px-4 py-2 sm:py-1.5 text-xs font-mono text-[#565e74] hover:text-[#0b1c30] border border-[#c7c4d8] rounded-lg bg-white hover:bg-[#f8f9ff] cursor-pointer transition-colors"
          >
            Discard Changes
          </button>
          <button
            onClick={handleSave}
            className="flex-1 sm:flex-none justify-center px-5 py-2 sm:py-1.5 text-xs font-mono font-semibold text-white bg-[#4f46e5] hover:bg-[#3525cd] rounded-lg shadow-sm flex items-center gap-2 cursor-pointer active:scale-[0.98] transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">save</span>
            <span>Save Settings</span>
          </button>
        </div>
      </aside>
    </div>
  );
};
