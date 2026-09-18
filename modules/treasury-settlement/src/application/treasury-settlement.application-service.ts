import { createHash } from "node:crypto";
import {
  ContractValidationError,
  currencyCode,
  decimalAmount,
  type DecimalAmount,
  type CompanyId,
} from "@elhafez/contracts";
import type { BillingSubledgersApplicationService } from "@elhafez/billing-subledgers";
import type {
  GeneralLedgerApplicationService,
  PostingLine,
} from "@elhafez/general-ledger";
import type { FinancialControlsApplicationService } from "@elhafez/financial-controls";
import type { TreasuryRepository } from "./treasury.repository.js";
import type {
  BankLine,
  BankMatch,
  CashCount,
  Cheque,
  Treasury,
  TreasuryPolicy,
  TreasuryType,
  Voucher,
} from "../domain/treasury.js";
const S = 10n ** 18n;
function n(v: DecimalAmount | string) {
  const x = decimalAmount(v),
    neg = x.startsWith("-"),
    u = neg ? x.slice(1) : x,
    [w, f = ""] = u.split(".");
  if (f.length > 18)
    throw new ContractValidationError(
      "amount",
      "supports at most 18 fractional digits",
    );
  const z = BigInt(w + f.padEnd(18, "0"));
  return neg ? -z : z;
}
function d(v: bigint): DecimalAmount {
  const neg = v < 0n,
    a = neg ? -v : v,
    w = a / S,
    f = a % S,
    t = f
      ? w + "." + f.toString().padStart(18, "0").replace(/0+$/, "")
      : w.toString();
  return decimalAmount((neg ? "-" : "") + t);
}
function pos(v: DecimalAmount) {
  const x = decimalAmount(v);
  if (n(x) <= 0n)
    throw new ContractValidationError("amount", "must be positive");
  return x;
}
function hash(v: unknown) {
  return createHash("sha256").update(JSON.stringify(v)).digest("hex");
}
export interface PostVoucherInput {
  id: string;
  companyId: CompanyId;
  branchId?: string;
  treasuryId: string;
  kind: "RECEIPT" | "PAYMENT";
  partyKind: "CUSTOMER" | "SUPPLIER";
  partyId: string;
  number: string;
  postingDate: string;
  amount: DecimalAmount;
  sourceType: string;
  sourceId: string;
  controlAccountId: string;
  advanceAccountId?: string;
  realizedFxGainAccountId?: string;
  realizedFxLossAccountId?: string;
  actorId?: string;
  approvalRequestId?: string;
  explicitDraftInvoiceId?: string;
  restrictionSourceType?: string;
  restrictionSourceId?: string;
}
export class TreasurySettlementApplicationService {
  constructor(
    private readonly repo: TreasuryRepository,
    private readonly billing: Pick<
      BillingSubledgersApplicationService,
      "settle" | "reverseSettlement"
    >,
    private readonly gl: Pick<
      GeneralLedgerApplicationService,
      "post" | "reverse"
    >,
    private readonly controls: Pick<
      FinancialControlsApplicationService,
      "evaluateApprovalRequirement" | "getApprovalRequest" | "getApprovalDecision"
    >,
  ) {}
  async createTreasury(input: {
    id: string;
    companyId: CompanyId;
    code: string;
    name: string;
    type: TreasuryType;
    currency: string;
    glAccountId: string;
  }) {
    if (!input.code.trim() || !input.name.trim())
      throw new ContractValidationError("treasury", "code and name required");
    if (
      (await this.repo.treasuries(input.companyId)).some(
        (x) => x.code === input.code,
      )
    )
      throw new ContractValidationError("code", "already used");
    const value: Treasury = {
      ...input,
      currency: currencyCode(input.currency),
      active: true,
    };
    await this.repo.saveTreasury(value);
    return value;
  }
  async configurePolicy(companyId: CompanyId, allowNegative: boolean) {
    const value: TreasuryPolicy = { companyId, allowNegative };
    await this.repo.savePolicy(value);
    return value;
  }
  async updateTreasury(
    companyId: CompanyId,
    id: string,
    change: {
      name?: string;
      type?: TreasuryType;
      currency?: string;
      active?: boolean;
    },
  ) {
    const old = await this.required(companyId, id),
      history =
        (await this.repo.vouchers(companyId, id)).some(
          (x) => x.status === "POSTED" || x.status === "REVERSED",
        ) ||
        (await this.repo.transfers(companyId)).some(
          (x) =>
            x.status === "POSTED" &&
            (x.sourceTreasuryId === id || x.destinationTreasuryId === id),
        ) ||
        (await this.repo.cashCounts(companyId, id)).some(
          (x) => Boolean(x.adjustmentJournalId),
        );
    if (
      history &&
      ((change.type && change.type !== old.type) ||
        (change.currency && currencyCode(change.currency) !== old.currency))
    )
      throw new ContractValidationError(
        "treasury",
        "BR-025 currency/type immutable after permanent history",
      );
    if (change.active === false && n(await this.balance(companyId, id)) !== 0n)
      throw new ContractValidationError(
        "treasury",
        "BR-026 nonzero treasury cannot be deactivated",
      );
    const value = {
      ...old,
      ...change,
      ...(change.currency ? { currency: currencyCode(change.currency) } : {}),
    };
    await this.repo.saveTreasury(value);
    return value;
  }
  async balance(companyId: CompanyId, treasuryId: string) {
    await this.required(companyId, treasuryId);
    let total = 0n;
    for (const v of await this.repo.vouchers(companyId, treasuryId))
      if (v.status === "POSTED")
        total += v.kind === "RECEIPT" ? n(v.amount) : -n(v.amount);
    for (const t of await this.repo.transfers(companyId))
      if (t.status === "POSTED") {
        if (t.sourceTreasuryId === treasuryId) total -= n(t.amount);
        if (t.destinationTreasuryId === treasuryId) total += n(t.amount);
      }
    for (const count of await this.repo.cashCounts(companyId, treasuryId))
      if (count.adjustmentJournalId) total += n(count.difference);
    return d(total);
  }
  async postVoucher(input: PostVoucherInput): Promise<Voucher> {
    const amount = pos(input.amount),
      treasury = await this.required(input.companyId, input.treasuryId);
    if (!treasury.active)
      throw new ContractValidationError("treasury", "inactive");
    const requestHash = hash({ ...input, amount });
    let voucher = await this.repo.voucherBySource(
      input.companyId,
      input.sourceType,
      input.sourceId,
    );
    if (voucher) {
      if (voucher.requestHash !== requestHash)
        throw new ContractValidationError("source", "conflicting replay");
      if (voucher.status === "POSTED") return voucher;
      if (voucher.status !== "PROCESSING")
        throw new ContractValidationError("voucher", "reversed/reversing voucher identity cannot be reposted");
    } else {
      voucher = {
        ...input,
        currency: treasury.currency,
        amount,
        requestHash,
        status: "PROCESSING",
        allocationIds: [],
      };
      await this.repo.saveVoucher(voucher);
    }
    if (input.kind === "PAYMENT") {
      const requirement = await this.controls.evaluateApprovalRequirement({
        companyId: input.companyId,
        action: "PAYMENT",
        amount,
      });
      if (requirement.decision === "APPROVAL_REQUIRED") {
        if (!input.approvalRequestId || !input.actorId)
          throw new ContractValidationError(
            "approval",
            "approved request and requesting actor are required",
          );
        const request = await this.controls.getApprovalRequest(
          input.companyId,
          input.approvalRequestId,
        );
        const decision = await this.controls.getApprovalDecision(
          input.companyId,
          input.approvalRequestId,
        );
        if (
          !request ||
          request.action !== "PAYMENT" ||
          request.amount !== amount ||
          request.sourceType !== input.sourceType ||
          request.sourceId !== input.sourceId ||
          request.requesterActorId !== input.actorId ||
          (input.branchId !== undefined && request.branchId !== input.branchId) ||
          decision?.outcome !== "APPROVED"
        )
          throw new ContractValidationError(
            "approval",
            "approval evidence does not authorize this exact payment",
          );
      }
      await this.ensureFunds(input.companyId, input.treasuryId, amount);
    }
    const settlement = await this.billing.settle({
      id: input.id,
      companyId: input.companyId,
      partyKind: input.partyKind,
      partyId: input.partyId,
      amount,
      settlementCurrency: treasury.currency,
      settlementDate: input.postingDate,
      ...(input.explicitDraftInvoiceId
        ? { explicitDraftInvoiceId: input.explicitDraftInvoiceId }
        : {}),
      ...(input.restrictionSourceType
        ? { restrictionSourceType: input.restrictionSourceType }
        : {}),
      ...(input.restrictionSourceId
        ? { restrictionSourceId: input.restrictionSourceId }
        : {}),
    });
    const baseAmount = settlement.settlementBaseAmount;
    const fx = n(settlement.realizedFx);
    const controlAmount = settlement.carryingBaseAmount;
    const advance = n(baseAmount) - n(controlAmount) - fx;
    const lines: PostingLine[] =
        input.kind === "RECEIPT"
          ? [
              { accountId: treasury.glAccountId, debit: baseAmount },
              {
                accountId: input.controlAccountId,
                credit: controlAmount,
                partyId: input.partyId,
              },
            ]
          : [
              {
                accountId: input.controlAccountId,
                debit: controlAmount,
                partyId: input.partyId,
              },
              { accountId: treasury.glAccountId, credit: baseAmount },
            ];
    if (fx !== 0n) {
      const fxAmount = d(fx < 0n ? -fx : fx);
      if (input.kind === "RECEIPT") {
        if (fx > 0n) {
          if (!input.realizedFxGainAccountId) throw new ContractValidationError("realizedFxGainAccountId", "required");
          lines.push({ accountId: input.realizedFxGainAccountId, credit: fxAmount });
        } else {
          if (!input.realizedFxLossAccountId) throw new ContractValidationError("realizedFxLossAccountId", "required");
          lines.push({ accountId: input.realizedFxLossAccountId, debit: fxAmount });
        }
      } else if (fx > 0n) {
        if (!input.realizedFxLossAccountId) throw new ContractValidationError("realizedFxLossAccountId", "required");
        lines.push({ accountId: input.realizedFxLossAccountId, debit: fxAmount });
      } else {
        if (!input.realizedFxGainAccountId) throw new ContractValidationError("realizedFxGainAccountId", "required");
        lines.push({ accountId: input.realizedFxGainAccountId, credit: fxAmount });
      }
    }
    if (advance > 0n) {
      if (!input.advanceAccountId) throw new ContractValidationError("advanceAccountId", "required for excess settlement");
      lines.push(input.kind === "RECEIPT"
        ? { accountId: input.advanceAccountId, credit: d(advance), partyId: input.partyId }
        : { accountId: input.advanceAccountId, debit: d(advance), partyId: input.partyId });
    }
    const journal = await this.gl.post({
      id: "treasury:" + input.id,
      companyId: input.companyId,
      number: input.number,
      postingDate: input.postingDate,
      sourceType: "TREASURY_VOUCHER",
      sourceId: input.id,
      lines,
    });
    voucher = {
      ...voucher,
      status: "POSTED",
      journalId: journal.id,
      settlementId: settlement.settlementId,
      allocationIds: settlement.allocations.map((x) => x.id),
      ...(settlement.advanceId ? { advanceId: settlement.advanceId } : {}),
      carryingBaseAmount: settlement.carryingBaseAmount,
      settlementBaseAmount: settlement.settlementBaseAmount,
      realizedFx: settlement.realizedFx,
      ...(settlement.fxRateId ? { fxRateId: settlement.fxRateId } : {}),
    };
    await this.repo.saveVoucher(voucher);
    return voucher;
  }
  async voidVoucher(
    companyId: CompanyId,
    id: string,
    postingDate: string,
    number: string,
  ) {
    let v = await this.repo.voucher(companyId, id);
    if (!v) throw new ContractValidationError("voucher", "not found");
    if (v.status === "REVERSED") return v;
    if (v.status !== "POSTED" || !v.journalId || !v.settlementId)
      throw new ContractValidationError(
        "voucher",
        "only posted voucher may reverse",
      );
    const journalId = v.journalId;
    const settlementId = v.settlementId;
    v = { ...v, status: "REVERSING" };
    await this.repo.saveVoucher(v);
    await this.billing.reverseSettlement(companyId, settlementId);
    const reversal = await this.gl.reverse(
      companyId,
      journalId,
      postingDate,
      number,
    );
    v = { ...v, status: "REVERSED", reversalJournalId: reversal.id };
    await this.repo.saveVoucher(v);
    return v;
  }
  async transfer(input: {
    id: string;
    companyId: CompanyId;
    sourceTreasuryId: string;
    destinationTreasuryId: string;
    amount: DecimalAmount;
    postingDate: string;
    sourceType: string;
    sourceId: string;
    number: string;
  }) {
    if (input.sourceTreasuryId === input.destinationTreasuryId)
      throw new ContractValidationError("transfer", "treasuries must differ");
    const amount = pos(input.amount),
      source = await this.required(input.companyId, input.sourceTreasuryId),
      dest = await this.required(input.companyId, input.destinationTreasuryId);
    if (!source.active || !dest.active)
      throw new ContractValidationError("treasury", "transfer requires active treasuries");
    if (source.currency !== dest.currency)
      throw new ContractValidationError(
        "transfer",
        "cross-currency transfer policy is outside AC-07",
      );
    const requestHash = hash({ ...input, amount });
    let value = await this.repo.transferBySource(
      input.companyId,
      input.sourceType,
      input.sourceId,
    );
    if (value) {
      if (value.requestHash !== requestHash)
        throw new ContractValidationError("source", "conflicting replay");
      if (value.status === "POSTED") return value;
    } else {
      value = { ...input, amount, requestHash, status: "PROCESSING" };
      await this.repo.saveTransfer(value);
    }
    await this.ensureFunds(input.companyId, source.id, amount);
    const journal = await this.gl.post({
      id: "treasury-transfer:" + input.id,
      companyId: input.companyId,
      number: input.number,
      postingDate: input.postingDate,
      sourceType: "TREASURY_TRANSFER",
      sourceId: input.id,
      lines: [
        { accountId: dest.glAccountId, debit: amount },
        { accountId: source.glAccountId, credit: amount },
      ],
    });
    value = { ...value, status: "POSTED", journalId: journal.id };
    await this.repo.saveTransfer(value);
    return value;
  }
  async issueCheque(input: Omit<Cheque, "status" | "history">) {
    pos(input.amount);
    const voucher = await this.repo.voucher(input.companyId, input.voucherId);
    if (!voucher || voucher.status !== "POSTED")
      throw new ContractValidationError("voucher", "posted voucher required");
    if (input.currency !== voucher.currency)
      throw new ContractValidationError("currency", "cheque currency must match voucher currency");
    if (input.bankTreasuryId) {
      const bank = await this.required(input.companyId, input.bankTreasuryId);
      if (!bank.active || bank.type !== "BANK" || bank.currency !== input.currency)
        throw new ContractValidationError("bankTreasuryId", "active matching-currency BANK treasury required");
    }
    const existing = await this.repo.cheque(input.companyId, input.id);
    if (existing) {
      const same =
        existing.voucherId === input.voucherId &&
        existing.direction === input.direction &&
        existing.bankTreasuryId === input.bankTreasuryId &&
        existing.number === input.number &&
        existing.amount === input.amount &&
        existing.currency === input.currency &&
        existing.issueDate === input.issueDate &&
        existing.dueDate === input.dueDate;
      if (!same) throw new ContractValidationError("cheque", "conflicting cheque replay");
      return existing;
    }
    const value: Cheque = {
      ...input,
      status: "ISSUED",
      history: [{ status: "ISSUED", at: new Date().toISOString() }],
    };
    try {
      await this.repo.createCheque(value);
      return value;
    } catch (error) {
      const concurrent = await this.repo.cheque(input.companyId, input.id);
      if (concurrent) return concurrent;
      throw error;
    }
  }
  async transitionCheque(
    companyId: CompanyId,
    id: string,
    status: Cheque["status"],
    reference?: string,
  ) {
    const old = await this.repo.cheque(companyId, id);
    if (!old) throw new ContractValidationError("cheque", "not found");
    const allowed: Record<string, string[]> = {
      ISSUED: ["DEPOSITED", "CLEARED", "VOIDED"],
      DEPOSITED: ["CLEARED", "BOUNCED"],
      BOUNCED: ["DEPOSITED", "VOIDED"],
      CLEARED: [],
      VOIDED: [],
    };
    if (!allowed[old.status]!.includes(status))
      throw new ContractValidationError("status", "invalid cheque transition");
    const value = {
      ...old,
      status,
      ...(status === "CLEARED" && reference
        ? { clearingReference: reference }
        : {}),
      history: [
        ...old.history,
        {
          status,
          at: new Date().toISOString(),
          ...(reference ? { reference } : {}),
        },
      ],
    };
    await this.repo.saveCheque(value);
    return value;
  }
  async recordCashCount(input: {
    id: string;
    companyId: CompanyId;
    treasuryId: string;
    countedAmount: DecimalAmount;
    countDate: string;
    adjustmentAccountId?: string;
    number?: string;
  }) {
    const t = await this.required(input.companyId, input.treasuryId);
    if (t.type !== "CASH")
      throw new ContractValidationError(
        "treasury",
        "cash count requires CASH treasury",
      );
    const counted = decimalAmount(input.countedAmount);
    if (n(counted) < 0n) throw new ContractValidationError("countedAmount", "cash count cannot be negative");
    const existing = await this.repo.cashCount(input.companyId, input.id);
    if (existing) {
      if (
        existing.treasuryId !== input.treasuryId ||
        existing.countedAmount !== counted ||
        existing.countDate !== input.countDate ||
        existing.adjustmentAccountId !== input.adjustmentAccountId
      ) throw new ContractValidationError("cashCount", "conflicting cash-count replay");
      return existing;
    }
    const book = await this.balance(input.companyId, input.treasuryId),
      difference = d(n(counted) - n(book));
    let journalId: string | undefined;
    if (n(difference) !== 0n) {
      if (!input.adjustmentAccountId || !input.number)
        throw new ContractValidationError(
          "difference",
          "explicit adjustment account and number required",
        );
      const lines: PostingLine[] =
        n(difference) > 0n
          ? [
              { accountId: t.glAccountId, debit: difference },
              { accountId: input.adjustmentAccountId, credit: difference },
            ]
          : [
              {
                accountId: input.adjustmentAccountId,
                debit: d(-n(difference)),
              },
              { accountId: t.glAccountId, credit: d(-n(difference)) },
            ];
      const j = await this.gl.post({
        id: "cash-count:" + input.id,
        companyId: input.companyId,
        number: input.number,
        postingDate: input.countDate,
        sourceType: "TREASURY_CASH_COUNT",
        sourceId: input.id,
        lines,
      });
      journalId = j.id;
    }
    const value: CashCount = {
      ...input,
      countedAmount: counted,
      bookAmount: book,
      difference,
      ...(journalId ? { adjustmentJournalId: journalId } : {}),
    };
    await this.repo.saveCashCount(value);
    return value;
  }
  async importBankLine(input: Omit<BankLine, "status">) {
    const existing = await this.repo.bankLine(input.companyId, input.id);
    if (existing) {
      const normalizedCurrency = currencyCode(input.currency);
      const normalizedAmount = decimalAmount(input.signedAmount);
      if (
        existing.treasuryId !== input.treasuryId ||
        existing.currency !== normalizedCurrency ||
        existing.signedAmount !== normalizedAmount ||
        existing.valueDate !== input.valueDate ||
        existing.reference !== input.reference
      ) throw new ContractValidationError("bankLine", "conflicting statement-line replay");
      return existing;
    }
    const t = await this.required(input.companyId, input.treasuryId);
    if (t.type !== "BANK" || t.currency !== currencyCode(input.currency))
      throw new ContractValidationError(
        "treasury",
        "matching bank treasury/currency required",
      );
    const value: BankLine = {
      ...input,
      currency: currencyCode(input.currency),
      signedAmount: decimalAmount(input.signedAmount),
      status: "UNMATCHED",
    };
    await this.repo.saveBankLine(value);
    return value;
  }
  async autoMatch(companyId: CompanyId, lineId: string) {
    const line = await this.repo.bankLine(companyId, lineId);
    if (!line) throw new ContractValidationError("line", "not found");
    const candidates = (
      await this.repo.vouchers(companyId, line.treasuryId)
    ).filter(
      (v) =>
        v.status === "POSTED" &&
        v.currency === line.currency &&
        (v.kind === "RECEIPT" ? n(v.amount) : -n(v.amount)) ===
          n(line.signedAmount) &&
        v.postingDate === line.valueDate &&
        (!line.reference || v.number === line.reference),
    );
    if (candidates.length !== 1) {
      const next = {
        ...line,
        status: candidates.length
          ? ("AMBIGUOUS" as const)
          : ("UNMATCHED" as const),
      };
      await this.repo.saveBankLine(next);
      return next;
    }
    return this.match(line, candidates[0]!.id, "AUTO");
  }
  async manualMatch(
    companyId: CompanyId,
    lineId: string,
    voucherId: string,
    actorId: string,
  ) {
    if (!actorId.trim()) throw new ContractValidationError("actorId", "manual match actor is required");
    const line = await this.repo.bankLine(companyId, lineId),
      v = await this.repo.voucher(companyId, voucherId);
    if (
      !line ||
      !v ||
      v.status !== "POSTED" ||
      v.treasuryId !== line.treasuryId
    )
      throw new ContractValidationError("match", "compatible records required");
    return this.match(line, voucherId, "MANUAL", actorId);
  }
  private async match(
    line: BankLine,
    voucherId: string,
    mode: "AUTO" | "MANUAL",
    actorId?: string,
  ) {
    const prior = await this.repo.bankMatch(line.companyId, line.id);
    if (prior) {
      if (prior.voucherId !== voucherId || prior.mode !== mode)
        throw new ContractValidationError("bankMatch", "statement line already matched differently");
      return prior;
    }
    const value: BankMatch = {
      id: "match:" + line.id,
      companyId: line.companyId,
      lineId: line.id,
      voucherId,
      mode,
      ...(actorId ? { actorId } : {}),
      matchedAt: new Date().toISOString(),
    };
    try {
      await this.repo.saveBankMatchEffect(value, line, { ...line, status: "MATCHED" });
      return value;
    } catch (error) {
      const concurrent = await this.repo.bankMatch(line.companyId, line.id);
      if (concurrent && concurrent.voucherId === voucherId && concurrent.mode === mode) return concurrent;
      throw error;
    }
  }
  private async ensureFunds(
    companyId: CompanyId,
    id: string,
    amount: DecimalAmount,
  ) {
    if ((await this.repo.policy(companyId))?.allowNegative === true) return;
    if (n(await this.balance(companyId, id)) - n(amount) < 0n)
      throw new ContractValidationError(
        "balance",
        "BR-027 negative treasury is prohibited",
      );
  }
  private async required(companyId: CompanyId, id: string) {
    const value = await this.repo.treasury(companyId, id);
    if (!value) throw new ContractValidationError("treasury", "not found");
    return value;
  }
}
