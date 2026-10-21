/**
 * Mock data layer for the SYNDESIS Trustee design prototype.
 *
 * This app is a static showcase ("dummy data, just a design") and is deployed
 * without a live database. This module replaces PrismaClient with an in-memory
 * store seeded from prisma/seed.ts, supporting the query shapes the app uses
 * (findMany/findUnique/findFirst/count/aggregate + where/orderBy/include, and
 * create/update/upsert/updateMany/deleteMany for the interactive actions).
 */

import {
  Role,
  ProjectStatus,
  GateType,
  DrawdownStatus,
  AccountType,
  CashTxnType,
  CashTxnDirection,
  KycStatus,
  DocumentType,
} from "@prisma/client";

// The mock store is intentionally loosely typed: this is a dummy-data design
// prototype, not a real persistence layer, so we treat records as `any`.
type Rec = any;

const NOW = Date.now();
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000);
const daysAhead = (d: number) => new Date(NOW + d * 86_400_000);

const SEED_STORE: Record<string, Rec[]> = {
  user: [
    {
      id: "user_fidu",
      name: "Adewale Fiduciary Lead",
      email: "fiduciary@firsttrustees.com",
      hashedPassword: "hashed_pass",
      role: Role.FIDUCIARY_EXEC,
      isActive: true,
      createdAt: daysAgo(200),
      updatedAt: daysAgo(10),
    },
    {
      id: "user_mon",
      name: "Engr. Kabir (Independent Monitor)",
      email: "monitor@tech-cert.org",
      hashedPassword: "hashed_pass",
      role: Role.INDEPENDENT_MONITOR,
      isActive: true,
      createdAt: daysAgo(150),
      updatedAt: daysAgo(10),
    },
    {
      id: "user_mon2",
      name: "Engr. Adaeze Okeke (Independent Monitor)",
      email: "monitor2@tech-cert.org",
      hashedPassword: "hashed_pass",
      role: Role.INDEPENDENT_MONITOR,
      isActive: true,
      createdAt: daysAgo(140),
      updatedAt: daysAgo(10),
    },
    {
      id: "user_mon3",
      name: "Surveyor Bello Sani (Independent Monitor)",
      email: "monitor3@tech-cert.org",
      hashedPassword: "hashed_pass",
      role: Role.INDEPENDENT_MONITOR,
      isActive: true,
      createdAt: daysAgo(100),
      updatedAt: daysAgo(10),
    },
  ],
  project: [
    {
      id: "proj_1",
      name: "SYNDESIS Purple&Grey / Harbor Alpha",
      code: "SYND-HARBOR-001",
      status: ProjectStatus.ACTIVE,
      totalBudget: 1_200_000_000,
      fundingCloseDate: daysAgo(120),
      targetCompletion: daysAhead(180),
      createdAt: daysAgo(130),
      updatedAt: daysAgo(120),
    },
  ],
  conditionPrecedent: [
    {
      id: "cp_1",
      projectId: "proj_1",
      masterScheduleExecuted: true,
      landRegistryLienRegistered: true,
      boqApproved: true,
      minimumFundingMet: true,
      insuranceVerified: true,
      clearedForActivation: true,
      activatedAt: daysAgo(120),
      lienVacated: false,
      lienVacatedAt: null,
    },
  ],
  bankAccount: [
    {
      id: "ba_inv",
      projectId: "proj_1",
      type: AccountType.PROJECT_INVESTMENT_ACCT,
      accountNumber: "1029384756",
      bankName: "First Bank of Nigeria",
      balance: 450_000_000,
      currency: "NGN",
      createdAt: daysAgo(120),
      updatedAt: daysAgo(120),
    },
    {
      id: "ba_asset",
      projectId: "proj_1",
      type: AccountType.ASSET_PURCHASE_ACCT,
      accountNumber: "1029384767",
      bankName: "First Bank of Nigeria",
      balance: 225_000_000,
      currency: "NGN",
      createdAt: daysAgo(120),
      updatedAt: daysAgo(120),
    },
    {
      id: "ba_exec",
      projectId: "proj_1",
      type: AccountType.PROJECT_EXECUTION_ACCT,
      accountNumber: "5060708090",
      bankName: "Zenith Bank",
      balance: 0,
      currency: "NGN",
      createdAt: daysAgo(120),
      updatedAt: daysAgo(120),
    },
  ],
  cashTransaction: [
    {
      id: "ct_sub",
      projectId: "proj_1",
      bankAccountId: "ba_inv",
      type: CashTxnType.PROJECT_INVESTMENT_SUBSCRIPTION,
      direction: CashTxnDirection.IN,
      amount: 450_000_000,
      currency: "NGN",
      referenceId: null,
      note: "Project Investor subscriptions received and safeguarded in trust.",
      recordedById: "user_fidu",
      recordedAt: daysAgo(120),
    },
    {
      id: "ct_asset",
      projectId: "proj_1",
      bankAccountId: "ba_asset",
      type: CashTxnType.ASSET_PURCHASE_COLLECTION,
      direction: CashTxnDirection.IN,
      amount: 225_000_000,
      currency: "NGN",
      referenceId: null,
      note: "Asset purchase collections received and safeguarded in trust.",
      recordedById: "user_fidu",
      recordedAt: daysAgo(120),
    },
    {
      id: "ct_pay_out",
      projectId: "proj_1",
      bankAccountId: "ba_inv",
      type: CashTxnType.DRAWDOWN_DISBURSEMENT,
      direction: CashTxnDirection.OUT,
      amount: 45_000_000,
      referenceId: "dr_1",
      note: "Drawdown released from Investment custody for G2 Substructure.",
      recordedById: "user_fidu",
      recordedAt: daysAgo(1),
    },
    {
      id: "ct_pay_in",
      projectId: "proj_1",
      bankAccountId: "ba_exec",
      type: CashTxnType.DRAWDOWN_DISBURSEMENT,
      direction: CashTxnDirection.IN,
      amount: 45_000_000,
      referenceId: "dr_1",
      note: "Drawdown received into Execution account for G2 Substructure.",
      recordedById: "user_fidu",
      recordedAt: daysAgo(1),
    },
  ],
  projectMonitor: [
    {
      id: "pm_1",
      projectId: "proj_1",
      monitorId: "user_mon",
      appointedById: "user_fidu",
      eligibilityCriteriaMet: true,
      independenceDeclarationSigned: true,
      declarationDocUrl: "/uploads/monitor-declaration-sample.pdf",
      appointedAt: daysAgo(118),
    },
  ],
  monitorCredential: [
    {
      id: "mc_1",
      userId: "user_mon",
      professionalBody: "COREN",
      registrationNumber: "RCOREN-22981",
      experienceSummary:
        "15+ years independent monitoring of mixed-use and residential developments across Lagos and Abuja at comparable scale.",
      piInsuranceVerified: true,
      piInsuranceDocUrl: "/uploads/pi-insurance-sample.pdf",
      kycStatus: KycStatus.VERIFIED,
      kycNote: "KYC verified — COREN registration and PI insurance confirmed.",
      createdAt: daysAgo(118),
      updatedAt: daysAgo(2),
    },
    {
      id: "mc_2",
      userId: "user_mon2",
      professionalBody: "NIQS",
      registrationNumber: "RNIQS-11872",
      experienceSummary:
        "Quantity surveying and cost assurance for infrastructure and estate projects; specialist in milestone verification.",
      piInsuranceVerified: false,
      piInsuranceDocUrl: null,
      kycStatus: KycStatus.PENDING,
      kycNote: null,
      createdAt: daysAgo(140),
      updatedAt: daysAgo(10),
    },
    {
      id: "mc_3",
      userId: "user_mon3",
      professionalBody: "ARCON",
      registrationNumber: "RARCON-5521",
      experienceSummary:
        "Architect and independent certifier with extensive high-rise and mixed-development monitoring experience.",
      piInsuranceVerified: true,
      piInsuranceDocUrl: "/uploads/pi-insurance-sample.pdf",
      kycStatus: KycStatus.UNDER_REVIEW,
      kycNote: null,
      createdAt: daysAgo(100),
      updatedAt: daysAgo(10),
    },
  ],
  documentVault: [
    {
      id: "dv_1",
      drawdownRequestId: null,
      referenceId: "user_mon",
      documentType: DocumentType.MONITOR_ID,
      s3Url: "/uploads/monitor-id-sample.pdf",
      fileName: "National ID - Engr. Kabir.pdf",
      uploadedAt: daysAgo(118),
    },
    {
      id: "dv_2",
      drawdownRequestId: null,
      referenceId: "user_mon",
      documentType: DocumentType.PROFESSIONAL_LICENSE,
      s3Url: "/uploads/professional-license-sample.pdf",
      fileName: "COREN License Certificate.pdf",
      uploadedAt: daysAgo(118),
    },
    {
      id: "dv_3",
      drawdownRequestId: null,
      referenceId: "user_mon",
      documentType: DocumentType.PI_INSURANCE,
      s3Url: "/uploads/pi-insurance-sample.pdf",
      fileName: "Professional Indemnity Cover Note.pdf",
      uploadedAt: daysAgo(118),
    },
  ],
  drawdownRequest: [
    {
      id: "dr_1",
      projectId: "proj_1",
      requestedById: "user_fidu",
      gateType: GateType.G2_SUBSTRUCTURE,
      requestedAmount: 45_000_000,
      status: DrawdownStatus.PAID,
      estimateAtCompletion: 48_000_000,
      submissionDate: daysAgo(6),
      slaDeadline: daysAgo(1),
      createdAt: daysAgo(6),
      updatedAt: daysAgo(1),
    },
    {
      id: "dr_2",
      projectId: "proj_1",
      requestedById: "user_fidu",
      gateType: GateType.G1_PRELIM_PROCUREMENT_01,
      requestedAmount: 12_000_000,
      status: DrawdownStatus.SUBMITTED,
      estimateAtCompletion: null,
      submissionDate: daysAgo(2),
      slaDeadline: daysAhead(3),
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
    },
  ],
  deficiencyNotice: [],
  monitorCertificate: [
    {
      id: "mcert_1",
      drawdownRequestId: "dr_1",
      monitorId: "user_mon",
      physicalProgressVerified: true,
      varianceFlagged: false,
      notes:
        "Substructure inspected and verified at 42% physical completion against a 40% baseline programme. No cost or schedule variance flagged.",
      estimateAtCompletion: 48_000_000,
      issuedAt: daysAgo(1),
    },
  ],
  auditLog: [
    {
      id: "al_1",
      projectId: "proj_1",
      actorId: "user_fidu",
      actorName: "Adewale Fiduciary Lead",
      action: "PROJECT_ACTIVATED",
      details: "Conditions Precedent cleared; project activated and Funding Close Date locked.",
      timestamp: daysAgo(120),
    },
    {
      id: "al_3",
      projectId: "proj_1",
      actorId: "user_mon",
      actorName: "Engr. Kabir",
      action: "PHYSICAL_MILESTONE_CERTIFIED",
      details: "Physical progress verified: true. EAC set to ₦48,000,000.",
      timestamp: daysAgo(1),
    },
    {
      id: "al_4",
      projectId: "proj_1",
      actorId: "user_fidu",
      actorName: "Adewale Fiduciary Lead",
      action: "DRAWDOWN_PAID",
      details: "Trustee released final payment of ₦45,000,000. Receipts issued to developer and investors.",
      timestamp: daysAgo(1),
    },
  ],

  // --- Parties outside First Trustees: the capital subscribers and the developer ---
  investor: [
    {
      id: "inv_1",
      projectId: "proj_1",
      name: "Highnet Heritage Partners",
      email: "capital@highnet.com",
      committedAmount: 200_000_000,
      kycStatus: KycStatus.VERIFIED,
      paymentStatus: "ACKNOWLEDGED",
      paidAt: daysAgo(118),
      acknowledgedAt: daysAgo(117),
    },
    {
      id: "inv_2",
      projectId: "proj_1",
      name: "Lagos Pension Co-Investment Scheme",
      email: "investments@lpcs.ng",
      committedAmount: 150_000_000,
      kycStatus: KycStatus.VERIFIED,
      paymentStatus: "RECEIVED",
      paidAt: daysAgo(4),
      acknowledgedAt: null,
    },
    {
      id: "inv_3",
      projectId: "proj_1",
      name: "Midas Family Office",
      email: "office@midas.ng",
      committedAmount: 100_000_000,
      kycStatus: KycStatus.UNDER_REVIEW,
      paymentStatus: "RECEIVED",
      paidAt: daysAgo(2),
      acknowledgedAt: null,
    },
  ],
  developer: [
    {
      id: "dev_1",
      projectId: "proj_1",
      name: "Harbor Alpha Developers Ltd",
      contactEmail: "finance@harboralpha.com",
      pocName: "Mr. Tunde Balogun",
      pocRole: "Project Finance Director",
    },
  ],

  // --- Trustee-initiated per-drawdown monitor assignment (the "card" the monitor acts on) ---
  monitorAssignment: [
    {
      id: "ma_1",
      drawdownRequestId: "dr_1",
      projectId: "proj_1",
      monitorId: "user_mon",
      phase: GateType.G2_SUBSTRUCTURE,
      status: "CONFIRMED",
      initiatedAt: daysAgo(2),
      confirmedAt: daysAgo(1),
      notes: "Independent Monitor verified physical milestone prior to fiduciary disbursement.",
    },
  ],

  // --- Outbound communications / receipts issued by the Trustee (to developer & investors) ---
  notification: [
    {
      id: "nt_1",
      projectId: "proj_1",
      recipientType: "DEVELOPER",
      recipientRef: "dev_1",
      title: "Drawdown DR_… (G1) Acknowledged",
      body: "Your Gate G1 drawdown request has been acknowledged by First Trustees. Independent Monitor appointed for verification.",
      relatedDrawdownId: "dr_2",
      createdAt: daysAgo(6),
    },
    {
      id: "nt_2",
      projectId: "proj_1",
      recipientType: "INVESTOR",
      recipientRef: "inv_1",
      title: "Capital Safely Safeguarded",
      body: "Your subscription of ₦200,000,000 has been acknowledged and is held in the Project Investment trust account.",
      relatedDrawdownId: null,
      createdAt: daysAgo(117),
    },
    {
      id: "nt_disb",
      projectId: "proj_1",
      recipientType: "DEVELOPER",
      recipientRef: "dev_1",
      title: "Disbursement Receipt",
      body: "Payment of ₦45,000,000 for G2 Substructure has been released to your execution account. Receipt FT-DR1SUB issued by First Trustees.",
      relatedDrawdownId: "dr_1",
      createdAt: daysAgo(1),
    },
    {
      id: "nt_inv_rel",
      projectId: "proj_1",
      recipientType: "INVESTOR",
      recipientRef: "inv_1",
      title: "Drawdown Released to Developer",
      body: "A drawdown of ₦45,000,000 for G2 Substructure has been released to the developer. Your safeguarded capital remains tracked and reconciled by the Trustee.",
      relatedDrawdownId: "dr_1",
      createdAt: daysAgo(1),
    },
  ],
};

