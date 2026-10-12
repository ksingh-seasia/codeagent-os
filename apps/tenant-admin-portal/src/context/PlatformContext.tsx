import React, { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  PortalType,
  SuperAdminPage,
  TenantAdminPage,
  DeveloperPage,
  Company,
  DeveloperMember,
  ProjectMapping,
  JiraTicket,
  TerminalLog,
  LangGraphStep,
  ExecutionRun,
  LicensePlan,
  PlatformUser,
  WebhookLog
} from '../types/platform';

export const AVATARS = {
  alexWright: "https://lh3.googleusercontent.com/aida-public/AB6AXuA8LWKOhLaMt9tnV4PY3Z1XzM7vSHuaHkYq4h0SCmiCA8Ys-MEWjv4h0KH6GnOdGE1W4_iTA4Stm1BnKxHdFvtHDtQbl56WLmabn6wrQ2oaM9cLYZFGMnfbv8iX3SBzxdjdKdhtOvfWlbyus7xr2iQBHIVymAk9ADOBjb_qR3W3tOXtIucbFRoemIOP-qtrbFIW2_jZG8Gqm2_VfFLzBlb764Yy_NbM1BRnB4puAKog4y_2Pulp-GD-PA",
  alexSuperAdmin: "https://lh3.googleusercontent.com/aida-public/AB6AXuBXvonF-7ltKA2smmYkHrruQOhxoZelQJjvcccprDlf9HqVv5v-3d0jaM1_GijFmyyouf-91RkNJsAIudtt3vhdCZvePKbKpjFZkvZTPqH1Ki1TUcRUdf-POWL04GG_UcsrPBn3RggTSpqZtk4QV3F10ef6i95KPC6oW0yKASJE6rh4wyR9cd_yKMuvl69Ogg9PowabrnHdbZDaCE1W7_pTvbAnxWaQ7Wu0pnFlgoNZBd_qohkL6feRzg",
  johnDoe: "https://lh3.googleusercontent.com/aida-public/AB6AXuDidbj8o7etI6LbFDBrJfq0FoW6cizG8YpYWagpp8ZK1C7Sp4kVj3lJGp1BoXnUtCb6AarGUDOTVhrCmjjg3kbBA-WBZyzQCREH6F5xRKWYNjq_QKiylAtF5jeUf0VW9MV38YvwJgSlqewyfuZkdt9Iz-i4EmX3YDgCoWzy_dTINXK0AWgl6h80vBA2mHpBfTrECAlASwqD4S3sEEDLON_kmKR9oIjouQB2ff9UdsuRwJJtoiv8kk29IQ",
  alexRivera: "https://lh3.googleusercontent.com/aida-public/AB6AXuB31mKCpZhlaJX-OfYlujR-ypC6HZuxnL2dFhH7bNvDBY2CUPs19evyr60UghMg07kNBmTF2Cb3r_tBL03j5z549pWSnMVrCBaVtqJ8vTtbHkC2hxI00ZsG7fAwCFTLU_QHtielFmpieNkMqhOl8vIrk5chLbcwfW41i8q0vHs3VO0_zm8x9-1SFk3Mg8hBthC9ly5SJiPuUMNi9NVWDxjpyiI0yG405R8UHrAxKZOu5jgu-hT6STgLYQ",
  leadProfile: "https://lh3.googleusercontent.com/aida-public/AB6AXuD7VPz57lQUuXwatb4LckuHg_KgBeC8jLHs7KcaZ3PGJtW_qSCiuPaZmsRbCgtZzwVMt2X32VALW-WpJ09rRYxVLhMQcdY_Jl5YvQqsEZYS7yTOfZzXYK4QcdS1dtVZXmJsLLf0yoRoMVE0q4x0Ozeb9SgvqbgubbLeZhJGape-8QeSu8n_zBAQZL7i-J-v1-oPjpto44Wpec3lgzwS5-wQZqA9DGgaEj4Nqa3f14vxAquKuyh06Pii-g"
};

const INITIAL_COMPANIES: Company[] = [];

const INITIAL_DEVELOPERS: DeveloperMember[] = [];

