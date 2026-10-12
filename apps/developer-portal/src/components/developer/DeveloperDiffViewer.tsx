import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { usePlatform } from '../../context/PlatformContext';

export const DeveloperDiffViewer: React.FC = () => {
  const {
    currentCompany,
    currentTenantTickets,
    selectedTicketKey,
    setSelectedTicketKey,
    triggerAgentRun,
    agentRunningTicketKey,
    setDeveloperPage,
    updateTicketStatus,
    executionRuns,
    selectedHistoryRunId
  } = usePlatform();

  const isAgentRunning = Boolean(agentRunningTicketKey);

  const mockTicket = currentTenantTickets.find((t) => t.key === selectedTicketKey);
  const activeRun = executionRuns.find(r => r.id === selectedHistoryRunId || r.ticketKey === selectedTicketKey);

  let targetRepo = mockTicket?.targetRepo || activeRun?.targetRepo || '';
  let prNumberStr = mockTicket?.prNumber || '';
  let title = mockTicket?.title || activeRun?.taskTitle || selectedTicketKey;
  let status = mockTicket?.status || activeRun?.status || 'Open';

  if (!mockTicket && activeRun?.prUrl) {
    const match = activeRun.prUrl.match(/github\.com\/([^\/]+\/[^\/]+)\/pull\/(\d+)/);
    if (match) {
      targetRepo = match[1];
      prNumberStr = match[2];
    }
  }

  if (!targetRepo) {
    targetRepo = selectedTicketKey.startsWith('WEB') ? 'techcorp-inc/web-frontend' : 'ksingh123456789/ai-knowledge-assistant';
  }

  const cleanPrNumber = String(prNumberStr).replace('#', '').trim();

  const ticket = {
    key: selectedTicketKey || mockTicket?.key || currentTenantTickets[0].key,
    title,
    status,
    targetRepo,
    prNumber: cleanPrNumber,
    branch: mockTicket?.branch || activeRun?.branch || 'main',
    assignedTo: (mockTicket as any)?.assignedTo || activeRun?.assignedTo || 'Autonomous Agent'
  };

  const [activeTab, setActiveTab] = useState<'diff' | 'tests' | 'review' | 'ast'>('diff');
  const [diffMode, setDiffMode] = useState<'unified' | 'split'>('split');
  const [selectedFile, setSelectedFile] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [reviewComments, setReviewComments] = useState<Array<{ id: string; author: string; time: string; text: string; line?: number }>>([]);
  const [approvedStatus, setApprovedStatus] = useState<string | null>(null);

  const [prFiles, setPrFiles] = useState<any[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);

  const [discoveredPrNumber, setDiscoveredPrNumber] = useState<string | null>(null);
  const [discoveredBranch, setDiscoveredBranch] = useState<string | null>(null);

  useEffect(() => {
    const prNumToUse = ticket.prNumber || discoveredPrNumber;
    if (!ticket.targetRepo) {
      setLoadingFiles(false);
      return;
    }
    const [owner, repo] = ticket.targetRepo.split('/');
    const headers = { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` };
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

    const fetchFiles = (num: string) => {
      fetch(`${apiUrl}/developer/integrations/github/repos/${owner}/${repo}/pulls/${num}/files`, { headers })
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) {
            setPrFiles(data);
            if (data.length > 0) setSelectedFile(data[0].filename);
          }
        })
        .catch(console.error)
        .finally(() => setLoadingFiles(false));

      fetch(`${apiUrl}/developer/integrations/github/repos/${owner}/${repo}/pulls/${num}/comments`, { headers })
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) {
            setReviewComments(data);
          }
        })
        .catch(console.error);
    };

    if (prNumToUse) {
      fetchFiles(prNumToUse);
    } else {
      // Try to discover PR by ticket key
      fetch(`${apiUrl}/developer/integrations/github/repos/${owner}/${repo}/pulls/by-ticket/${ticket.key}`, { headers })
        .then(r => r.json())
        .then(data => {
          if (data && data.number) {
            setDiscoveredPrNumber(String(data.number));
            setDiscoveredBranch(data.head?.ref || null);
            fetchFiles(String(data.number));
          } else {
            setLoadingFiles(false);
          }
        })
        .catch(() => setLoadingFiles(false));
    }
  }, [ticket.targetRepo, ticket.prNumber, ticket.key, discoveredPrNumber]);

  const files = prFiles;
  const displayPrNumber = ticket.prNumber || discoveredPrNumber;
  const displayBranch = ticket.branch !== 'main' ? ticket.branch : (discoveredBranch || ticket.branch);

  const handleAddComment = () => {
    if (!reviewNote.trim()) return;
    setReviewComments([
      ...reviewComments,
      {
        id: `c-${Date.now()}`,
        author: 'John Doe (You)',
        time: 'Just now',
        text: reviewNote,
      },
    ]);
    setReviewNote('');
  };

  const handleApprove = () => {
    setApprovedStatus('approved');
  };

  const handleMerge = () => {
    if (displayPrNumber) {
      window.open(`https://github.com/${ticket.targetRepo}/pull/${displayPrNumber}`, '_blank');
    }
    setApprovedStatus('merged');
    updateTicketStatus(ticket.key, 'Completed');
    toast.success(`PR #${displayPrNumber || 104} marked as merged and Jira ticket closed.`);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#0c1017] text-slate-200 overflow-hidden">
      {/* Top PR Header bar */}
      <div className="bg-[#111722] border-b border-slate-800/80 px-3 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0 flex-1">
          <button
            onClick={() => setDeveloperPage('workbench')}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors flex items-center gap-1 text-xs shrink-0"
            title="Return to Workbench"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="hidden sm:block h-5 w-px bg-slate-700"></div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {displayPrNumber && (
                <span className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  PR #{displayPrNumber}
                </span>
              )}
              <h1 className="text-sm sm:text-base font-semibold text-white tracking-tight break-words min-w-0">
                {ticket.key}: {ticket.title}
              </h1>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                approvedStatus === 'merged'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  : approvedStatus === 'approved'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              }`}>
                {approvedStatus === 'merged' ? 'Merged to main' : approvedStatus === 'approved' ? 'Approved & Ready' : 'Open for Review'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] sm:text-xs text-slate-400 mt-1 font-mono">
              <span className="flex items-center gap-1 text-slate-300">
                <span className="material-symbols-outlined text-[14px] text-blue-400">call_split</span>
                <span className="truncate max-w-[180px] sm:max-w-none">{displayBranch}</span>
              </span>
              <span>into</span>
              <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">main</span>
              <span className="hidden sm:inline">•</span>
              <span className="text-slate-400">Authored by <strong className="text-cyan-300 font-sans">AI Agent</strong></span>
              <span className="hidden sm:inline">•</span>
              <span><span className="text-emerald-400">+{prFiles.reduce((acc, f) => acc + f.additions, 0)}</span> / <span className="text-rose-400">-{prFiles.reduce((acc, f) => acc + f.deletions, 0)}</span> lines</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {approvedStatus !== 'merged' && (
            <>
              <button
                onClick={handleApprove}
                disabled={approvedStatus === 'approved'}
                className={`flex-1 sm:flex-none justify-center px-3 py-2 sm:py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  approvedStatus === 'approved'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-default'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                }`}
              >
                <span className="material-symbols-outlined text-sm">check_circle</span>
                <span>{approvedStatus === 'approved' ? 'Approved ✓' : 'Approve Changes'}</span>
              </button>
              <button
                onClick={handleMerge}
                className="flex-1 sm:flex-none justify-center px-3 py-2 sm:py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-sm transition-all"
              >
                <span className="material-symbols-outlined text-sm">open_in_new</span>
                <span>Merge on GitHub</span>
              </button>
            </>
          )}

          {approvedStatus === 'merged' && (
            <div className="px-3 py-1.5 bg-purple-500/10 border border-purple-500/30 text-purple-300 rounded-lg text-xs font-mono flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-purple-400">done_all</span>
              <span>Merged into origin/main</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Diff Content Container */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
        {/* Left: Changed Files Tree */}
        <div className="w-full md:w-72 max-h-[34vh] md:max-h-none bg-[#0d121c] border-b md:border-b-0 md:border-r border-slate-800 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-800 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Changed Files ({prFiles.length})</span>
            <span className="text-[11px] font-mono text-cyan-400">{prFiles.length} files changed</span>
          </div>

          <div className="p-2 space-y-1 overflow-y-auto touch-scroll flex-1 min-h-0">
            {loadingFiles ? (
              <div className="p-4 text-center text-xs text-slate-500 font-mono">Loading PR files...</div>
            ) : files.map((file) => (
              <button
                key={file.filename}
                onClick={() => setSelectedFile(file.filename)}
                className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors flex items-center justify-between group ${
                  selectedFile === file.filename
                    ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-200'
                    : 'text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="material-symbols-outlined text-sm text-slate-400 group-hover:text-cyan-400 shrink-0">
                    {file.filename.includes('.spec.') || file.filename.includes('.bench.') ? 'flaky' : 'code'}
                  </span>
                  <span className="truncate font-mono text-[11px]">{file.filename}</span>
                </div>
                <div className="flex items-center gap-1 font-mono text-[10px] shrink-0 ml-2">
                  <span className="text-emerald-400">+{file.additions}</span>
                  <span className="text-rose-400">-{file.deletions}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Quick Ticket Context */}
          <div className="hidden md:block p-3.5 border-t border-slate-800 bg-slate-900/40">
            <div className="text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Ticket Info</div>
            <div className="text-xs text-slate-200 font-medium">{ticket.title}</div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
              <span>Status: <strong className="text-amber-400">{ticket.status}</strong></span>
              <span>Assignee: <strong className="text-slate-300">{ticket.assignedTo}</strong></span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] text-slate-400 font-mono flex items-center justify-between">
              <span>Tenant: {currentCompany.name}</span>
              <span className="text-slate-500">CI Tests: Pending</span>
            </div>
          </div>
        </div>

        {/* Center / Right: Diff and Code Viewer */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#0a0e14]">
          {/* View Toolbar */}
          <div className="bg-[#111722]/80 backdrop-blur border-b border-slate-800 px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-mono text-slate-300 min-w-0 max-w-full">
              <span className="text-slate-500 shrink-0">File:</span>
              <span className="text-cyan-400 font-semibold truncate" title={selectedFile}>{selectedFile}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 max-w-full">
              <div className="flex items-center bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60 shrink-0">
                <button
                  onClick={() => setActiveTab('diff')}
                  className={`px-2.5 py-1.5 sm:py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                    activeTab === 'diff' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Code Diff
                </button>
                <button
                  onClick={() => setActiveTab('tests')}
                  className={`px-2.5 py-1.5 sm:py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                    activeTab === 'tests' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Test Results
                </button>
                <button
                  onClick={() => setActiveTab('review')}
                  className={`px-2.5 py-1.5 sm:py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                    activeTab === 'review' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Review Comments {reviewComments.length > 0 ? `(${reviewComments.length})` : ''}
                </button>
              </div>

              {activeTab === 'diff' && (
                <div className="flex items-center bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60 sm:ml-2 shrink-0">
                  <button
                    onClick={() => setDiffMode('split')}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                      diffMode === 'split' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Split
                  </button>
                  <button
                    onClick={() => setDiffMode('unified')}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                      diffMode === 'unified' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Unified
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Tab 1: Code Diff */}
          {activeTab === 'diff' && (
            <div className="flex-1 overflow-auto touch-scroll font-mono text-[11px] sm:text-[12px] leading-relaxed select-text p-3 sm:p-4">
              {!ticket.targetRepo || !displayPrNumber ? (
                 <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center px-4 text-slate-400 gap-4">
                   <span className="material-symbols-outlined text-4xl opacity-50">code_off</span>
                   <p>No associated GitHub PR found for this ticket.</p>
                 </div>
              ) : (
                <div className="max-w-4xl mx-auto space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4 bg-slate-900 rounded-lg border border-slate-800">
                     <span className="text-slate-300">Raw GitHub Diff Output</span>
                     <button
                        onClick={() => window.open(`https://github.com/${ticket.targetRepo}/pull/${displayPrNumber}/files`, '_blank')}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                        <span>View Full Diff on GitHub</span>
                      </button>
                  </div>

                  {prFiles.filter(f => f.filename === selectedFile).map(file => (
                     <div key={file.filename} className="bg-[#0b0e14] p-3 sm:p-4 rounded-lg border border-slate-800">
                       <pre className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                         {file.patch ? file.patch.split('\n').map((line: string, i: number) => {
                           let className = "text-slate-400";
                           if (line.startsWith('+')) className = "text-emerald-400 bg-emerald-950/30 block w-full";
                           else if (line.startsWith('-')) className = "text-rose-400 bg-rose-950/30 block w-full";
                           else if (line.startsWith('@@')) className = "text-cyan-400 mt-2 mb-1 block w-full opacity-70";
                           return <span key={i} className={className}>{line}{'\n'}</span>;
                         }) : (
                           <span className="text-slate-500 italic">Binary or unrenderable file format</span>
                         )}
                       </pre>
                     </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Test Results */}
          {activeTab === 'tests' && (
            <div className="flex-1 overflow-auto touch-scroll p-4 sm:p-6 bg-[#0c1017]">
              <div className="max-w-4xl mx-auto space-y-4">
                <div className="bg-slate-800/20 border border-slate-700 rounded-xl p-6 sm:p-8 flex flex-col items-center justify-center text-center">
                  <span className="material-symbols-outlined text-4xl text-slate-500 mb-3">science</span>
                  <div className="text-sm font-semibold text-slate-300">No Test Results Available</div>
                  <div className="text-xs text-slate-500 mt-1">CI tests have not yet been run or reported for this PR.</div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Review Notes and Comments */}
          {activeTab === 'review' && (
            <div className="flex-1 overflow-auto touch-scroll p-4 sm:p-6 bg-[#0c1017]">
              <div className="max-w-3xl mx-auto space-y-4">
                <div className="space-y-3">
                  {reviewComments.map((comm) => (
                    <div key={comm.id} className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-cyan-600/30 text-cyan-300 font-bold text-[10px] flex items-center justify-center">
                            {comm.author.charAt(0)}
                          </span>
                          <span className="text-xs font-semibold text-white">{comm.author}</span>
                        </div>
                        <span className="text-[11px] text-slate-400">{comm.time}</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{comm.text}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="text-xs font-semibold text-slate-300">Add Code Review Note or Instruction</div>
                  <textarea
                    rows={3}
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="Provide feedback to developer or prompt the AI agent for revision..."
                    className="w-full bg-[#0a0e14] border border-slate-800 rounded-lg p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-500">Markdown supported • AI Agent will react to instructions</span>
                    <button
                      onClick={handleAddComment}
                      className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium transition-colors"
                    >
                      Post Note
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