const globalForStore = globalThis as unknown as {
  __syndesisStore?: Record<string, Rec[]>;
};
const store: Record<string, Rec[]> =
  globalForStore.__syndesisStore ?? (globalForStore.__syndesisStore = SEED_STORE);

const RELATIONS: Record<string, Record<string, { model: string; local: string; remote: string; many: boolean }>> = {
  user: {
    monitorCredential: { model: "monitorCredential", local: "id", remote: "userId", many: false },
    appointedProjects: { model: "projectMonitor", local: "id", remote: "monitorId", many: true },
    certificates: { model: "monitorCertificate", local: "id", remote: "monitorId", many: true },
  },
  project: {
    conditionPrecedent: { model: "conditionPrecedent", local: "id", remote: "projectId", many: false },
    bankAccounts: { model: "bankAccount", local: "id", remote: "projectId", many: true },
    drawdownRequests: { model: "drawdownRequest", local: "id", remote: "projectId", many: true },
    auditLogs: { model: "auditLog", local: "id", remote: "projectId", many: true },
    cashTransactions: { model: "cashTransaction", local: "id", remote: "projectId", many: true },
    projectMonitors: { model: "projectMonitor", local: "id", remote: "projectId", many: true },
    investors: { model: "investor", local: "id", remote: "projectId", many: true },
    developers: { model: "developer", local: "id", remote: "projectId", many: true },
    monitorAssignments: { model: "monitorAssignment", local: "id", remote: "projectId", many: true },
    notifications: { model: "notification", local: "id", remote: "projectId", many: true },
  },
  investor: {
    project: { model: "project", local: "projectId", remote: "id", many: false },
  },
  developer: {
    project: { model: "project", local: "projectId", remote: "id", many: false },
  },
  monitorAssignment: {
    project: { model: "project", local: "projectId", remote: "id", many: false },
    drawdownRequest: { model: "drawdownRequest", local: "drawdownRequestId", remote: "id", many: false },
    monitor: { model: "user", local: "monitorId", remote: "id", many: false },
  },
  notification: {
    project: { model: "project", local: "projectId", remote: "id", many: false },
    drawdownRequest: { model: "drawdownRequest", local: "relatedDrawdownId", remote: "id", many: false },
  },
  drawdownRequest: {
    project: { model: "project", local: "projectId", remote: "id", many: false },
    requestedBy: { model: "user", local: "requestedById", remote: "id", many: false },
    deficiencyNotices: { model: "deficiencyNotice", local: "id", remote: "drawdownRequestId", many: true },
    monitorCertificates: { model: "monitorCertificate", local: "id", remote: "drawdownRequestId", many: true },
    documents: { model: "documentVault", local: "id", remote: "drawdownRequestId", many: true },
  },
  projectMonitor: {
    project: { model: "project", local: "projectId", remote: "id", many: false },
    monitor: { model: "user", local: "monitorId", remote: "id", many: false },
  },
  auditLog: {
    project: { model: "project", local: "projectId", remote: "id", many: false },
    actor: { model: "user", local: "actorId", remote: "id", many: false },
  },
  bankAccount: {
    project: { model: "project", local: "projectId", remote: "id", many: false },
    cashTransactions: { model: "cashTransaction", local: "id", remote: "bankAccountId", many: true },
  },
  cashTransaction: {
    project: { model: "project", local: "projectId", remote: "id", many: false },
    bankAccount: { model: "bankAccount", local: "bankAccountId", remote: "id", many: false },
  },
  conditionPrecedent: {
    project: { model: "project", local: "projectId", remote: "id", many: false },
  },
  monitorCredential: {
    user: { model: "user", local: "userId", remote: "id", many: false },
  },
  deficiencyNotice: {
    drawdownRequest: { model: "drawdownRequest", local: "drawdownRequestId", remote: "id", many: false },
    issuedBy: { model: "user", local: "issuedById", remote: "id", many: false },
  },
  monitorCertificate: {
    drawdownRequest: { model: "drawdownRequest", local: "drawdownRequestId", remote: "id", many: false },
    monitor: { model: "user", local: "monitorId", remote: "id", many: false },
  },
  documentVault: {
    drawdownRequest: { model: "drawdownRequest", local: "drawdownRequestId", remote: "id", many: false },
  },
};