const INITIAL_TICKETS: JiraTicket[] = [
  {
    key: 'PROJ-101',
    tenantId: 'techcorp',
    projectKey: 'PROJ',
    title: 'Fix login issue',
    description: 'Users are unable to login with valid credentials after session expiry. Investigating token expiration timestamps, Redis cache invalidation, and race condition during automated JWT refresh handshake.',
    priority: 'High',
    status: 'In Progress',
    points: 3,
    estimatedHours: '4h',
    targetRepo: 'techcorp-inc/backend-api',
    branch: 'fix/login-refresh-race',
    criteria: [
      'Implement exponential backoff retry mechanism with 500ms initial jitter on timeout',
      'Acquire Redis lock during atomic JWT refresh token swap',
      'Ensure all unit test suites in src/auth/__tests__ pass cleanly'
    ],
    completedCriteria: 2,
    assignedTo: 'John Doe',
    assignedToEmail: 'john.doe@techcorp.com',
    fileTarget: 'auth-controller.ts',
    agentPrompt: 'Fix race condition during token rotation by introducing redis distributed lock on user ID session store.',
    preset: 'Fix bug & add regression test',
    modelTarget: 'Claude 3.5 Sonnet',
    pullRequestPolicy: 'Auto-create Draft PR',
    targetEnvironment: 'staging-sandbox-01',
    prNumber: '#249',
    isLangGraphActive: true
  },
  {
    key: 'PROJ-102',
    tenantId: 'techcorp',
    projectKey: 'PROJ',
    title: 'Add payment integration',
    description: 'Integrate Stripe webhooks handler and update tenant subscription quota database tables.',
    priority: 'Medium',
    status: 'Open',
    points: 5,
    estimatedHours: '6h',
    targetRepo: 'techcorp-inc/backend-api',
    branch: 'feature/stripe-webhooks',
    criteria: [
      'Verify Stripe signature in raw request body stream',
      'Idempotently process invoice.payment_succeeded events',
      'Increment developer quota seats upon subscription upgrade'
    ],
    completedCriteria: 0,
    assignedTo: 'Rohit Sharma',
    fileTarget: 'billing-service',
    agentPrompt: 'Implement Stripe webhook verification and tenant quota table upgrade transaction.',
    preset: 'Refactor & optimize',
    modelTarget: 'Claude 3.5 Sonnet',
    pullRequestPolicy: 'Auto-create Draft PR',
    targetEnvironment: 'staging-sandbox-01'
  },
  {
    key: 'PROJ-103',
    tenantId: 'techcorp',
    projectKey: 'PROJ',
    title: 'Improve UI performance',
    description: 'Memoize complex component trees and virtualize the ticket list rendered in company dashboard.',
    priority: 'Low',
    status: 'In Progress',
    points: 2,
    estimatedHours: '2h',
    targetRepo: 'techcorp-inc/web-frontend',
    branch: 'perf/ticket-virtualization',
    criteria: [
      'Virtualize ticket table rows beyond 50 elements',
      'Eliminate redundant re-renders on active LangGraph telemetry stream'
    ],
    completedCriteria: 1,
    assignedTo: 'Sarah Connor',
    fileTarget: 'frontend/benchmarks',
    agentPrompt: 'Memoize table components and virtualize scroll container.',
    preset: 'Refactor & optimize',
    modelTarget: 'Claude 3.5 Sonnet',
    pullRequestPolicy: 'Auto-create Draft PR',
    targetEnvironment: 'staging-sandbox-01'
  },
  {
    key: 'PROJ-104',
    tenantId: 'techcorp',
    projectKey: 'PROJ',
    title: 'Implement OAuth refresh token rotation',
    description: 'Security compliance audit requirement: enforce single-use refresh tokens with automatic revocation cascade.',
    priority: 'Critical',
    status: 'PR Ready',
    points: 8,
    estimatedHours: '8h',
    targetRepo: 'techcorp-inc/backend-api',
    branch: 'chore/spec-gen',
    criteria: [
      'Revoke previous refresh token when newly rotated token is issued',
      'Invalidate entire session family if reused refresh token is presented'
    ],
    completedCriteria: 2,
    assignedTo: 'Sarah Jenkins',
    fileTarget: 'src/auth/jwt.strategy.ts',
    agentPrompt: 'Implement single-use refresh token rotation with family revocation.',
    preset: 'Generate unit tests',
    modelTarget: 'Claude 3.5 Sonnet',
    pullRequestPolicy: 'Auto-create Draft PR',
    targetEnvironment: 'staging-sandbox-01',
    prNumber: '#248'
  },
  {
    key: 'PROJ-105',
    tenantId: 'techcorp',
    projectKey: 'PROJ',
    title: 'Refactor Redis connection pool to handle idle timeouts',
    description: 'Implement connection health checks and automatic reconnection logic in backend cluster.',
    priority: 'High',
    status: 'Open',
    points: 3,
    estimatedHours: '4h',
    targetRepo: 'techcorp-inc/backend-api',
    branch: 'main',
    criteria: [
      'Implement exponential backoff retry mechanism with 500ms initial jitter on timeout',
      'Expose Redis connection pool metrics (active, idle, wait duration) to Prometheus',
      'Ensure all existing integration test suites in /tests/cache pass cleanly'
    ],
    completedCriteria: 3,
    assignedTo: 'John Doe',
    fileTarget: 'internal/cache/redis.go',
    agentPrompt: `Task: Refactor the redisClient connection pool within internal/cache/redis.go. 
- Use the redigo pool configuration pattern.
- Handle idle socket disconnects cleanly without dropping pending queries.
- Add test coverage for connection reconnection failures.`,
    preset: 'Refactor & optimize',
    modelTarget: 'Claude 3.7 Sonnet',
    pullRequestPolicy: 'Auto-create Draft PR',
    targetEnvironment: 'staging-sandbox-01'
  },
  {
    key: 'PROJ-106',
    tenantId: 'techcorp',
    projectKey: 'PROJ',
    title: 'Add rate limiter middleware to public webhooks',
    description: 'Token bucket rate limiting on /v1/events/ingest endpoint with 429 status code handling.',
    priority: 'Medium',
    status: 'Open',
    points: 2,
    estimatedHours: '2h',
    targetRepo: 'techcorp-inc/backend-api',
    branch: 'main',
    criteria: [
      'Apply Redis token bucket algorithm limiting 100 req/sec per tenant',
      'Return Retry-After headers conforming to RFC 6585'
    ],
    completedCriteria: 0,
    assignedTo: 'Liam Vance',
    fileTarget: 'middleware/ratelimit.ts',
    agentPrompt: 'Implement token bucket rate limiter in Express middleware using Redis.',
    preset: 'Generate unit tests',
    modelTarget: 'Claude 3.5 Sonnet',
    pullRequestPolicy: 'Auto-create Draft PR',
    targetEnvironment: 'staging-sandbox-01'
  },
  {
    key: 'PROJ-107',
    tenantId: 'techcorp',
    projectKey: 'PROJ',
    title: 'Fix flaky database test in tenant teardown suite',
    description: 'Isolate foreign key constraints during concurrent test container teardown.',
    priority: 'High',
    status: 'Open',
    points: 5,
    estimatedHours: '6h',
    targetRepo: 'techcorp-inc/backend-api',
    branch: 'main',
    criteria: [
      'Ensure tables truncate in foreign-key dependency order without deadlock exceptions'
    ],
    completedCriteria: 0,
    assignedTo: 'Alex Rivera',
    fileTarget: 'tests/teardown.spec.ts',
    agentPrompt: 'Fix database test container teardown cascade locks.',
    preset: 'Fix bug & add regression test',
    modelTarget: 'Claude 3.5 Sonnet',
    pullRequestPolicy: 'Auto-create Draft PR',
    targetEnvironment: 'staging-sandbox-01'
  },
  {
    key: 'PROJ-108',
    tenantId: 'techcorp',
    projectKey: 'PROJ',
    title: 'Optimize AST Node Visitor in Lexer',
    description: 'Refactor visitor dispatch table to eliminate deep recursion stack and export telemetry metrics.',
    priority: 'Medium',
    status: 'Completed',
    points: 2,
    estimatedHours: '2h',
    targetRepo: 'techcorp-inc/backend-api',
    branch: 'feat/agent-ast-parser',
    criteria: [
      'Retrieved PROJ-108 acceptance criteria; parsed TypeScript AST for src/lexer/visitor.ts',
      'Calculated traversal memoization vector; refactored recursive descent loop into flat iterator pattern',
      'Pass all 42 lexer unit tests and verify 31.4% speed improvement'
    ],
    completedCriteria: 3,
    assignedTo: 'John Doe',
    fileTarget: 'src/lexer/visitor.ts',
    agentPrompt: 'Refactor lexer AST node visitor to flat iterator pattern.',
    preset: 'Refactor & optimize',
    modelTarget: 'Claude 3.5 Sonnet',
    pullRequestPolicy: 'Auto-create Draft PR',
    targetEnvironment: 'staging-sandbox-01',
    prNumber: '#342'
  }
];

