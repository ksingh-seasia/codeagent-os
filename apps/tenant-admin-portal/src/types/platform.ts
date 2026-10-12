export type PortalType = 'super-admin' | 'tenant-admin' | 'developer' | 'login';

export type SuperAdminPage = 
  | 'dashboard'
  | 'companies'
  | 'license-plans'
  | 'users'
  | 'analytics'
  | 'settings'
  | 'projects';

export type TenantAdminPage = 
  | 'overview'
  | 'developers'
  | 'projects'
  | 'license-usage'
  | 'settings';

export type DeveloperPage = 
  | 'workbench'
  | 'diff-review'
  | 'history'
  | 'trace-logs'
  | 'integrations'
  | 'projects'
  | 'settings';

export interface Company {
  id: string;
  name: string;
  slug: string;
  domain: string;
  licensePlanTier: '20 Dev Plan' | '50 Dev Plan' | 'Enterprise 100';
  usedLicenses: number;
  totalLicenses: number;
  status: 'Active' | 'Suspended';
  adminEmail: string;
  activeAgents: number;
  createdDate: string;
  repos: string[];
  dedicatedRedis?: boolean;
  autoProvisionPostgres?: boolean;
  langsmithTracing?: boolean;
  techStack?: string;
  gitProvider?: string;
  jiraSync?: boolean;
  agentRunsUsed?: number;
  agentRunsMax?: number;
  tokensConsumed?: number;
  monthlyCost?: number;
  nextBillingDate?: string;
}

export interface DeveloperMember {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: 'Developer' | 'Senior Dev' | 'Staff Dev' | 'Lead' | 'Team Lead';
  status: 'Active' | 'Open' | 'Invited' | 'Suspended';
  addedDate: string;
  integrations: string[];
  avatar?: string;
  devTag: string;
}

export interface ProjectMapping {
  id: string;
  tenantId: string;
  key: string;
  title: string;
  targetRepo: string;
  branch: string;
  assignedDevCount: number;
  agentPermissions: string[];
  status: string;
  openTicketsCount: number;
}

export interface JiraTicket {
  key: string;
  tenantId: string;
  projectKey: string;
  title: string;
  description: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'Open' | 'In Progress' | 'PR Ready' | 'Completed';
  points: number;
  estimatedHours: string;
  targetRepo: string;
  branch: string;
  criteria: string[];
  completedCriteria: number;
  assignedTo: string;
  assignedToEmail?: string;
  fileTarget: string;
  agentPrompt: string;
  preset: string;
  modelTarget: string;
  pullRequestPolicy: string;
  targetEnvironment: string;
  prNumber?: string;
  isLangGraphActive?: boolean;
}

export interface TerminalLog {
  id: string;
  timestamp: string;
  level: 'INFO' | 'SUCCESS' | 'THOUGHT' | 'AGENT' | 'DIFF' | 'TEST';
  tag?: string;
  message: string;
  diffLines?: {
    type: 'add' | 'del' | 'context';
    text: string;
  }[];
}

export interface LangGraphStep {
  stepNumber: number;
  name: string;
  detail: string;
  status: 'completed' | 'current' | 'pending';
  latency?: string;
  tokens?: string;
}

export interface ExecutionRun {
  id: string;
  ticketKey: string;
  taskTitle: string;
  assignedTo: string;
  timeAgo: string;
  commitHash: string;
  branch: string;
  model: string;
  phase: string;
  duration: string;
  stepsCount: number;
  status: 'Completed' | 'In Progress' | 'Needs Review' | 'Failed';
  addedLines: number;
  deletedLines: number;
  tokenUsage: string;
  files: {
    name: string;
    added: number;
    deleted: number;
    description: string;
  }[];
  stepBreakdown: {
    name: string;
    latency: string;
    tokens: string;
    detail: string;
  }[];
  sandboxStdout: string[];
}

export interface LicensePlan {
  id: string;
  name: string;
  price: number;
  billingPeriod: string;
  badge?: string;
  seatLimit: string;
  seatLimitNum: number;
  agentConcurrency: string;
  subscribedTenants: number;
  infrastructure: string;
}

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  role: 'Super Admin' | 'Platform Ops' | 'Billing Auditor' | 'Tenant Admin';
  scope: string;
  security2FA: string;
  lastActive: string;
  status: 'Active' | 'Suspended';
}

export interface WebhookLog {
  id: string;
  source: 'JIRA' | 'GITHUB' | 'LOCAL CLI';
  ticketOrContext: string;
  action: string;
  agent: string;
  httpStatus: string;
  timestamp: string;
  payloadJson?: string;
}