let idCounter = 0;
const genId = (model: string) => `${model}_${(++idCounter).toString(36)}_${Date.now().toString(36)}`;

function matches(rec: Rec, where: Rec): boolean {
  for (const [key, cond] of Object.entries(where)) {
    if (key === "projectId_monitorId") {
      const v = cond as { projectId: string; monitorId: string };
      if (rec.projectId !== v.projectId || rec.monitorId !== v.monitorId) return false;
      continue;
    }
    const actual = rec[key];
    if (cond && typeof cond === "object" && !Array.isArray(cond)) {
      if ("in" in cond) {
        if (!(cond as { in: unknown[] }).in.includes(actual)) return false;
        continue;
      }
      if ("not" in cond) {
        if ((cond as { not: unknown }).not === actual) return false;
        continue;
      }
      return false;
    }
    if (actual !== cond) return false;
  }
  return true;
}

function applyInclude(record: Rec, include: Rec, model: string): Rec {
  if (!record) return record;
  const rel = RELATIONS[model] ?? {};
  const out: Rec = { ...record };
  for (const [name, cfgRaw] of Object.entries(include)) {
    if (!cfgRaw) continue;
    const cfg = rel[name];
    if (!cfg) continue;
    const related = store[cfg.model].filter((r) => r[cfg.remote] === record[cfg.local]);
    if (cfg.many) {
      let resolved = related;
      const nestedWhere = (cfgRaw as Rec).where;
      if (nestedWhere) resolved = resolved.filter((r) => matches(r, nestedWhere as Rec));
      const nestedInclude = (cfgRaw as Rec).include;
      if (nestedInclude) resolved = resolved.map((r) => applyInclude(r, nestedInclude as Rec, cfg.model));
      out[name] = resolved;
    } else {
      const one = related[0] ?? null;
      const nestedInclude = (cfgRaw as Rec).include;
      out[name] = one ? (nestedInclude ? applyInclude(one, nestedInclude as Rec, cfg.model) : one) : null;
    }
  }
  return out;
}