const INITIAL_RUNS: ExecutionRun[] = [
  {
    id: 'LG-8942',
    ticketKey: 'PROJ-108',
    taskTitle: 'Optimize AST Node Visitor in Lexer',
    assignedTo: 'John Doe',
    timeAgo: '4 mins ago',
    commitHash: '7f8b92a',
    branch: 'feat/agent-ast-parser',
    model: 'Claude 3.5 Sonnet',
    phase: 'Tests Passed (42/42)',
    duration: '14.8s',
    stepsCount: 8,
    status: 'Completed',
    addedLines: 84,
    deletedLines: 38,
    tokenUsage: '24,310 prompt / 1,480 compl',
    files: [
      {
        name: 'src/lexer/visitor.ts',
        added: 62,
        deleted: 28,
        description: 'Refactored visitor dispatch table to eliminate deep recursion stack.'
      },
      {
        name: 'tests/lexer_perf.test.ts',
        added: 22,
        deleted: 10,
        description: 'Added 10,000 AST node stress benchmark assertion.'
      }
    ],
    stepBreakdown: [
      {
        name: '1. ingest_jira_spec & locate_ast',
        latency: '0.82s',
        tokens: '3.2k tokens',
        detail: 'Retrieved PROJ-108 acceptance criteria; parsed TypeScript AST for src/lexer/visitor.ts.'
      },
      {
        name: '2. reasoning_and_graph_recursion (Claude 3.5 Sonnet)',
        latency: '7.41s',
        tokens: '16.4k tokens',
        detail: 'Calculated traversal memoization vector; refactored recursive descent loop into flat iterator pattern.'
      },
      {
        name: '3. patch_file_system & format_prettier',
        latency: '1.12s',
        tokens: 'tool_call:fs_patch',
        detail: 'Applied git patch to 2 files; verified zero formatting lint discrepancies with ESLint v9.'
      },
      {
        name: '4. run_unit_tests & benchmark',
        latency: '4.20s',
        tokens: 'vitest worker',
        detail: 'Ran 42 unit test suites: 42 passed, 0 failed. Lexer throughput benchmark increased by 31.4%.'
      },
      {
        name: '5. finalize_git_pr_and_jira_sync',
        latency: '1.25s',
        tokens: 'GitHub API',
        detail: 'Drafted PR description; linked commit 7f8b92a to Jira ticket PROJ-108 status: "Ready for Review".'
      }
    ],
    sandboxStdout: [
      '$ vitest run tests/lexer_perf.test.ts',
      '✓ tests/lexer_perf.test.ts (42 tests) 241ms',
      'Bench: 14,892 nodes/ms (+31.4% vs baseline)',
      '✨ AST parse verified without cycle leaks.'
    ]
  },
  {
    id: 'LG-8941',
    ticketKey: 'PROJ-104',
    taskTitle: 'Auto-generate OpenAPI Spec V3 for Tenant API',
    assignedTo: 'Sarah Jenkins',
    timeAgo: '18 mins ago',
    commitHash: '4d1109e',
    branch: 'chore/spec-gen',
    model: 'Claude 3.5 Sonnet',
    phase: 'AST Parsed (Streaming code...)',
    duration: '9.1s',
    stepsCount: 7,
    status: 'In Progress',
    addedLines: 120,
    deletedLines: 15,
    tokenUsage: '18,200 prompt / 920 compl',
    files: [
      {
        name: 'docs/openapi.yaml',
        added: 120,
        deleted: 15,
        description: 'Generated schemas for tenant endpoints and webhooks.'
      }
    ],
    stepBreakdown: [
      {
        name: '1. ingest_jira_spec & locate_ast',
        latency: '0.90s',
        tokens: '2.8k tokens',
        detail: 'Parsed endpoint decorators across NestJS controllers.'
      },
      {
        name: '2. reasoning_and_graph_recursion',
        latency: '5.20s',
        tokens: '12.1k tokens',
        detail: 'Compiling OpenAPI 3.1.0 specifications.'
      }
    ],
    sandboxStdout: [
      '$ openapi-generator validate -i docs/openapi.yaml',
      'Validating spec... OK (0 warnings)'
    ]
  },
  {
    id: 'LG-8940',
    ticketKey: 'PROJ-101',
    taskTitle: 'Refactor Redis Connection Pool Retry Policy',
    assignedTo: 'Alex Wong',
    timeAgo: '1 hour ago',
    commitHash: '1a90c23',
    branch: 'fix/redis-conn',
    model: 'Claude 3.5 Sonnet',
    phase: 'PR Generated (#342)',
    duration: '18.6s',
    stepsCount: 11,
    status: 'Needs Review',
    addedLines: 45,
    deletedLines: 12,
    tokenUsage: '28,100 prompt / 2,100 compl',
    files: [
      {
        name: 'src/cache/redis.pool.ts',
        added: 45,
        deleted: 12,
        description: 'Added exponential backoff and jitter to Redis reconnect.'
      }
    ],
    stepBreakdown: [
      {
        name: '1. ingest_jira_spec',
        latency: '0.75s',
        tokens: '2.4k tokens',
        detail: 'Extracted timeout reproduction steps.'
      }
    ],
    sandboxStdout: [
      '$ jest tests/cache.test.ts',
      'PASS tests/cache.test.ts'
    ]
  }
];

const INITIAL_LICENSE_PLANS: LicensePlan[] = [
  {
    id: 'plan_20',
    name: '20 Dev Starter',
    price: 199,
    billingPeriod: 'mo',
    badge: 'Standard',
    seatLimit: '20 Seats',
    seatLimitNum: 20,
    agentConcurrency: '5 Concurrent',
    subscribedTenants: 64,
    infrastructure: 'Shared Worker Pod'
  },
  {
    id: 'plan_50',
    name: '50 Dev Scale',
    price: 399,
    billingPeriod: 'mo',
    badge: 'Popular',
    seatLimit: '50 Seats',
    seatLimitNum: 50,
    agentConcurrency: '15 Concurrent',
    subscribedTenants: 48,
    infrastructure: 'Dedicated RQ queue'
  },
  {
    id: 'plan_100',
    name: 'Enterprise 100+',
    price: 699,
    billingPeriod: 'mo base',
    badge: 'Custom SLA',
    seatLimit: '100+ Seats',
    seatLimitNum: 100,
    agentConcurrency: 'Custom Concurrency',
    subscribedTenants: 16,
    infrastructure: 'Dedicated K8s Cluster'
  }
];

