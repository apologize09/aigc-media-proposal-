import { Prisma } from "@prisma/client";

import { writeAudit } from "@/server/audit/service";
import { AuthValidationError } from "@/server/auth/http";
import type { AuthUser } from "@/server/auth/types";
import { prisma } from "@/server/db";
import {
  assertCanMutateProject,
  assertFinanceOnProject,
} from "@/server/projects/access";

export type CostLineInput = {
  label: string;
  quantity: string | number;
  unit?: string | null;
  unitAmount?: string | number | null;
  lineAmount?: string | number | null;
  note?: string | null;
};

export type QuoteLineInput = {
  label: string;
  quantity: string | number;
  unit?: string | null;
  unitAmount?: string | number | null;
  lineAmount?: string | number | null;
  visibleInProposal?: boolean;
  costLineId?: string | null;
};

function toDecimal(value: string | number | null | undefined): Prisma.Decimal | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  try {
    return new Prisma.Decimal(value);
  } catch {
    throw new AuthValidationError("金额格式无效");
  }
}

function resolveLineAmount(input: {
  quantity: Prisma.Decimal;
  unitAmount: Prisma.Decimal | null;
  lineAmount: Prisma.Decimal | null;
}): Prisma.Decimal {
  if (input.unitAmount !== null) {
    return input.quantity.mul(input.unitAmount);
  }
  if (input.lineAmount !== null) {
    return input.lineAmount;
  }
  throw new AuthValidationError("请填写单价或行金额");
}

function decimalToString(value: Prisma.Decimal | { toString(): string }): string {
  return value.toString();
}

export async function getCostSheet(actor: AuthUser, projectId: string) {
  await assertFinanceOnProject(actor, projectId);
  const sheet = await prisma.costSheet.findUnique({
    where: { projectId },
    include: { lines: { orderBy: { position: "asc" } } },
  });
  if (!sheet) {
    return { projectId, currency: null, lines: [] as const, updatedAt: null };
  }
  return {
    projectId: sheet.projectId,
    currency: sheet.currency,
    updatedAt: sheet.updatedAt.toISOString(),
    lines: sheet.lines.map((line) => ({
      id: line.id,
      label: line.label,
      quantity: decimalToString(line.quantity),
      unit: line.unit,
      unitAmount: line.unitAmount ? decimalToString(line.unitAmount) : null,
      lineAmount: decimalToString(line.lineAmount),
      note: line.note,
      position: line.position,
    })),
  };
}

export async function saveCostSheet(input: {
  actor: AuthUser;
  projectId: string;
  currency?: string | null;
  lines: CostLineInput[];
}) {
  await assertFinanceOnProject(input.actor, input.projectId);
  await assertCanMutateProject(input.actor, input.projectId);

  const prepared = input.lines.map((line, index) => {
    if (!line.label?.trim()) {
      throw new AuthValidationError("成本项名称不能为空");
    }
    const quantity = toDecimal(line.quantity) ?? new Prisma.Decimal(0);
    const unitAmount = toDecimal(line.unitAmount);
    const lineAmount = resolveLineAmount({
      quantity,
      unitAmount,
      lineAmount: toDecimal(line.lineAmount),
    });
    return {
      label: line.label.trim(),
      quantity,
      unit: line.unit?.trim() || null,
      unitAmount,
      lineAmount,
      note: line.note?.trim() || null,
      position: index,
    };
  });

  const sheet = await prisma.$transaction(async (tx) => {
    const existing = await tx.costSheet.upsert({
      where: { projectId: input.projectId },
      create: {
        projectId: input.projectId,
        currency: input.currency?.trim() || null,
        updatedById: input.actor.id,
      },
      update: {
        currency: input.currency?.trim() || null,
        updatedById: input.actor.id,
      },
    });
    await tx.costLine.deleteMany({ where: { costSheetId: existing.id } });
    if (prepared.length > 0) {
      await tx.costLine.createMany({
        data: prepared.map((line) => ({
          costSheetId: existing.id,
          ...line,
        })),
      });
    }
    return tx.costSheet.findUniqueOrThrow({
      where: { id: existing.id },
      include: { lines: { orderBy: { position: "asc" } } },
    });
  });

  await writeAudit({
    actorUserId: input.actor.id,
    action: "cost_sheet.saved",
    entityType: "cost_sheet",
    entityId: sheet.id,
    projectId: input.projectId,
    metadata: { lineCount: prepared.length },
  });

  return getCostSheet(input.actor, input.projectId);
}

export async function getQuoteLines(actor: AuthUser, projectId: string) {
  await assertFinanceOnProject(actor, projectId);
  const lines = await prisma.quoteLine.findMany({
    where: { projectId },
    orderBy: { position: "asc" },
  });
  return lines.map((line) => ({
    id: line.id,
    label: line.label,
    quantity: decimalToString(line.quantity),
    unit: line.unit,
    unitAmount: line.unitAmount ? decimalToString(line.unitAmount) : null,
    lineAmount: decimalToString(line.lineAmount),
    visibleInProposal: line.visibleInProposal,
    costLineId: line.costLineId,
    position: line.position,
    updatedAt: line.updatedAt.toISOString(),
  }));
}

/** 对客可见报价投影，供发布与预览；不含成本备注。 */
export async function getVisibleQuoteProjection(projectId: string) {
  const lines = await prisma.quoteLine.findMany({
    where: { projectId, visibleInProposal: true },
    orderBy: { position: "asc" },
  });
  if (lines.length === 0) {
    return { empty: true as const, message: "尚未填写对客报价", lines: [] };
  }
  return {
    empty: false as const,
    message: null,
    lines: lines.map((line) => ({
      id: line.id,
      label: line.label,
      quantity: decimalToString(line.quantity),
      unit: line.unit,
      unitAmount: line.unitAmount ? decimalToString(line.unitAmount) : null,
      lineAmount: decimalToString(line.lineAmount),
    })),
  };
}

export async function saveQuoteLines(input: {
  actor: AuthUser;
  projectId: string;
  lines: QuoteLineInput[];
}) {
  await assertFinanceOnProject(input.actor, input.projectId);
  await assertCanMutateProject(input.actor, input.projectId);

  const prepared = input.lines.map((line, index) => {
    if (!line.label?.trim()) {
      throw new AuthValidationError("报价项名称不能为空");
    }
    const quantity = toDecimal(line.quantity) ?? new Prisma.Decimal(0);
    const unitAmount = toDecimal(line.unitAmount);
    const lineAmount = resolveLineAmount({
      quantity,
      unitAmount,
      lineAmount: toDecimal(line.lineAmount),
    });
    return {
      projectId: input.projectId,
      label: line.label.trim(),
      quantity,
      unit: line.unit?.trim() || null,
      unitAmount,
      lineAmount,
      visibleInProposal: Boolean(line.visibleInProposal),
      costLineId: line.costLineId || null,
      position: index,
    };
  });

  await prisma.$transaction(async (tx) => {
    await tx.quoteLine.deleteMany({ where: { projectId: input.projectId } });
    if (prepared.length > 0) {
      await tx.quoteLine.createMany({ data: prepared });
    }
  });

  await writeAudit({
    actorUserId: input.actor.id,
    action: "quote_lines.saved",
    entityType: "project",
    entityId: input.projectId,
    projectId: input.projectId,
    metadata: { lineCount: prepared.length },
  });

  return getQuoteLines(input.actor, input.projectId);
}

export async function getProfit(actor: AuthUser, projectId: string) {
  await assertFinanceOnProject(actor, projectId);
  return {
    status: "未配置" as const,
    message: "利润公式尚未配置，不返回利润率",
  };
}
