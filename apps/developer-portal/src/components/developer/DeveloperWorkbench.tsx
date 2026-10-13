import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { usePlatform } from '../../context/PlatformContext';

export const DeveloperWorkbench: React.FC = () => {
  const {
    currentCompany,
    currentTenantTickets,
    selectedTicketKey,
    setSelectedTicketKey,
    agentRunningTicketKey,
    agentStepIndex,
    agentLogs,
    isStreaming,
    pendingApproval,
    triggerAgentRun,
    resumeAgentRun,
    resumeAgentExecution,
    cancelAgentRun,
    approvePullRequest,
    setDeveloperPage,
    selectedProjectKey,
    setActiveTicketsCount,
    tickets,
    executionRuns,
    fetchExecutionHistory,
    anthropicStatus
  } = usePlatform();

  const [ticketSearch, setTicketSearch] = useState('');
  // On < lg screens the workbench behaves as list -> detail; on desktop both panes are visible.
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  // Below lg the detail view is split into two tabs so the terminal gets the full screen height.
  const [mobileDetailTab, setMobileDetailTab] = useState<'progress' | 'terminal'>('progress');

  // When an agent run starts streaming, jump straight to its live terminal on phones / tablets.
  useEffect(() => {
    if (isStreaming && agentRunningTicketKey) {
      setMobileShowDetail(true);
      setMobileDetailTab('terminal');
    }
  }, [isStreaming, agentRunningTicketKey]);

  const ensureAnthropicConnected = (): boolean => {
    if (anthropicStatus && !anthropicStatus.connected) {
      toast.error("Please connect your Anthropic API key in Integrations before executing the AI agent.");
      setDeveloperPage('integrations');
      return false;
    }
    return true;
  };

  // A plan waiting for approval lives on the progress tab - surface it.
  useEffect(() => {
    if (pendingApproval) setMobileDetailTab('progress');
  }, [pendingApproval]);
  const [copySuccess, setCopySuccess] = useState(false);
  const [apiTickets, setApiTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [githubRepos, setGithubRepos] = useState<any[]>([]);
  const [ticketRepoSelections, setTicketRepoSelections] = useState<Record<string, string>>({});

  // In-app Feedback Modal state (replaces browser prompt)
  const [feedbackModal, setFeedbackModal] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    promptText: string;
    placeholder?: string;
    ticketKey: string;
    mode: 'plan_rejection' | 'pr_revision';
  }>({
    isOpen: false,
    title: '',
    subtitle: '',
    promptText: '',
    placeholder: '',
    ticketKey: '',
    mode: 'plan_rejection'
  });
  const [feedbackInput, setFeedbackInput] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  // In-app Confirmation Dialog state (replaces browser window.confirm)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    ticketKey?: string;
    confirmLabel?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const handleRequestRevisions = (ticketKey: string) => {
    setFeedbackInput('');
    setFeedbackModal({
      isOpen: true,
      title: 'Request PR Revisions',
      subtitle: `Ticket: ${ticketKey}`,
      promptText: 'Enter feedback or instructions for the agent to revise the pull request code:',
      placeholder: 'e.g., Fix form styling, add remember-me persistence, update validation...',
      ticketKey,
      mode: 'pr_revision'
    });
  };
  const [repoBranchesCache, setRepoBranchesCache] = useState<Record<string, any[]>>({});

  const handleRepoChange = async (ticketKey: string, repoFullName: string) => {
    setTicketRepoSelections(prev => ({ ...prev, [ticketKey]: repoFullName }));
    if (repoFullName && !repoBranchesCache[repoFullName]) {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/developer/integrations/github/repos/${repoFullName}/branches`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
        });
        const data = await res.json();
        if (Array.isArray(data)) {
          setRepoBranchesCache(prev => ({ ...prev, [repoFullName]: data }));
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  useEffect(() => {
    // Only fetch if a project is selected (or if we want to fetch all when null, but backend handles it)
    const projectQuery = selectedProjectKey ? `?project_key=${selectedProjectKey}` : '';
    setLoading(true);
    setApiTickets([]); // Clear old tickets
    fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1"}/developer/tickets${projectQuery}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
    })
      .then((r) => r.json())
      .then((json) => {
        const data = json.data || [];
        const t = Array.isArray(data) ? data : [];
        setApiTickets(t);
        setActiveTicketsCount(t.filter((x: any) => x.fields?.status?.name !== 'Completed' && x.fields?.status?.name !== 'Done').length);
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    fetchExecutionHistory(1);
  }, [selectedProjectKey]);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/developer/integrations/github/repos`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
    })
      .then(r => r.json())
      .then(data => {
        setGithubRepos(Array.isArray(data) ? data : []);
      })
      .catch(console.error);
  }, []);

  const normalizedTickets = apiTickets.map(t => {
    const localTicket = tickets.find(local => local.key === t.key);
    const runForTicket = executionRuns.find(run => run.ticketKey === t.key);

    let prUrl = runForTicket?.prUrl || localTicket?.prUrl || (t as any).prUrl || null;
    let prNumber = null;
    let targetRepo = runForTicket?.targetRepo || (localTicket as any)?.targetRepo || (t as any).targetRepo || null;

    if (prUrl) {
      try {
        const parts = prUrl.split('/');
        prNumber = parts[parts.length - 1];
      } catch (e) {}
    }

    const isThisTicketRunning = isStreaming && agentRunningTicketKey === t.key;

    let derivedStatus = t.fields?.status?.name || 'To Do';

    if (isThisTicketRunning) {
      derivedStatus = 'In Progress';
    } else if (prUrl) {
      derivedStatus = (runForTicket?.status === 'Merged') ? 'Completed' : 'PR Ready';
    } else if (runForTicket && (runForTicket.status === 'Completed' || runForTicket.status === 'Merged')) {
      derivedStatus = 'Completed';
    } else if (localTicket?.status) {
      derivedStatus = localTicket.status;
    } else if (t.fields?.status?.name) {
      derivedStatus = t.fields.status.name;
    }

    return {
      key: t.key,
      title: t.fields?.summary || 'Untitled Ticket',
      description: typeof t.fields?.description === 'string' ? t.fields.description : (t.fields?.description?.content?.[0]?.content?.[0]?.text || 'No description provided.'),
      priority: t.fields?.priority?.name || 'Medium',
      status: derivedStatus,
      fileTarget: 'Unknown',
      issuetype: t.fields?.issuetype?.name || 'Task',
      parentKey: t.fields?.parent?.key || null,
      prUrl: prUrl,
      prNumber: prNumber || (localTicket as any)?.prNumber,
      targetRepo: targetRepo
    };
  });

  const selectedTicket = normalizedTickets.find((t) => t.key === selectedTicketKey) || normalizedTickets[0];

  const filteredTickets = normalizedTickets.filter((t) =>
    t.title.toLowerCase().includes(ticketSearch.toLowerCase()) ||
    t.key.toLowerCase().includes(ticketSearch.toLowerCase())
  );

  const topLevelTickets = filteredTickets.filter(t => !t.parentKey);
  const [expandedTickets, setExpandedTickets] = useState<Set<string>>(new Set());
  
  const toggleExpand = (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    setExpandedTickets(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isRunningCurrentTicket = Boolean(
    selectedTicket && isStreaming && agentRunningTicketKey === selectedTicket.key
  );

  const runForSelected = selectedTicket
    ? executionRuns.find((run) => run.ticketKey === selectedTicket.key)
    : null;

  const isTicketCompleted = Boolean(
    selectedTicket && !isRunningCurrentTicket && (
      selectedTicket.status === 'PR Ready' ||
      selectedTicket.status === 'Completed' ||
      selectedTicket.status === 'Done' ||
      selectedTicket.status === 'Merged' ||
      Boolean(selectedTicket.prUrl) ||
      Boolean((selectedTicket as any).prNumber) ||
      Boolean(runForSelected && (runForSelected.status === 'Completed' || runForSelected.status === 'Merged' || Boolean(runForSelected.prUrl)))
    )
  );

  const step1State: 'done' | 'active' | 'pending' = isRunningCurrentTicket
    ? (agentStepIndex === 0 ? 'active' : 'done')
    : 'done';

  const step2State: 'done' | 'active' | 'pending' = isTicketCompleted
    ? 'done'
    : isRunningCurrentTicket
    ? (agentStepIndex === 1 && (isStreaming || pendingApproval) ? 'active' : agentStepIndex > 1 ? 'done' : 'pending')
    : 'pending';

  const step3State: 'done' | 'active' | 'pending' = isTicketCompleted
    ? 'done'
    : isRunningCurrentTicket
    ? (agentStepIndex === 2 && isStreaming ? 'active' : agentStepIndex > 2 ? 'done' : 'pending')
    : 'pending';

  const step4State: 'done' | 'active' | 'pending' = isTicketCompleted
    ? 'done'
    : isRunningCurrentTicket
    ? (agentStepIndex === 3 ? 'active' : agentStepIndex >= 4 ? 'done' : 'pending')
    : 'pending';

  const step5State: 'done' | 'active' | 'pending' = isTicketCompleted
    ? 'done'
    : isRunningCurrentTicket
    ? (agentStepIndex >= 4 && isStreaming ? 'active' : agentStepIndex >= 4 && !isStreaming ? 'done' : 'pending')
    : 'pending';

  const pipelineSteps: { label: string; state: 'done' | 'active' | 'pending' }[] = [
    { label: 'Ticket', state: step1State },
    { label: 'Plan', state: step2State },
    { label: 'Code', state: step3State },
    { label: 'Commit', state: step4State },
    { label: 'PR', state: step5State },
  ];
  const doneSteps = pipelineSteps.filter((st) => st.state === 'done').length;

  const handleCopyLogs = () => {
    const text = agentLogs.map((l) => `[${l.timestamp}] ${l.level}: ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#f8f9ff]">
      {/* 2-Column Split Workspace */}
      <main className="flex-1 grid grid-cols-12 grid-rows-[minmax(0,1fr)] gap-0 overflow-hidden min-h-0">
        {/* Left Column: Tickets List */}
        <section className={`${mobileShowDetail ? 'hidden lg:flex' : 'flex'} col-span-12 lg:col-span-4 lg:border-r border-[#c7c4d8]/60 bg-white flex-col min-h-0`}>
          {/* Header & Quick Search */}
          <div className="p-3 sm:p-4 border-b border-[#c7c4d8]/60 space-y-2.5 bg-[#f8f9ff]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#565e74] text-[18px]">receipt_long</span>
              <h2 className="text-sm font-semibold text-[#0b1c30]">My Assigned Tickets</h2>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 bg-[#eff4ff] text-[#565e74] rounded border border-[#c7c4d8]/40">
                {normalizedTickets.length} Active
              </span>
            </div>

            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[#777587] text-[16px]">
                filter_list
              </span>
              <input
                type="text"
                placeholder="Filter current sprint tickets..."
                value={ticketSearch}
                onChange={(e) => setTicketSearch(e.target.value)}
                className="w-full h-9 lg:h-8 pl-8 pr-3 text-xs bg-white rounded-lg border border-[#c7c4d8] text-[#0b1c30] placeholder:text-[#777587] focus:outline-none focus:border-[#3525cd] focus:ring-2 focus:ring-[#3525cd]/15 transition-shadow"
              />
            </div>
          </div>

          {/* Ticket Items Scrollable List */}
          <div className="flex-1 overflow-y-auto touch-scroll divide-y divide-[#c7c4d8]/40 relative min-h-[200px]">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10">
                <div className="flex items-center gap-2 text-[#3525cd] font-mono text-xs">
                  <span className="material-symbols-outlined animate-spin">refresh</span>
                  Syncing with Jira...
                </div>
              </div>
            ) : null}
            
            {topLevelTickets.length > 0 ? (
              topLevelTickets.map((ticket) => {
              const isSelected = selectedTicketKey === ticket.key;
              const isExpanded = expandedTickets.has(ticket.key);
              const childTickets = filteredTickets.filter(t => t.parentKey === ticket.key);
              const hasChildren = childTickets.length > 0;
              
              // Only allow execution on leaves (sub-tasks) OR top-level tickets that have no sub-tasks.
              const canExecuteAI = !hasChildren;
              const isRunning = agentRunningTicketKey === ticket.key && isStreaming;

              return (
                <div key={ticket.key} className="divide-y divide-[#c7c4d8]/20 border-b border-[#c7c4d8]/40">
                  <article
                    onClick={() => { setSelectedTicketKey(ticket.key); setMobileShowDetail(true); }}
                    className={`p-3 sm:p-4 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#eff4ff] border-l-4 border-l-[#3525cd]'
                        : 'hover:bg-[#f8f9ff]'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 mb-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {hasChildren && (
                          <button 
                            onClick={(e) => toggleExpand(e, ticket.key)}
                            className="w-6 h-6 lg:w-5 lg:h-5 flex items-center justify-center rounded-sm hover:bg-slate-200 text-slate-500"
                            aria-label={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
                          >
                            <span className="material-symbols-outlined text-[16px] transition-transform" style={{ transform: isExpanded ? 'rotate(90deg)' : ''}}>
                              chevron_right
                            </span>
                          </button>
                        )}
                        <span className="px-1.5 py-0.5 text-[11px] font-mono font-bold rounded bg-[#3525cd] text-white">
                          {ticket.key}
                        </span>
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-200 text-slate-700 uppercase tracking-wider">
                          {(ticket as any).issuetype || 'Task'}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-[11px] font-mono font-semibold rounded flex items-center gap-1 ${
                            ticket.status === 'In Progress'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : ticket.status === 'Completed'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                          }`}
                        >
                          {ticket.status === 'In Progress' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                          )}
                          {ticket.status}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-[#777587]">Priority: {ticket.priority}</span>
                    </div>

                    <h3 className="text-[13px] lg:text-xs font-semibold text-[#0b1c30] mb-1 break-words">{ticket.title}</h3>
                    <p className="text-xs text-[#565e74] line-clamp-2 mb-3">{ticket.description}</p>

                    <div className="pt-2">
                      <div className="flex items-center gap-1 text-[11px] font-mono text-[#565e74] mb-2 min-w-0">
                        <span className="material-symbols-outlined text-[14px] shrink-0">commit</span>
                        <span className="truncate">{ticket.fileTarget}</span>
                      </div>

                      {canExecuteAI && (
                        isRunning ? (
                          <span className="h-7 px-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 font-mono text-[11px] flex items-center gap-1.5 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse"></span>
                            <span>Running...</span>
                          </span>
                        ) : (ticket.status === 'PR Ready' || ticket.status === 'Completed' || ticket.status === 'Done' || Boolean(ticket.prUrl)) ? (
                          <div className="flex flex-col gap-2 mt-1">
                            <span className="h-7 px-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono text-[11px] flex items-center justify-between gap-1.5 font-semibold">
                              <div className="flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                <span>Agent execution completed</span>
                              </div>
                              <span className="text-[10px] bg-emerald-100 px-1.5 rounded text-emerald-700">✅ PR Created</span>
                            </span>
                            <div className="flex gap-2 w-full">
                               <button 
                                 onClick={(e) => { e.stopPropagation(); setSelectedTicketKey(ticket.key); setDeveloperPage('diff-review'); }} 
                                 className="flex-1 h-9 lg:h-7 rounded-lg bg-[#3525cd] hover:bg-[#4f46e5] text-white font-mono text-[11px] font-semibold flex items-center justify-center transition-colors shadow-xs"
                               >
                                 Review Diff
                               </button>
                               {(ticket as any).prNumber && (
                                 <button 
                                   onClick={(e) => { e.stopPropagation(); window.open(`https://github.com/${(ticket as any).targetRepo}/pull/${(ticket as any).prNumber}`, '_blank'); }} 
                                   className="px-3 h-9 lg:h-7 rounded-lg border border-[#c7c4d8] text-[#0b1c30] bg-white hover:bg-[#f8f9ff] font-mono text-[11px] font-semibold flex items-center justify-center transition-colors"
                                 >
                                   View PR
                                 </button>
                               )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2 bg-[#f8f9ff] p-2.5 rounded-lg border border-[#c7c4d8]/60 mt-1">
                            <div className="flex items-center gap-2 w-full">
                              <select
                                id={`repo-select-${ticket.key}`}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => handleRepoChange(ticket.key, e.target.value)}
                                value={ticketRepoSelections[ticket.key] || ''}
                                className="h-9 lg:h-7 px-2 border border-gray-300 bg-white rounded text-[11px] font-mono flex-1 min-w-0 focus:outline-none focus:border-[#3525cd]"
                              >
                                <option value="">Select target repository...</option>
                                {githubRepos.map(repo => (
                                  <option key={repo.full_name} value={repo.full_name}>{repo.full_name}</option>
                                ))}
                              </select>
                              <select 
                                id={`branch-input-${ticket.key}`}
                                onClick={(e) => e.stopPropagation()}
                                className="h-9 lg:h-7 px-2 border border-gray-300 bg-white rounded text-[11px] font-mono w-24 shrink-0 focus:outline-none focus:border-[#3525cd]"
                              >
                                {ticketRepoSelections[ticket.key] && repoBranchesCache[ticketRepoSelections[ticket.key]] ? (
                                  repoBranchesCache[ticketRepoSelections[ticket.key]].map(b => (
                                    <option key={b.name} value={b.name}>{b.name}</option>
                                  ))
                                ) : (
                                  <option value="main">main</option>
                                )}
                              </select>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!ensureAnthropicConnected()) return;
                                const repoSelect = document.getElementById(`repo-select-${ticket.key}`) as HTMLSelectElement;
                                const branchInput = document.getElementById(`branch-input-${ticket.key}`) as HTMLInputElement;
                                const repo = repoSelect?.value;
                                const branch = branchInput?.value || 'main';
                                
                                if (!repo) {
                                  toast.error("Please select a target repository before executing.");
                                  return;
                                }
                                triggerAgentRun(ticket.key, branch, repo, ticket.description, ticket.title, (ticket as any).issuetype);
                              }}
                              className={`h-9 lg:h-7 w-full rounded-lg font-mono text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs active:scale-[0.98] cursor-pointer ${
                                anthropicStatus && !anthropicStatus.connected
                                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300'
                                  : 'bg-[#3525cd] hover:bg-[#4f46e5] text-white'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                {anthropicStatus && !anthropicStatus.connected ? 'key' : 'auto_mode'}
                              </span>
                              <span>
                                {anthropicStatus && !anthropicStatus.connected ? 'Connect Claude Key to Run' : 'Execute with AI'}
                              </span>
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  </article>

                  {/* Render children subtasks */}
                  {isExpanded && childTickets.map(child => {
                    const isChildSelected = selectedTicketKey === child.key;
                    const isChildRunning = agentRunningTicketKey === child.key && isStreaming;
                    return (
                      <article
                        key={child.key}
                        onClick={() => { setSelectedTicketKey(child.key); setMobileShowDetail(true); }}
                        className={`p-3 pl-7 sm:p-4 sm:pl-10 transition-colors cursor-pointer bg-slate-50 border-l-2 border-l-transparent ${
                          isChildSelected
                            ? 'bg-[#eff4ff] border-l-[#3525cd]'
                            : 'hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 mb-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="px-1.5 py-0.5 text-[11px] font-mono font-bold rounded bg-slate-600 text-white">
                              {child.key}
                            </span>
                            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-200 text-slate-700 uppercase tracking-wider">
                              {(child as any).issuetype || 'Subtask'}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-[#777587]">Status: {child.status}</span>
                        </div>
                        <h3 className="text-[13px] lg:text-xs font-semibold text-[#0b1c30] mb-1 break-words">{child.title}</h3>
                        
                        <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-slate-200">
                          {isChildRunning ? (
                            <span className="h-7 px-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 font-mono text-[11px] flex items-center justify-center gap-1.5 font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse"></span>
                              <span>Running...</span>
                            </span>
                          ) : (child.status === 'PR Ready' || child.status === 'Completed' || child.status === 'Done' || Boolean(child.prUrl)) ? (
                            <div className="flex flex-col gap-2 mt-1">
                              <span className="h-7 px-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono text-[11px] flex items-center justify-between gap-1.5 font-semibold">
                                <div className="flex items-center gap-1.5">
                                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                  <span>Execution completed</span>
                                </div>
                                <span className="text-[10px] bg-emerald-100 px-1.5 rounded text-emerald-700">✅ PR Created</span>
                              </span>
                              <div className="flex gap-2 w-full">
                                 <button 
                                   onClick={(e) => { e.stopPropagation(); setSelectedTicketKey(child.key); setDeveloperPage('diff-review'); }} 
                                   className="flex-1 h-9 lg:h-7 rounded-lg bg-[#3525cd] hover:bg-[#4f46e5] text-white font-mono text-[11px] font-semibold flex items-center justify-center transition-colors shadow-xs"
                                 >
                                   Review Diff
                                 </button>
                                 { (child as any).prNumber && (
                                   <button 
                                     onClick={(e) => { e.stopPropagation(); window.open(`https://github.com/${(child as any).targetRepo}/pull/${(child as any).prNumber}`, '_blank'); }} 
                                     className="px-3 h-9 lg:h-7 rounded-lg border border-[#c7c4d8] text-[#0b1c30] bg-white hover:bg-[#f8f9ff] font-mono text-[11px] font-semibold flex items-center justify-center transition-colors"
                                   >
                                     View PR
                                   </button>
                                 )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2 bg-white p-2.5 rounded-lg border border-[#c7c4d8]/40 shadow-sm mt-1">
                              <div className="flex items-center gap-2 w-full">
                                <select
                                  id={`repo-select-${child.key}`}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => handleRepoChange(child.key, e.target.value)}
                                  value={ticketRepoSelections[child.key] || ''}
                                  className="h-9 lg:h-7 px-2 border border-gray-300 rounded text-[11px] font-mono flex-1 min-w-0 focus:outline-none focus:border-[#3525cd] bg-white"
                                >
                                  <option value="">Select target repository...</option>
                                  {githubRepos.map(repo => (
                                    <option key={repo.full_name} value={repo.full_name}>{repo.full_name}</option>
                                  ))}
                                </select>
                                <select 
                                  id={`branch-input-${child.key}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-9 lg:h-7 px-2 border border-gray-300 rounded text-[11px] font-mono w-24 shrink-0 focus:outline-none focus:border-[#3525cd] bg-white"
                                >
                                  {ticketRepoSelections[child.key] && repoBranchesCache[ticketRepoSelections[child.key]] ? (
                                    repoBranchesCache[ticketRepoSelections[child.key]].map(b => (
                                      <option key={b.name} value={b.name}>{b.name}</option>
                                    ))
                                  ) : (
                                    <option value="main">main</option>
                                  )}
                                </select>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!ensureAnthropicConnected()) return;
                                  const repoSelect = document.getElementById(`repo-select-${child.key}`) as HTMLSelectElement;
                                  const branchInput = document.getElementById(`branch-input-${child.key}`) as HTMLInputElement;
                                  const repo = repoSelect?.value;
                                  const branch = branchInput?.value || 'main';
                                  
                                  if (!repo) {
                                    toast.error("Please select a target repository before executing.");
                                    return;
                                  }
                                  triggerAgentRun(child.key, branch, repo, child.description, child.title, (child as any).issuetype);
                                }}
                                className={`h-9 lg:h-7 w-full rounded-lg font-mono text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs active:scale-[0.98] cursor-pointer ${
                                  anthropicStatus && !anthropicStatus.connected
                                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300'
                                    : 'bg-[#3525cd] hover:bg-[#4f46e5] text-white'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[14px]">
                                  {anthropicStatus && !anthropicStatus.connected ? 'key' : 'play_arrow'}
                                </span>
                                <span>
                                  {anthropicStatus && !anthropicStatus.connected ? 'Connect Claude Key' : 'Execute AI on Subtask'}
                                </span>
                              </button>
                            </div>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
              );
            })
            ) : !loading && (
              <div className="p-8 text-center text-slate-500 font-mono text-xs">No active tickets found.</div>
            )}
          </div>
        </section>

        {/* Right Column: Active Ticket LangGraph Agent Execution Panel */}
        <section className={`${mobileShowDetail ? 'flex' : 'hidden lg:flex'} col-span-12 lg:col-span-8 flex-col min-h-0 overflow-y-auto touch-scroll bg-[#f8f9ff]`}>
          {/* Mobile / tablet back bar */}
          <div className="lg:hidden sticky top-0 z-20 flex items-center gap-2 px-2 sm:px-3 py-2 bg-white/95 backdrop-blur border-b border-[#c7c4d8]/60">
            <button
              onClick={() => setMobileShowDetail(false)}
              className="h-9 pl-1 pr-2 sm:pr-3 rounded-lg flex items-center gap-0.5 text-xs font-semibold text-[#3525cd] hover:bg-[#eff4ff] transition-colors shrink-0"
              aria-label="Back to tickets"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
              <span className="hidden min-[360px]:inline">Tickets</span>
            </button>
            {selectedTicket && (
              <div className="ml-auto flex items-center p-0.5 rounded-lg bg-[#eff4ff] border border-[#c7c4d8]/60 text-[11px] font-mono font-semibold" role="tablist">
                <button
                  role="tab"
                  aria-selected={mobileDetailTab === 'progress'}
                  onClick={() => setMobileDetailTab('progress')}
                  className={`h-8 px-3 rounded-md flex items-center gap-1.5 transition-colors ${
                    mobileDetailTab === 'progress' ? 'bg-white text-[#3525cd] shadow-sm' : 'text-[#565e74]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">account_tree</span>
                  <span>Progress</span>
                  <span className="text-[10px] text-[#777587]">{doneSteps}/5</span>
                  {pendingApproval && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>}
                </button>
                <button
                  role="tab"
                  aria-selected={mobileDetailTab === 'terminal'}
                  onClick={() => setMobileDetailTab('terminal')}
                  className={`h-8 px-3 rounded-md flex items-center gap-1.5 transition-colors ${
                    mobileDetailTab === 'terminal' ? 'bg-[#0f172a] text-white shadow-sm' : 'text-[#565e74]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">terminal</span>
                  <span>Terminal</span>
                  {isStreaming && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>}
                </button>
              </div>
            )}
          </div>

          {/* Anthropic BYOK Key Notification Banner */}
          {anthropicStatus && !anthropicStatus.connected && (
            <div className="bg-amber-50/90 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-3 text-xs font-mono text-amber-950 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-amber-600 text-[18px] shrink-0">key</span>
                <span className="truncate">
                  <strong>Anthropic API Key Required:</strong> Add your Claude API key to run autonomous coding agents.
                </span>
              </div>
              <button
                onClick={() => setDeveloperPage('integrations')}
                className="px-2.5 py-1 rounded bg-[#3525cd] hover:bg-[#4f46e5] text-white font-semibold text-[11px] transition-colors shrink-0 shadow-xs flex items-center gap-1 cursor-pointer"
              >
                <span>Configure Key</span>
                <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
              </button>
            </div>
          )}

          {selectedTicket ? (
            <>
              {/* Active Ticket Details Header Card */}
          <div className={`${mobileDetailTab === 'terminal' ? 'hidden lg:block' : ''} p-4 sm:p-6 bg-white border-b border-[#c7c4d8]/60`}>
            <div className="flex flex-wrap items-start sm:items-center justify-between gap-3 mb-2">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="px-2 py-0.5 rounded bg-[#3525cd] text-white font-mono text-xs font-bold shrink-0">
                  {selectedTicket.key}
                </span>
                <span className="text-base sm:text-lg font-bold text-[#0b1c30] tracking-tight break-words min-w-0">{selectedTicket.title}</span>
                {isRunningCurrentTicket && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 text-xs font-mono font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-ping"></span>
                    LangGraph Active
                  </span>
                )}
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                {isRunningCurrentTicket ? (
                  <button
                    onClick={() => {
                      setConfirmDialog({
                        isOpen: true,
                        title: 'Cancel Agent Run?',
                        message: `Are you sure you want to cancel the AI agent for ${selectedTicket.key}? The ticket will be reset back to 'To Do'.`,
                        ticketKey: selectedTicket.key,
                        confirmLabel: 'Cancel Run',
                        onConfirm: () => {
                          cancelAgentRun(selectedTicket.key);
                          toast.success(`${selectedTicket.key} execution cancelled and reset to To Do.`);
                        }
                      });
                    }}
                    className="h-8 px-3 rounded-lg bg-white border border-[#ba1a1a] text-[#ba1a1a] hover:bg-rose-50 text-xs font-mono transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">stop_circle</span>
                    <span>Cancel Run</span>
                  </button>
                ) : (selectedTicket.status === 'PR Ready' || Boolean((selectedTicket as any).prUrl)) ? (
                  <a
                    href={(selectedTicket as any).prUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-8 px-3 rounded-lg bg-emerald-50 border border-emerald-600 text-emerald-700 hover:bg-emerald-100 text-xs font-mono transition-colors flex items-center gap-1 cursor-pointer font-semibold"
                  >
                    <span className="material-symbols-outlined text-[16px]">verified</span>
                    <span>PR Created</span>
                  </a>
                ) : (
                  <button
                    onClick={() => {
                      if (!ensureAnthropicConnected()) return;
                      const repo = ticketRepoSelections[selectedTicket.key] || (selectedTicket as any).targetRepo || (githubRepos[0]?.full_name);
                      const branchInput = (document.getElementById(`branch-input-${selectedTicket.key}`) as HTMLInputElement)?.value || 'main';
                      triggerAgentRun(
                        selectedTicket.key,
                        branchInput,
                        repo,
                        selectedTicket.description,
                        selectedTicket.title,
                        (selectedTicket as any).issuetype
                      );
                    }}
                    className={`h-8 px-3 rounded-lg border text-xs font-mono transition-colors flex items-center gap-1 cursor-pointer font-semibold ${
                      anthropicStatus && !anthropicStatus.connected
                        ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                        : 'bg-white border-[#3525cd] text-[#3525cd] hover:bg-[#eff4ff]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {anthropicStatus && !anthropicStatus.connected ? 'vpn_key_alert' : 'memory'}
                    </span>
                    <span>
                      {anthropicStatus && !anthropicStatus.connected
                        ? 'Connect Key to Execute'
                        : (selectedTicket.status === 'Open' ? 'Execute AI Agent' : 'Re-run Agent')}
                    </span>
                  </button>
                )}

                <button
                  onClick={() => setDeveloperPage('history')}
                  className="h-8 px-3 rounded-lg bg-white border border-[#c7c4d8] hover:bg-[#eff4ff] text-[#0b1c30] text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px] text-[#565e74]">summarize</span>
                  <span className="hidden sm:inline">View Execution Report</span>
                <span className="sm:hidden">Report</span>
                </button>

                {(selectedTicket.status === 'PR Ready') && (
                  <button
                    onClick={() => handleRequestRevisions(selectedTicket.key)}
                    className="h-8 px-3 rounded-lg bg-white border border-[#c7c4d8] hover:bg-[#eff4ff] text-[#0b1c30] text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px] text-[#3525cd]">replay</span>
                    <span className="hidden sm:inline">Request Revisions</span>
                    <span className="sm:hidden">Revisions</span>
                  </button>
                )}

                {(selectedTicket.status === 'PR Ready') && (
                  <button
                    onClick={() => approvePullRequest(selectedTicket.key)}
                    className="h-8 px-3.5 rounded-lg bg-[#3525cd] hover:bg-[#4f46e5] text-white text-xs font-mono font-semibold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">merge</span>
                    <span>Merge PR</span>
                  </button>
                )}
              </div>
            </div>

            <p className="text-xs text-[#565e74] leading-relaxed mb-4">{selectedTicket.description}</p>

            {/* LangGraph Pipeline Steps */}
            <div className="mt-4 pt-4 border-t border-[#c7c4d8]/40">
              <h4 className="text-[11px] font-mono text-[#565e74] uppercase tracking-wider mb-2.5 font-semibold leading-relaxed">
                LangGraph Pipeline Steps <span className="hidden sm:inline">(Orchestration Graph: IssueResolutionWorkflow)</span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
                {/* Step 1 */}
                <div
                  className={`p-2.5 rounded-lg border-2 text-xs relative overflow-hidden ${
                    step1State === 'active'
                      ? 'bg-amber-50 border-amber-300 shadow-sm'
                      : step1State === 'done'
                      ? 'bg-[#eff4ff] border-emerald-300'
                      : 'bg-white border-[#c7c4d8]/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono font-bold text-[#565e74]">Step 1</span>
                    {step1State === 'active' ? (
                      <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping"></span>
                    ) : step1State === 'done' ? (
                      <span className="material-symbols-outlined text-emerald-600 text-[16px]">check_circle</span>
                    ) : (
                      <span className="material-symbols-outlined text-[#777587] text-[16px]">radio_button_unchecked</span>
                    )}
                  </div>
                  <p className="font-semibold text-[#0b1c30] leading-snug">Get ticket details</p>
                  <span className="text-[10px] font-mono text-emerald-700">Jira API OK (142ms)</span>
                </div>

                {/* Step 2 */}
                <div
                  className={`p-2.5 rounded-lg border-2 text-xs relative overflow-hidden ${
                    step2State === 'active'
                      ? 'bg-amber-50 border-amber-300 shadow-sm'
                      : step2State === 'done'
                      ? 'bg-[#eff4ff] border-emerald-300'
                      : 'bg-white border-[#c7c4d8]/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono font-bold text-[#565e74]">Step 2</span>
                    {step2State === 'active' ? (
                      <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping"></span>
                    ) : step2State === 'done' ? (
                      <span className="material-symbols-outlined text-emerald-600 text-[16px]">check_circle</span>
                    ) : (
                      <span className="material-symbols-outlined text-[#777587] text-[16px]">radio_button_unchecked</span>
                    )}
                  </div>
                  <p className="font-semibold text-[#0b1c30] leading-snug">Plan tasks & indexing</p>
                  <span className="text-[10px] font-mono text-emerald-700">AST Indexed</span>
                </div>

                {/* Step 3 */}
                <div
                  className={`p-2.5 rounded-lg border-2 text-xs relative overflow-hidden ${
                    step3State === 'active'
                      ? 'bg-amber-50 border-amber-300 shadow-sm'
                      : step3State === 'done'
                      ? 'bg-[#eff4ff] border-emerald-300'
                      : 'bg-white border-[#c7c4d8]/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-[#565e74] font-bold">Step 3</span>
                    {step3State === 'active' ? (
                      <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping"></span>
                    ) : step3State === 'done' ? (
                      <span className="material-symbols-outlined text-emerald-600 text-[16px]">check_circle</span>
                    ) : (
                      <span className="material-symbols-outlined text-[#777587] text-[16px]">radio_button_unchecked</span>
                    )}
                  </div>
                  <p className="font-bold text-[#0b1c30] leading-snug">Execute coding tasks</p>
                  {step3State === 'done' ? (
                    <div className="flex items-center gap-1 mt-1 text-[10px] font-mono text-emerald-700">
                      <span>Code generated & tested</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 mt-1 text-[10px] font-mono text-amber-800">
                      {step3State === 'active' && <span className="material-symbols-outlined animate-spin text-[12px]">refresh</span>}
                      <span>{step3State === 'active' ? 'LangGraph Agent Pulse' : 'Pending Agent'}</span>
                    </div>
                  )}
                </div>

                {/* Step 4 */}
                <div
                  className={`p-2.5 rounded-lg border-2 text-xs relative overflow-hidden ${
                    step4State === 'active'
                      ? 'bg-amber-50 border-amber-300 shadow-sm'
                      : step4State === 'done'
                      ? 'bg-[#eff4ff] border-emerald-300'
                      : 'bg-white border-[#c7c4d8]/50 opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono font-bold text-[#565e74]">Step 4</span>
                    {step4State === 'active' ? (
                      <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping"></span>
                    ) : step4State === 'done' ? (
                      <span className="material-symbols-outlined text-emerald-600 text-[16px]">check_circle</span>
                    ) : (
                      <span className="material-symbols-outlined text-[#777587] text-[16px]">radio_button_unchecked</span>
                    )}
                  </div>
                  <p className="font-semibold text-[#0b1c30] leading-snug">Commit code & branch</p>
                  <span className={`text-[10px] font-mono ${step4State === 'done' ? 'text-emerald-700' : 'text-[#777587]'}`}>
                    {step4State === 'done' ? 'Git commit verified' : step4State === 'active' ? 'Committing code...' : 'Pending Agent'}
                  </span>
                </div>

                {/* Step 5 */}
                <div
                  className={`p-2.5 rounded-lg border-2 text-xs relative overflow-hidden ${
                    step5State === 'active'
                      ? 'bg-amber-50 border-amber-300 shadow-sm'
                      : step5State === 'done'
                      ? 'bg-[#eff4ff] border-emerald-300'
                      : 'bg-white border-[#c7c4d8]/50 opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono font-bold text-[#565e74]">Step 5</span>
                    {step5State === 'active' ? (
                      <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping"></span>
                    ) : step5State === 'done' ? (
                      <span className="material-symbols-outlined text-emerald-600 text-[16px]">check_circle</span>
                    ) : (
                      <span className="material-symbols-outlined text-[#777587] text-[16px]">radio_button_unchecked</span>
                    )}
                  </div>
                  <p className="font-semibold text-[#0b1c30] leading-snug">Create PR & Jira sync</p>
                  <span className={`text-[10px] font-mono ${step5State === 'done' ? 'text-emerald-700' : 'text-[#777587]'}`}>
                    {step5State === 'done' ? 'PR Open & Synced' : step5State === 'active' ? 'Creating PR...' : 'Pending Agent'}
                  </span>
                </div>
              </div>
            </div>

            {/* Shortcut to the live terminal on phones / tablets */}
            <button
              onClick={() => setMobileDetailTab('terminal')}
              className="lg:hidden mt-4 w-full h-11 rounded-xl bg-[#0f172a] hover:bg-[#020617] text-white font-mono text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">terminal</span>
              <span>{isStreaming ? 'Watch live agent terminal' : 'Open agent terminal'}</span>
              {isStreaming && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>}
            </button>

            {/* Approval UI */}
            {pendingApproval && pendingApproval.type === 'plan_approval' && (
              <div className="mt-4 p-4 rounded-lg border-2 border-indigo-300 bg-indigo-50 shadow-sm">
                <h4 className="text-sm font-bold text-indigo-900 mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">verified_user</span>
                  Agent Plan Approval Required
                </h4>
                <p className="text-xs text-indigo-800 mb-2">The LangGraph planner has analyzed the requirement and proposed the following plan:</p>
                <div className="bg-white p-3 rounded border border-indigo-200 mb-3 text-xs font-mono text-slate-700 max-h-40 overflow-y-auto">
                   <p className="font-semibold text-indigo-900 mb-1">{pendingApproval.plan?.summary}</p>
                   {pendingApproval.plan?.files_to_touch && (
                     <p className="mb-1"><strong className="text-slate-900">Files to touch:</strong> {pendingApproval.plan.files_to_touch.join(', ')}</p>
                   )}
                   {pendingApproval.plan?.acceptance_criteria && (
                     <div className="mt-2">
                       <strong className="text-slate-900">Criteria:</strong>
                       <ul className="list-disc pl-4 mt-1">
                         {pendingApproval.plan.acceptance_criteria.map((c: string, idx: number) => <li key={idx}>{c}</li>)}
                       </ul>
                     </div>
                   )}
                   {pendingApproval.plan?.edge_cases && (
                     <div className="mt-2">
                       <strong className="text-slate-900">Edge Cases Addressed:</strong>
                       <ul className="list-disc pl-4 mt-1">
                         {pendingApproval.plan.edge_cases.map((c: string, idx: number) => <li key={idx}>{c}</li>)}
                       </ul>
                     </div>
                   )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => resumeAgentRun('approved')} 
                    className="px-4 py-1.5 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">check</span>
                    Approve (Y)
                  </button>
                  <button 
                    onClick={() => {
                      setFeedbackInput('');
                      setFeedbackModal({
                        isOpen: true,
                        title: 'Reject Plan & Provide Feedback',
                        subtitle: `Ticket: ${selectedTicket.key}`,
                        promptText: 'Explain what needs to change or provide detailed requirements so the LangGraph agent can regenerate an accurate plan:',
                        placeholder: 'e.g., Create Login page with email, password, and remember me checkbox fields in the frontend...',
                        ticketKey: selectedTicket.key,
                        mode: 'plan_rejection'
                      });
                    }} 
                    className="px-4 py-1.5 bg-white border border-indigo-300 text-indigo-700 rounded text-xs font-bold hover:bg-indigo-100 transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">edit_note</span>
                    Reject & Provide Feedback (F)
                  </button>
                  <button 
                    onClick={() => {
                      setConfirmDialog({
                        isOpen: true,
                        title: 'Stop Agent & Move to To Do?',
                        message: `Are you sure you want to stop the autonomous agent for ${selectedTicket.key}? This will safely terminate execution, discard the proposed plan, and return the ticket back to 'To Do' on your Jira board.`,
                        ticketKey: selectedTicket.key,
                        confirmLabel: 'Yes, Stop & Move to To Do',
                        onConfirm: () => {
                          cancelAgentRun(selectedTicket.key);
                          toast.success(`${selectedTicket.key} execution stopped and reset to To Do.`);
                        }
                      });
                    }} 
                    className="px-3 py-1.5 bg-white border border-rose-300 text-rose-700 rounded text-xs font-bold hover:bg-rose-50 transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                    title="Stop execution and return Jira ticket to To Do"
                  >
                    <span className="material-symbols-outlined text-[14px]">cancel</span>
                    Cancel & Move to To Do
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Terminal & Agent Live Streaming Logs Card */}
          <div className={`${mobileDetailTab === 'progress' ? 'hidden lg:flex' : 'flex'} p-3 sm:p-6 flex-1 flex-col gap-3 min-h-[340px] sm:min-h-[380px]`}>
            {/* Compact pipeline tracker so progress stays visible while watching logs (phones / tablets) */}
            <div className="lg:hidden rounded-xl bg-white border border-[#c7c4d8]/60 px-3 py-2.5 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-2 text-[11px] font-mono">
                <span className="font-semibold text-[#0b1c30] truncate">{selectedTicket.key} · Pipeline</span>
                <span className="text-[#565e74] shrink-0">{doneSteps} of 5 done</span>
              </div>
              <ol className="flex items-start">
                {pipelineSteps.map((st, i) => (
                  <li key={st.label} className="flex-1 flex flex-col items-center gap-1 relative min-w-0">
                    {i > 0 && (
                      <span className={`absolute top-2.5 right-1/2 w-full h-0.5 -z-0 ${pipelineSteps[i - 1].state === 'done' ? 'bg-emerald-400' : 'bg-[#e2e8f0]'}`}></span>
                    )}
                    <span
                      className={`relative z-10 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        st.state === 'done'
                          ? 'bg-emerald-500 text-white'
                          : st.state === 'active'
                          ? 'bg-amber-400 text-white ring-4 ring-amber-100'
                          : 'bg-white text-[#777587] border border-[#c7c4d8]'
                      }`}
                    >
                      {st.state === 'done' ? <span className="material-symbols-outlined text-[13px]">check</span> : i + 1}
                    </span>
                    <span className={`text-[10px] font-mono truncate max-w-full ${st.state === 'pending' ? 'text-[#777587]' : 'text-[#0b1c30] font-semibold'}`}>
                      {st.label}
                    </span>
                  </li>
                ))}
              </ol>
              {pendingApproval && (
                <button
                  onClick={() => setMobileDetailTab('progress')}
                  className="mt-2.5 w-full h-9 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 text-[11px] font-semibold flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">verified_user</span>
                  Plan approval required — review
                </button>
              )}
            </div>

            <div className="rounded-xl bg-[#020617] border border-[#1e293b] shadow-xl flex flex-col flex-1 min-h-[300px] overflow-hidden">
              {/* Terminal Header */}
              <div className="h-9 px-3 sm:px-4 bg-[#0f172a] border-b border-[#1e293b] flex items-center justify-between gap-2 select-none">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
                  </div>
                  <span className="text-xs font-mono text-slate-300 ml-2 truncate">
                    <span className="hidden sm:inline">agent-session · </span>{selectedTicket.key}-exec-run-9022
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {isRunningCurrentTicket ? (
                    <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span className="hidden sm:inline">STREAMING REASONING</span>
                      <span className="sm:hidden">LIVE</span>
                    </span>
                  ) : (
                    <span className="text-[11px] font-mono text-slate-400">
                      <span className="hidden sm:inline">SESSION </span>IDLE
                    </span>
                  )}
                  {isRunningCurrentTicket && (
                    <button
                      onClick={() => {
                        const target = agentRunningTicketKey || selectedTicket?.key;
                        setConfirmDialog({
                          isOpen: true,
                          title: 'Stop Active Agent Run?',
                          message: `Are you sure you want to stop the live execution for ${target}? The running process will be cancelled and the ticket will be reset back to 'To Do'.`,
                          ticketKey: target,
                          confirmLabel: 'Stop Execution',
                          onConfirm: () => {
                            cancelAgentRun(target);
                            toast.success(`${target} execution stopped and reset to To Do.`);
                          }
                        });
                      }}
                      className="h-6 px-2 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[11px] font-mono flex items-center gap-1 cursor-pointer transition-colors"
                      title="Stop agent run and return Jira ticket to To Do"
                    >
                      <span className="material-symbols-outlined text-[13px]">stop</span>
                      <span className="hidden sm:inline">Stop & Reset</span>
                    </button>
                  )}
                  <button
                    onClick={handleCopyLogs}
                    className="text-slate-400 hover:text-slate-200 text-xs font-mono flex items-center gap-1 cursor-pointer"
                    title="Copy Log Output"
                  >
                    <span className="material-symbols-outlined text-[14px]">content_copy</span>
                    <span>{copySuccess ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Terminal Output Logs */}
              <div className="p-3 sm:p-4 font-mono text-[11px] sm:text-xs text-slate-300 space-y-2 overflow-y-auto touch-scroll flex-1 leading-relaxed bg-[#020617]">
                {agentLogs.map((log) => (
                  <div key={log.id} className="space-y-1">
                    <div className="flex flex-wrap sm:flex-nowrap items-start gap-x-2 gap-y-0.5">
                      <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
                      {log.level === 'INFO' && <span className="text-cyan-400 font-semibold shrink-0">INFO</span>}
                      {log.level === 'SUCCESS' && <span className="text-emerald-400 font-semibold shrink-0">SUCCESS</span>}
                      {log.level === 'THOUGHT' && <span className="text-amber-400 font-semibold shrink-0">THOUGHT</span>}
                      {log.level === 'DIFF' && <span className="text-indigo-400 font-semibold shrink-0">PATCH</span>}
                      {log.level === 'TEST' && <span className="text-emerald-400 font-semibold shrink-0">TEST</span>}
                      {log.level === 'AGENT' && <span className="text-purple-400 font-semibold shrink-0">AGENT</span>}

                      {log.tag && <span className="text-slate-400">[{log.tag}]</span>}
                      <span className="text-slate-200 break-words min-w-0">{log.message}</span>
                    </div>

                    {/* Diff Inspection View inside terminal */}
                    {log.diffLines && (
                      <div className="my-2.5 p-2.5 sm:p-3 rounded bg-[#0b132b] border border-[#1e293b] font-mono text-[11px] sm:text-xs space-y-0.5 overflow-x-auto">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1 mb-1 border-b border-slate-800">
                          <span className="text-indigo-300 font-semibold">{log.tag}</span>
                          <span>git diff snapshot</span>
                        </div>
                        {log.diffLines.map((line, idx) => (
                          <div
                            key={idx}
                            className={`px-1 rounded break-all ${
                              line.type === 'del'
                                ? 'text-rose-400 bg-rose-950/30'
                                : 'text-emerald-400 bg-emerald-950/40'
                            }`}
                          >
                            {line.text}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {agentLogs.length === 0 && isTicketCompleted && (
                  <div className="space-y-1">
                    <div className="flex items-start gap-x-2 text-slate-400">
                      <span className="text-emerald-400 font-semibold">[COMPLETED]</span>
                      <span className="text-slate-300">
                        Agent execution completed successfully. Pull Request: {selectedTicket?.prUrl || 'PR Created'}
                      </span>
                    </div>
                  </div>
                )}

                {isRunningCurrentTicket && (
                  <div className="text-amber-400 font-mono text-xs flex items-center gap-1.5 pt-1">
                    <span className="material-symbols-outlined text-[14px] animate-spin">refresh</span>
                    <span>LangGraph agent executing graph loop...</span>
                    <span className="inline-block w-2 h-4 bg-cyan-400 animate-pulse align-middle ml-1"></span>
                  </div>
                )}
              </div>

              {/* Terminal Footer Controls */}
              <div className="min-h-9 px-3 sm:px-4 py-1.5 bg-[#090e1a] border-t border-[#1e293b] flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] sm:text-xs font-mono text-slate-400">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  <span>Model: <strong className="text-slate-200">claude-3-5-sonnet</strong></span>
                  <span>Tokens: <strong className="text-slate-200">4,192 in / 612 out</strong></span>
                  <span className="hidden sm:inline">Latency: <strong className="text-slate-200">3.8s</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Sandbox: isolated-vm-881</span>
                </div>
              </div>
            </div>
          </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12 text-[#565e74] font-mono text-sm gap-3">
              <span className="material-symbols-outlined text-[48px] text-[#c7c4d8]">inbox</span>
              No active tickets found. Please connect your Jira account to view tickets.
            </div>
          )}
        </section>
      </main>

      {/* Custom In-App Feedback Modal (Replaces browser prompt) */}
      {feedbackModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b1c30]/70 backdrop-blur-[4px] animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-xl border border-[#c7c4d8] shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-[#e2e8f0] flex items-center justify-between bg-indigo-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-[18px]">rate_review</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0b1c30]">{feedbackModal.title}</h3>
                  {feedbackModal.subtitle && (
                    <span className="text-[11px] font-mono text-indigo-700 font-semibold">{feedbackModal.subtitle}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setFeedbackModal(prev => ({ ...prev, isOpen: false }))}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!feedbackInput.trim()) {
                  toast.error("Please enter your feedback before submitting.");
                  return;
                }
                setFeedbackSubmitting(true);
                try {
                  if (feedbackModal.mode === 'plan_rejection') {
                    await resumeAgentRun('rejected', feedbackInput.trim());
                    toast.success("Feedback sent! LangGraph agent is updating the plan.");
                  } else {
                    const toastId = toast.loading("Submitting revision instructions...");
                    await resumeAgentExecution(feedbackModal.ticketKey, feedbackInput.trim());
                    toast.success("Agent execution resumed successfully!", { id: toastId });
                  }
                  setFeedbackModal(prev => ({ ...prev, isOpen: false }));
                  setFeedbackInput('');
                } catch (err) {
                  toast.error("Failed to submit feedback.");
                  console.error(err);
                } finally {
                  setFeedbackSubmitting(false);
                }
              }}
              className="p-5 flex flex-col gap-3"
            >
              <label className="text-xs text-[#565e74] leading-relaxed">
                {feedbackModal.promptText}
              </label>

              <textarea
                value={feedbackInput}
                onChange={(e) => setFeedbackInput(e.target.value)}
                placeholder={feedbackModal.placeholder}
                rows={4}
                autoFocus
                className="w-full p-3 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all resize-y"
              />

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-slate-400 font-mono">
                  {feedbackInput.length} characters
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFeedbackModal(prev => ({ ...prev, isOpen: false }))}
                    className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={feedbackSubmitting || !feedbackInput.trim()}
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  >
                    {feedbackSubmitting ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[14px]">send</span>
                        <span>Submit Feedback</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom In-App Confirmation Modal (Replaces browser window.confirm) */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b1c30]/70 backdrop-blur-[4px] animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[22px]">warning</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h3 className="text-base font-bold text-slate-900 leading-tight">
                    {confirmDialog.title}
                  </h3>
                  {confirmDialog.ticketKey && (
                    <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                      {confirmDialog.ticketKey}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {confirmDialog.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 mt-1">
              <button
                type="button"
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Keep Running
              </button>
              <button
                type="button"
                onClick={() => {
                  const action = confirmDialog.onConfirm;
                  setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                  action();
                }}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">stop_circle</span>
                <span>{confirmDialog.confirmLabel || 'Confirm'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