const INITIAL_PLATFORM_USERS: PlatformUser[] = [
  {
    id: 'usr_1',
    name: 'Alex Wright',
    email: 'alex.wright@codeagent.io',
    role: 'Super Admin',
    scope: 'Global Root',
    security2FA: 'YubiKey / MFA Active',
    lastActive: '2 mins ago',
    status: 'Active'
  },
  {
    id: 'usr_2',
    name: 'Elena Rostova',
    email: 'elena.r@codeagent.io',
    role: 'Platform Ops',
    scope: 'K8s Cluster',
    security2FA: 'Authenticator App',
    lastActive: '1 hour ago',
    status: 'Active'
  },
  {
    id: 'usr_3',
    name: 'David Kalu',
    email: 'david.k@codeagent.io',
    role: 'Billing Auditor',
    scope: 'Stripe & Invoices',
    security2FA: 'Authenticator App',
    lastActive: 'Yesterday',
    status: 'Active'
  },
  {
    id: 'usr_4',
    name: 'Sarah Lin',
    email: 'admin@techcorp.com',
    role: 'Tenant Admin',
    scope: 'TechCorp Inc.',
    security2FA: 'Okta SAML',
    lastActive: '12 mins ago',
    status: 'Active'
  },
  {
    id: 'usr_5',
    name: 'Marcus Brody',
    email: 'admin@devstudio.com',
    role: 'Tenant Admin',
    scope: 'DevStudio',
    security2FA: 'Google SSO',
    lastActive: '3 days ago',
    status: 'Active'
  }
];

const INITIAL_WEBHOOK_LOGS: WebhookLog[] = [
  {
    id: 'evt_902a7b81',
    source: 'JIRA',
    ticketOrContext: 'PROJ-101',
    action: 'Issue Assigned: "Implement AST token cache"',
    agent: 'autonomous-refactor-agent',
    httpStatus: '200 OK',
    timestamp: '14:32:08 UTC (Just now)'
  },
  {
    id: 'evt_883c114e',
    source: 'GITHUB',
    ticketOrContext: 'PR #482',
    action: 'Review Comment: "Handle null check on pointer"',
    agent: 'review-resolver-bot',
    httpStatus: '200 OK',
    timestamp: '14:15:42 UTC (16m ago)'
  },
  {
    id: 'evt_771f92a0',
    source: 'LOCAL CLI',
    ticketOrContext: 'PAT: dev-local',
    action: 'Interactive Dry Run on branch: feat/auth-matrix',
    agent: 'cli-interactive-agent',
    httpStatus: '200 OK',
    timestamp: '13:48:19 UTC (44m ago)'
  }
];

interface PlatformContextType {
  // Navigation & Role
  portal: PortalType;
  setPortal: (p: PortalType) => void;
  superAdminPage: SuperAdminPage;
  setSuperAdminPage: (page: SuperAdminPage) => void;
  tenantAdminPage: TenantAdminPage;
  setTenantAdminPage: (page: TenantAdminPage) => void;
  developerPage: DeveloperPage;
  setDeveloperPage: (page: DeveloperPage) => void;
  selectedTenantId: string;
  setSelectedTenantId: (id: string) => void;
  selectedTicketKey: string;
  setSelectedTicketKey: (key: string) => void;
  selectedHistoryRunId: string;
  setSelectedHistoryRunId: (id: string) => void;

  // Data
  companies: Company[];
  currentCompany: Company;
  developers: DeveloperMember[];
  currentTenantDevelopers: DeveloperMember[];
  tickets: JiraTicket[];
  currentTenantTickets: JiraTicket[];
  executionRuns: ExecutionRun[];
  licensePlans: LicensePlan[];
  platformUsers: PlatformUser[];
  webhookLogs: WebhookLog[];

  // LangGraph Runner state for active workbench ticket
  agentRunningTicketKey: string | null;
  agentStepIndex: number;
  agentLogs: TerminalLog[];
  isStreaming: boolean;
  agentProgressPercent: number;

  // Actions
  addCompany: (comp: Omit<Company, 'id' | 'createdDate' | 'usedLicenses' | 'totalLicenses' | 'activeAgents' | 'repos'>) => void;
  updateCompanyStatus: (id: string, status: 'Active' | 'Suspended') => void;
  addDeveloperSeat: (dev: { name: string; email: string; role: DeveloperMember['role'] }) => Promise<any>;
  updateDeveloperSeat: (id: string, updates: Partial<DeveloperMember>) => void;
  revokeDeveloperSeat: (id: string) => void;
  updateTicketStatus: (ticketKey: string, status: JiraTicket['status']) => void;
  updateSettings: (updates: Partial<Company>) => Promise<void>;
  triggerAgentRun: (ticketKey: string, baseBranch?: string) => void;
  cancelAgentRun: () => void;
  approvePullRequest: (ticketKey: string) => void;
  resetDemoState: () => void;

  // Global settings
  minPasswordLength: number;
  setMinPasswordLength: (n: number) => void;
  requireSpecialChars: boolean;
  setRequireSpecialChars: (v: boolean) => void;
  enforceMfa: boolean;
  setEnforceMfa: (v: boolean) => void;
  sessionTimeout: string;
  setSessionTimeout: (v: string) => void;
  autoSuspendBilling: boolean;
  setAutoSuspendBilling: (v: boolean) => void;
  circuitBreaker: boolean;
  setCircuitBreaker: (v: boolean) => void;
  quotaThreshold: string;
  setQuotaThreshold: (v: string) => void;
  smtpHost: string;
  setSmtpHost: (v: string) => void;
  fromEmail: string;
  setFromEmail: (v: string) => void;

  // Telemetry metrics
  clusterLoad: number;
  totalTokensToday: number;
  activeAgentsCount: number;
}

const PlatformContext = createContext<PlatformContextType | undefined>(undefined);