function orderBy(records: Rec[], orderBy: Rec): Rec[] {
  const [field, dir] = Object.entries(orderBy)[0];
  const sorted = [...records].sort((a, b) => {
    const av = a[field] as never;
    const bv = b[field] as never;
    if (av < bv) return -1;
    if (av > bv) return 1;
    return 0;
  });
  return dir === "desc" ? sorted.reverse() : sorted;
}

// Applies a Prisma-style data payload, honoring atomic `increment`/`decrement`
// operators (used by the cash ledger) so numeric fields stay numbers.
function applyData(rec: Rec, data: Rec): Rec {
  for (const [key, value] of Object.entries(data)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      ("increment" in value || "decrement" in value)
    ) {
      const current = Number(rec[key]) || 0;
      const n = Number((value as Rec).increment ?? 0) - Number((value as Rec).decrement ?? 0);
      rec[key] = current + n;
    } else {
      rec[key] = value;
    }
  }
  return rec;
}

function makeModel(model: string) {
  return {
    findMany: async (args: Rec = {}) => {
      let res = store[model].filter((r) => !args.where || matches(r, args.where as Rec));
      if (args.orderBy) res = orderBy(res, args.orderBy as Rec);
      if (args.include) res = res.map((r) => applyInclude(r, args.include as Rec, model));
      return res;
    },
    findUnique: async (args: Rec) => {
      const r = store[model].find((x) => matches(x, args.where as Rec));
      return r ? (args.include ? applyInclude(r, args.include as Rec, model) : r) : null;
    },
    findFirst: async (args: Rec = {}) => {
      const r = store[model].find((x) => !args.where || matches(x, args.where as Rec));
      return r ? (args.include ? applyInclude(r, args.include as Rec, model) : r) : null;
    },
    count: async (args: Rec = {}) =>
      store[model].filter((r) => !args.where || matches(r, args.where as Rec)).length,
    aggregate: async (args: Rec) => {
      const recs = store[model].filter((r) => !args.where || matches(r, args.where as Rec));
      const out: Rec = {};
      if (args._sum) {
        const o: Rec = {};
        for (const f of Object.keys(args._sum as Rec)) {
          o[f] = recs.reduce((s, r) => s + (Number(r[f]) || 0), 0);
        }
        out._sum = o;
      }
      if (args._count) {
        const o: Rec = {};
        for (const f of Object.keys(args._count as Rec)) o[f] = recs.length;
        out._count = o;
      }
      if (args._avg) {
        const o: Rec = {};
        for (const f of Object.keys(args._avg as Rec)) {
          o[f] = recs.length ? recs.reduce((s, r) => s + (Number(r[f]) || 0), 0) / recs.length : 0;
        }
        out._avg = o;
      }
      return out;
    },
    create: async (args: Rec) => {
      const rec: Rec = { id: genId(model), ...(args.data as Rec) };
      applyData(rec, args.data as Rec);
      store[model].push(rec);
      return rec;
    },
    createMany: async (args: Rec) => {
      const data = Array.isArray(args.data) ? (args.data as Rec[]) : [args.data as Rec];
      data.forEach((d) => store[model].push({ id: genId(model), ...d }));
      return { count: data.length };
    },
    update: async (args: Rec) => {
      const r = store[model].find((x) => matches(x, args.where as Rec));
      if (!r) return null;
      applyData(r, args.data as Rec);
      return args.include ? applyInclude(r, args.include as Rec, model) : r;
    },
    updateMany: async (args: Rec) => {
      const recs = store[model].filter((x) => matches(x, args.where as Rec));
      recs.forEach((r) => applyData(r, args.data as Rec));
      return { count: recs.length };
    },
    upsert: async (args: Rec) => {
      const existing = store[model].find((x) => matches(x, args.where as Rec));
      if (existing) {
        applyData(existing, args.update as Rec);
        return existing;
      }
      const rec: Rec = { id: genId(model), ...(args.create as Rec) };
      applyData(rec, args.create as Rec);
      store[model].push(rec);
      return rec;
    },
    delete: async (args: Rec) => {
      const idx = store[model].findIndex((x) => matches(x, args.where as Rec));
      if (idx === -1) return null;
      const [removed] = store[model].splice(idx, 1);
      return removed;
    },
    deleteMany: async (args: Rec = {}) => {
      const before = store[model].length;
      store[model] = store[model].filter((x) => !(!args.where || matches(x, args.where as Rec)));
      return { count: before - store[model].length };
    },
  };
}

type ModelClient = {
  findMany: (args?: Rec) => Promise<Rec[]>;
  findUnique: (args: Rec) => Promise<Rec | null>;
  findFirst: (args?: Rec) => Promise<Rec | null>;
  count: (args?: Rec) => Promise<number>;
  aggregate: (args: Rec) => Promise<Rec>;
  create: (args: Rec) => Promise<Rec>;
  createMany: (args: Rec) => Promise<{ count: number }>;
  update: (args: Rec) => Promise<Rec | null>;
  updateMany: (args: Rec) => Promise<{ count: number }>;
  upsert: (args: Rec) => Promise<Rec>;
  delete: (args: Rec) => Promise<Rec | null>;
  deleteMany: (args?: Rec) => Promise<{ count: number }>;
};

const models: Record<string, ModelClient> = {};

export const prisma = new Proxy({} as Record<string, ModelClient>, {
  get(_t, model: string) {
    if (typeof model !== "string") return undefined;
    if (!models[model]) models[model] = makeModel(model) as unknown as ModelClient;
    return models[model];
  },
}) as unknown as Record<string, ModelClient>;

// Lifecycle no-ops so any stray $ calls in app code don't crash.
export const $disconnect = async () => {};
export const $connect = async () => {};
