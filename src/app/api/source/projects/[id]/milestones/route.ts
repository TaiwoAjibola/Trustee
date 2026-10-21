import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GATE_LABELS } from "@/lib/slaEngine";
import { SOURCE_STATUS_LABELS, type SourceStatus } from "@/lib/sourceApi";

export const dynamic = "force-dynamic";

const GATE_ORDER = Object.keys(GATE_LABELS);

function authorised(request: NextRequest) {
  const expected = process.env.SOURCE_API_KEY;
  return !expected || request.headers.get("x-source-api-key") === expected;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Invalid source API key." }, { status: 401 });
  }

  const { id } = await context.params;
  const [project, milestones] = await Promise.all([
    prisma.project.findUnique({ where: { id } }),
    prisma.sourceMilestone.findMany({ where: { projectId: id } }),
  ]);

  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const data = [...milestones]
    .sort((a: { gateType: string }, b: { gateType: string }) => {
      return GATE_ORDER.indexOf(a.gateType) - GATE_ORDER.indexOf(b.gateType);
    })
    .map((milestone: Record<string, unknown>) => {
      const sourceStatus = String(milestone.sourceStatus) as SourceStatus;
      return {
        id: milestone.id,
        externalId: milestone.externalId,
        gateType: milestone.gateType,
        name: milestone.name,
        description: milestone.description,
        amount: milestone.amount,
        currency: milestone.currency,
        sourceStatus,
        sourceStatusLabel: SOURCE_STATUS_LABELS[sourceStatus] ?? "Unknown",
        progressPct: milestone.progressPct,
        dueAt: milestone.dueAt,
        completedAt: milestone.completedAt,
        sourceUpdatedAt: milestone.sourceUpdatedAt,
      };
    });

  return NextResponse.json(
    {
      source: process.env.SOURCE_SYSTEM_NAME ?? "syndesis-origin",
      fetchedAt: new Date().toISOString(),
      projectId: id,
      data,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