export const PlatformProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Navigation states
  const [portal, setPortal] = useState<PortalType>(() => {
    const token = localStorage.getItem('access_token');
    const role = localStorage.getItem('user_role');
    return (token && role === 'TENANT_ADMIN') ? 'tenant-admin' : 'login';
  });
  const [superAdminPage, setSuperAdminPage] = useState<SuperAdminPage>('dashboard');
  const [tenantAdminPage, setTenantAdminPage] = useState<TenantAdminPage>('overview');
  const [developerPage, setDeveloperPage] = useState<DeveloperPage>('workbench');
  const [selectedTenantId, setSelectedTenantId] = useState<string>(() => {
    try {
      const u = localStorage.getItem('user_data');
      if (u) {
        const parsed = JSON.parse(u);
        if (parsed.company_id) return String(parsed.company_id);
      }
    } catch (e) {}
    return 'techcorp';
  });
  const [selectedTicketKey, setSelectedTicketKey] = useState<string>('PROJ-101');
  const [selectedHistoryRunId, setSelectedHistoryRunId] = useState<string>('LG-8942');

  const [companies, setCompanies] = useState<Company[]>(() => {
    const saved = localStorage.getItem('cag_companies');
    return saved ? JSON.parse(saved) : INITIAL_COMPANIES;
  });

  const [developers, setDevelopers] = useState<DeveloperMember[]>(() => {
    const saved = localStorage.getItem('cag_developers');
    return saved ? JSON.parse(saved) : INITIAL_DEVELOPERS;
  });

  const fetchTenantData = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
      const [dashRes, devRes] = await Promise.all([
        fetch(`${baseUrl}/tenant/dashboard`, { headers }),
        fetch(`${baseUrl}/tenant/developers`, { headers }),
        
      ]);

      if (dashRes.ok && devRes.ok) {
        const dashboard = await dashRes.json();
        const devData = await devRes.json();
        

        // Update companies based on real backend company data + dashboard metrics
        setCompanies(prev => {
          const comp = dashboard.company;
          const compIdStr = String(comp.id);
          const exists = prev.find(c => c.id === compIdStr);
          
          const newCompanyObj: Company = {
             ...(exists || INITIAL_COMPANIES[0]),
             id: compIdStr,
             name: comp.name,
             domain: comp.domain || (exists ? exists.domain : 'techcorp.com'),
             licensePlanTier: comp.license_tier || 'Enterprise',
             totalLicenses: dashboard.metrics.license_limit,
             usedLicenses: dashboard.metrics.licenses_used,
             activeAgents: dashboard.metrics.active_agents,
             status: comp.status === 'ACTIVE' ? 'Active' : 'Suspended',
             slug: comp.name.toLowerCase().replace(/\s+/g, '-'),
             techStack: comp.tech_stack,
             gitProvider: comp.git_provider,
             jiraSync: comp.jira_sync,
             agentRunsUsed: dashboard.metrics.agent_runs_used ?? 0,
             agentRunsMax: dashboard.metrics.agent_runs_max ?? comp.run_cap ?? 15000,
             tokensConsumed: dashboard.metrics.tokens_consumed ?? 0,
             monthlyCost: dashboard.metrics.monthly_cost ?? 199,
             nextBillingDate: dashboard.metrics.next_billing_date ?? 'Nov 1, 2026'
          };
          
          if (exists) {
            return prev.map(c => c.id === compIdStr ? newCompanyObj : c);
          } else {
            return [newCompanyObj, ...prev];
          }
        });
        setSelectedTenantId(String(dashboard.company.id));

        const compId = String(dashboard.company.id);
        const fetchedDevs: DeveloperMember[] = devData.map((d: any) => ({
          id: String(d.id),
          tenantId: compId,
          name: d.name,
          email: d.email,
          role: d.role,
          status: d.status === 'ACTIVE' ? 'Active' : (d.status === 'Invited' ? 'Invited' : d.status),
          addedDate: new Date(d.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          integrations: [
            ...(d.github_token ? ['GitHub'] : []),
            ...(d.jira_token ? ['Jira'] : [])
          ],
          devTag: `dev_${d.name.toLowerCase().replace(/[^a-z]/g, '').slice(0, 2)}_${d.id}`
        }));
        
        // Merge fetched developers with other tenants' developers
        setDevelopers(prev => {
          const otherDevs = prev.filter(p => p.tenantId !== compId);
          return [...otherDevs, ...fetchedDevs];
        });

        
      }
    } catch (e) {
      console.error('Failed to fetch tenant data', e);
    }
  };

  useEffect(() => {
    if (portal === 'tenant-admin') {
      fetchTenantData();
    }
  }, [portal, selectedTenantId]);

  
  const [tickets, setTickets] = useState<JiraTicket[]>(() => {
    const saved = localStorage.getItem('cag_tickets');
    return saved ? JSON.parse(saved) : INITIAL_TICKETS;
  });

  const [executionRuns, setExecutionRuns] = useState<ExecutionRun[]>(() => {
    const saved = localStorage.getItem('cag_execution_runs');
    return saved ? JSON.parse(saved) : INITIAL_RUNS;
  });

  const [licensePlans] = useState<LicensePlan[]>(INITIAL_LICENSE_PLANS);
  const [platformUsers] = useState<PlatformUser[]>(INITIAL_PLATFORM_USERS);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>(INITIAL_WEBHOOK_LOGS);

  // Settings
  const [minPasswordLength, setMinPasswordLength] = useState<number>(12);
  const [requireSpecialChars, setRequireSpecialChars] = useState<boolean>(true);
  const [enforceMfa, setEnforceMfa] = useState<boolean>(true);
  const [sessionTimeout, setSessionTimeout] = useState<string>('1h');
  const [autoSuspendBilling, setAutoSuspendBilling] = useState<boolean>(true);
  const [circuitBreaker, setCircuitBreaker] = useState<boolean>(true);
  const [quotaThreshold, setQuotaThreshold] = useState<string>('90%');
  const [smtpHost, setSmtpHost] = useState<string>('smtp.sendgrid.net (port 587 TLS)');
  const [fromEmail, setFromEmail] = useState<string>('no-reply@codeagent.io');

  // Telemetry metrics
  const [clusterLoad] = useState<number>(34.2);
  const [totalTokensToday] = useState<number>(1240000);

  // Active LangGraph Agent Execution State
  const [agentRunningTicketKey, setAgentRunningTicketKey] = useState<string | null>('PROJ-101');
  const [agentStepIndex, setAgentStepIndex] = useState<number>(2); // 0-based: Step 3 (Execute coding tasks)
  const [isStreaming, setIsStreaming] = useState<boolean>(true);
  const [agentProgressPercent, setAgentProgressPercent] = useState<number>(60);
  const [agentLogs, setAgentLogs] = useState<TerminalLog[]>([
    {
      id: 'log-1',
      timestamp: '14:32:01.102',
      level: 'INFO',
      tag: 'LangGraph',
      message: "Initialized graph runner state from Jira webhook: issue_key='PROJ-101'"
    },
    {
      id: 'log-2',
      timestamp: '14:32:01.890',
      level: 'INFO',
      tag: 'RepoLoader',
      message: 'Synced remote branch techcorp-inc/product-core @ sha: 7f3b890a'
    },
    {
      id: 'log-3',
      timestamp: '14:32:02.341',
      level: 'SUCCESS',
      tag: 'Step 1: GetTicketDetails',
      message: "Extracted repro steps: 'Users receive 401 Unauthorized after 15m session TTL expiration'."
    },
    {
      id: 'log-4',
      timestamp: '14:32:03.112',
      level: 'INFO',
      tag: 'Step 2: RepoIndexing',
      message: 'Performing semantic AST search for JWT expiration handlers...\n→ Identified source targets: src/auth/jwt.strategy.ts, src/auth/refresh.interceptor.ts'
    },
    {
      id: 'log-5',
      timestamp: '14:32:04.550',
      level: 'THOUGHT',
      tag: 'LangChain::AgentExecutor',
      message: 'The issue is caused by race conditions when two parallel requests attempt to rotate the same refresh token concurrently. A Redis lock is required during token swapping.'
    },
    {
      id: 'log-6',
      timestamp: '14:32:05.120',
      level: 'DIFF',
      tag: 'FILE DIFF: src/auth/refresh.interceptor.ts (+14 lines / -3 lines)',
      message: 'Atomic token swap protected with distributed Redis lock lock:auth:${userId}',
      diffLines: [
        { type: 'del', text: '- const userSession = await this.sessionStore.get(userId);' },
        { type: 'del', text: '- return this.generateTokens(userSession);' },
        { type: 'add', text: '+ const sessionLock = await this.redis.acquireLock(`lock:auth:${userId}`, 3000);' },
        { type: 'add', text: '+ try {' },
        { type: 'add', text: '+   const userSession = await this.sessionStore.get(userId);' },
        { type: 'add', text: '+   if (this.isExpired(userSession)) throw new SessionInvalidatedException();' },
        { type: 'add', text: '+   return await this.atomicTokenSwap(userSession);' },
        { type: 'add', text: '+ } finally { await sessionLock.release(); }' }
      ]
    },
    {
      id: 'log-7',
      timestamp: '14:32:06.180',
      level: 'TEST',
      tag: 'Step 3: ExecuteCoding',
      message: 'Running local unit tests on generated patch:\n✓ PASS: src/auth/__tests__/refresh.interceptor.spec.ts (4 tests passed, 0 failures)\n✓ PASS: src/auth/__tests__/concurrency.spec.ts (2 tests passed)'
    },
    {
      id: 'log-8',
      timestamp: '14:32:07.410',
      level: 'AGENT',
      message: 'Synthesizing commit description and preparing git patch for review...'
    }
  ]);

  // Sync to LocalStorage on updates
  useEffect(() => {
    localStorage.setItem('cag_companies', JSON.stringify(companies));
  }, [companies]);

  useEffect(() => {
    localStorage.setItem('cag_developers', JSON.stringify(developers));
  }, [developers]);


  useEffect(() => {
    localStorage.setItem('cag_tickets', JSON.stringify(tickets));
  }, [tickets]);

  useEffect(() => {
    localStorage.setItem('cag_execution_runs', JSON.stringify(executionRuns));
  }, [executionRuns]);

  // Derived current company
  const currentCompany = companies.find(c => c.id === selectedTenantId) || companies[0] || {
    id: 'loading',
    name: 'Loading',
    domain: '',
    licensePlanTier: 'Enterprise 100',
    totalLicenses: 0,
    usedLicenses: 0,
    activeAgents: 0,
    status: 'Active',
    slug: 'loading',
    createdDate: '',
    repos: [],
    adminEmail: ''
  } as Company;

  // Derived filtered developers for current tenant
  const currentTenantDevelopers = developers.filter(d => d.tenantId === selectedTenantId);

  // Derived filtered projects for current tenant
  
  // Derived filtered tickets for current tenant
  const currentTenantTickets = tickets.filter(t => t.tenantId === selectedTenantId);

  // Active agents count
  const activeAgentsCount = companies.reduce((acc, c) => acc + (c.status === 'Active' ? c.activeAgents : 0), 400);

  // Synchronized Actions:
  // 1. Add Company from Super Admin
  const addCompany = (comp: Omit<Company, 'id' | 'createdDate' | 'usedLicenses' | 'totalLicenses' | 'activeAgents' | 'repos'>) => {
    const totalMap: Record<Company['licensePlanTier'], number> = {
      '20 Dev Plan': 20,
      '50 Dev Plan': 50,
      'Enterprise 100': 100
    };
    const total = totalMap[comp.licensePlanTier] || 20;
    const newId = comp.slug.toLowerCase().replace(/[^a-z0-9]/g, '');
    const newCompany: Company = {
      ...comp,
      id: newId,
      usedLicenses: 1, // initial admin takes 1 seat
      totalLicenses: total,
      activeAgents: 1,
      createdDate: new Date().toISOString().split('T')[0],
      repos: [`${newId}-org/core-repo`]
    };

    setCompanies(prev => [newCompany, ...prev]);

    // Also provision an initial developer member for that company
    const newDev: DeveloperMember = {
      id: `dev_${Date.now()}`,
      tenantId: newId,
      name: 'Organization Admin',
      email: comp.adminEmail,
      role: 'Lead',
      status: 'Active',
      addedDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      integrations: ['GitHub', 'Jira'],
      devTag: `dev_${newId}_01`
    };
    setDevelopers(prev => [...prev, newDev]);

    // Add default project mapping
    const newProj: ProjectMapping = {
      id: `proj_${Date.now()}`,
      tenantId: newId,
      key: 'PROJ',
      title: `${comp.name} Core Service`,
      targetRepo: `${newId}-org/core-repo`,
      branch: 'main',
      assignedDevCount: 1,
      agentPermissions: ['Auto-PR generation', 'Unit testing enabled'],
      status: 'Active (Synced just now)',
      openTicketsCount: 1
    };
    
    // Add a default ticket
    const newTicket: JiraTicket = {
      key: `${newId.toUpperCase().slice(0, 4)}-101`,
      tenantId: newId,
      projectKey: 'PROJ',
      title: `Initialize ${comp.name} agent testing sandbox`,
      description: 'Bootstrap repository AST parser and connect Jira webhook event stream.',
      priority: 'High',
      status: 'Open',
      points: 3,
      estimatedHours: '3h',
      targetRepo: `${newId}-org/core-repo`,
      branch: 'main',
      criteria: ['Initialize Docker container sandbox', 'Run health check ping'],
      completedCriteria: 0,
      assignedTo: 'Organization Admin',
      fileTarget: 'src/main.ts',
      agentPrompt: 'Bootstrap sandbox environment and generate initial health test.',
      preset: 'Refactor & optimize',
      modelTarget: 'Claude 3.5 Sonnet',
      pullRequestPolicy: 'Auto-create Draft PR',
      targetEnvironment: 'staging-sandbox-01'
    };
    setTickets(prev => [newTicket, ...prev]);

    // Add a webhook log
    const newLog: WebhookLog = {
      id: `evt_${Math.random().toString(36).substring(2, 8)}`,
      source: 'JIRA',
      ticketOrContext: comp.slug,
      action: `Company Provisioned: "${comp.name}" with ${comp.licensePlanTier}`,
      agent: 'tenant-provisioning-pipeline',
      httpStatus: '200 OK',
      timestamp: 'Just now'
    };
    setWebhookLogs(prev => [newLog, ...prev]);
  };

  // 2. Suspend / Activate Company
  const updateCompanyStatus = (id: string, status: 'Active' | 'Suspended') => {
    setCompanies(prev => prev.map(c => c.id === id ? { ...c, status } : c));
  };

  // 3. Add Developer Seat in Tenant
  const addDeveloperSeat = async (dev: { name: string; email: string; role: DeveloperMember['role'] }) => {
    try {
      const token = localStorage.getItem('access_token');
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
      const response = await fetch(`${baseUrl}/tenant/developers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: dev.name, email: dev.email, role: dev.role })
      });
      if (response.ok) {
        const result = await response.json();
        fetchTenantData();
        return result;
      } else {
        const err = await response.json();
        toast.error(`Error: ${err.detail}`);
        return null;
      }
    } catch (e) {
      console.error("Failed to add developer", e);
      toast.error("Failed to add developer");
      return null;
    }
  };

  // 4. Update Developer Seat
  const updateDeveloperSeat = async (devId: string, updates: Partial<DeveloperMember>) => {
    try {
      const token = localStorage.getItem('access_token');
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
      const response = await fetch(`${baseUrl}/tenant/developers/${devId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });
      if (response.ok) {
        fetchTenantData();
        return true;
      } else {
        const err = await response.json();
        toast.error(`Error: ${err.detail}`);
        return false;
      }
    } catch (e) {
      console.error("Failed to update developer", e);
      toast.error("Failed to update developer");
      return false;
    }
  };

  // 5. Revoke Developer Seat
  const revokeDeveloperSeat = async (devId: string) => {
    try {
      const token = localStorage.getItem('access_token');
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
      const response = await fetch(`${baseUrl}/tenant/developers/${devId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        fetchTenantData();
        return true;
      } else {
        const err = await response.json();
        toast.error(`Error: ${err.detail}`);
        return false;
      }
    } catch (e) {
      console.error("Failed to revoke developer", e);
      toast.error("Failed to revoke developer");
      return false;
    }
  };

  // 5. Update Ticket Status
  const updateTicketStatus = (ticketKey: string, status: JiraTicket['status']) => {
    setTickets(prev => prev.map(t => t.key === ticketKey ? { ...t, status } : t));
  };

  const updateSettings = async (updates: Partial<Company>) => {
    try {
      const token = localStorage.getItem('access_token');
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
      
      const payload: any = {};
      if (updates.name !== undefined) payload.name = updates.name;
      
      if (Object.keys(payload).length > 0) {
        await fetch(`${baseUrl}/tenant/settings`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
      }

      setCompanies(prev => prev.map(c => 
        c.id === selectedTenantId ? { ...c, ...updates } : c
      ));
    } catch (e) {
      console.error('Failed to update settings', e);
      // Fallback
      setCompanies(prev => prev.map(c => 
        c.id === selectedTenantId ? { ...c, ...updates } : c
      ));
    }
  };

  // 7. Trigger Agent Run (LangGraph Simulation + FastAPI Backend)
  const triggerAgentRun = async (ticketKey: string, baseBranch: string = "dev") => {
    setSelectedTicketKey(ticketKey);
    setAgentRunningTicketKey(ticketKey);
    setAgentStepIndex(0);
    setIsStreaming(true);
    setAgentProgressPercent(20);

    const ticket = tickets.find(t => t.key === ticketKey);
    const title = ticket ? ticket.title : 'Task execution';
    const requirement = ticket ? ticket.description : 'Please complete the task.';

    const initialLogs: TerminalLog[] = [
      {
        id: `log-${Date.now()}-1`,
        timestamp: new Date().toLocaleTimeString(),
        level: 'INFO',
        tag: 'LangGraph',
        message: `Initialized autonomous runner for ${ticketKey} on branch ${baseBranch}: "${title}"`
      }
    ];
    setAgentLogs(initialLogs);

    // Call actual backend to trigger execution
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/developer/executions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: ticketKey,
          requirement: requirement,
          base_branch: baseBranch
        })
      });
      if (!response.ok) {
        throw new Error('Failed to enqueue job');
      }
    } catch (e) {
      console.error(e);
      setAgentLogs(prev => [...prev, {
        id: `log-${Date.now()}-error`,
        timestamp: new Date().toLocaleTimeString(),
        level: 'AGENT',
        tag: 'LangGraph',
        message: 'Failed to contact backend.'
      }]);
    }
    // Update ticket state to In Progress
    updateTicketStatus(ticketKey, 'In Progress');

    // Simulate Step 2 after 1.5s
    setTimeout(() => {
      setAgentStepIndex(1);
      setAgentProgressPercent(40);
      setAgentLogs(prev => [
        ...prev,
        {
          id: `log-${Date.now()}-3`,
          timestamp: new Date().toLocaleTimeString(),
          level: 'SUCCESS',
          tag: 'Step 1: GetTicketDetails',
          message: 'Acceptance criteria indexed. 3 unit test targets mapped.'
        },
        {
          id: `log-${Date.now()}-4`,
          timestamp: new Date().toLocaleTimeString(),
          level: 'INFO',
          tag: 'Step 2: RepoIndexing',
          message: `Performing semantic AST search for ${ticket?.fileTarget || 'source files'}...`
        }
      ]);
    }, 1200);

    // Simulate Step 3 after 3s
    setTimeout(() => {
      setAgentStepIndex(2);
      setAgentProgressPercent(65);
      setAgentLogs(prev => [
        ...prev,
        {
          id: `log-${Date.now()}-5`,
          timestamp: new Date().toLocaleTimeString(),
          level: 'THOUGHT',
          tag: 'LangChain::AgentExecutor',
          message: `Synthesizing patch using ${ticket?.modelTarget || 'Claude 3.5 Sonnet'}. Applying concurrency safeguards.`
        },
        {
          id: `log-${Date.now()}-6`,
          timestamp: new Date().toLocaleTimeString(),
          level: 'DIFF',
          tag: `FILE DIFF: ${ticket?.fileTarget || 'src/handler.ts'} (+12 lines / -2 lines)`,
          message: 'Patch verified by tool_call:fs_patch',
          diffLines: [
            { type: 'del', text: '- // legacy unhandled error state' },
            { type: 'add', text: '+ // protected atomic operation with telemetry logging' },
            { type: 'add', text: '+ const result = await executeWithSafeFallback(context);' },
            { type: 'add', text: '+ return result;' }
          ]
        }
      ]);
    }, 2800);

    // Simulate Step 4 & 5 after 5s
    setTimeout(() => {
      setAgentStepIndex(4);
      setAgentProgressPercent(100);
      setIsStreaming(false);

      const prNum = `#${Math.floor(100 + Math.random() * 900)}`;

      setAgentLogs(prev => [
        ...prev,
        {
          id: `log-${Date.now()}-7`,
          timestamp: new Date().toLocaleTimeString(),
          level: 'TEST',
          tag: 'Step 4: ExecuteCoding',
          message: '✓ vitest run: 42 test suites passed in 238ms (0 regressions)'
        },
        {
          id: `log-${Date.now()}-8`,
          timestamp: new Date().toLocaleTimeString(),
          level: 'SUCCESS',
          tag: 'Step 5: CreatePR',
          message: `Draft PR ${prNum} generated and linked to Jira ticket ${ticketKey}. Status: Ready for Review!`
        }
      ]);

      // Update ticket to PR Ready
      setTickets(prev => prev.map(t => t.key === ticketKey ? { ...t, status: 'PR Ready', prNumber: prNum } : t));

      // Append new Execution Run in History
      const newRun: ExecutionRun = {
        id: `LG-${Math.floor(8950 + Math.random() * 50)}`,
        ticketKey: ticketKey,
        taskTitle: title,
        assignedTo: ticket?.assignedTo || 'John Doe',
        timeAgo: 'Just now',
        commitHash: Math.random().toString(36).substring(2, 9),
        branch: ticket?.branch || 'main',
        model: ticket?.modelTarget || 'Claude 3.5 Sonnet',
        phase: 'PR Generated',
        duration: '14.2s',
        stepsCount: 5,
        status: 'Completed',
        addedLines: 52,
        deletedLines: 14,
        tokenUsage: '22,400 prompt / 1,320 compl',
        files: [
          {
            name: ticket?.fileTarget || 'src/controller.ts',
            added: 52,
            deleted: 14,
            description: 'Automated patch generated and verified by LangGraph runner.'
          }
        ],
        stepBreakdown: [
          { name: '1. ingest_jira_spec', latency: '0.8s', tokens: '2.5k', detail: 'Parsed acceptance criteria' },
          { name: '2. reasoning_and_graph_recursion', latency: '6.4s', tokens: '14.2k', detail: 'Generated code patch' },
          { name: '3. patch_file_system', latency: '1.2s', tokens: '1.1k', detail: 'Formatted with Prettier' },
          { name: '4. run_unit_tests', latency: '4.1s', tokens: 'vitest', detail: '42 tests passed' },
          { name: '5. finalize_git_pr', latency: '1.7s', tokens: 'API', detail: `Created PR ${prNum}` }
        ],
        sandboxStdout: [
          `$ vitest run --silent`,
          `✓ PASS: ${ticket?.fileTarget || 'tests/suite.ts'} (42 tests)`,
          `✨ PR ${prNum} created on GitHub repository.`
        ]
      };
      setExecutionRuns(prev => [newRun, ...prev]);

      // Add webhook log
      setWebhookLogs(prev => [
        {
          id: `evt_${Math.random().toString(36).substring(2, 8)}`,
          source: 'GITHUB',
          ticketOrContext: prNum,
          action: `PR Opened for ${ticketKey}: "${title}"`,
          agent: 'langgraph-executor',
          httpStatus: '200 OK',
          timestamp: 'Just now'
        },
        ...prev
      ]);
    }, 4500);
  };

  const cancelAgentRun = () => {
    setIsStreaming(false);
    setAgentLogs(prev => [
      ...prev,
      {
        id: `log-${Date.now()}-cancelled`,
        timestamp: new Date().toLocaleTimeString(),
        level: 'INFO',
        tag: 'AgentRunner',
        message: 'Agent execution manually stopped by operator.'
      }
    ]);
  };

  const approvePullRequest = (ticketKey: string) => {
    updateTicketStatus(ticketKey, 'Completed');
    setAgentLogs(prev => [
      ...prev,
      {
        id: `log-${Date.now()}-approved`,
        timestamp: new Date().toLocaleTimeString(),
        level: 'SUCCESS',
        tag: 'GitHub Merge',
        message: `Pull request for ${ticketKey} merged into main. Jira ticket closed!`
      }
    ]);
  };

  const resetDemoState = () => {
    localStorage.removeItem('cag_companies');
    localStorage.removeItem('cag_developers');
    localStorage.removeItem('cag_projects');
    localStorage.removeItem('cag_tickets');
    localStorage.removeItem('cag_execution_runs');
    setCompanies(INITIAL_COMPANIES);
    setDevelopers(INITIAL_DEVELOPERS);
        setTickets(INITIAL_TICKETS);
    setExecutionRuns(INITIAL_RUNS);
    setAgentRunningTicketKey('PROJ-101');
    setSelectedTicketKey('PROJ-101');
    setAgentStepIndex(2);
    setIsStreaming(true);
  };

  return (
    <PlatformContext.Provider
      value={{
        portal,
        setPortal,
        superAdminPage,
        setSuperAdminPage,
        tenantAdminPage,
        setTenantAdminPage,
        developerPage,
        setDeveloperPage,
        selectedTenantId,
        setSelectedTenantId,
        selectedTicketKey,
        setSelectedTicketKey,
        selectedHistoryRunId,
        setSelectedHistoryRunId,

        companies,
        currentCompany,
        developers,
        currentTenantDevelopers,
        tickets,
        currentTenantTickets,
        executionRuns,
        licensePlans,
        platformUsers,
        webhookLogs,

        agentRunningTicketKey,
        agentStepIndex,
        agentLogs,
        isStreaming,
        agentProgressPercent,

        addCompany,
        updateCompanyStatus,
        addDeveloperSeat,
        updateDeveloperSeat,
        revokeDeveloperSeat,
        updateTicketStatus,
        
        updateSettings,
        triggerAgentRun,
        cancelAgentRun,
        approvePullRequest,
        resetDemoState,

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
        fromEmail,
        setFromEmail,

        clusterLoad,
        totalTokensToday,
        activeAgentsCount
      }}
    >
      {children}
    </PlatformContext.Provider>
  );
};

export const usePlatform = () => {
  const context = useContext(PlatformContext);
  if (!context) {
    throw new Error('usePlatform must be used within a PlatformProvider');
  }
  return context;
};
