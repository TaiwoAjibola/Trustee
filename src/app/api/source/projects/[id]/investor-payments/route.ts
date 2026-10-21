import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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
  const [project, payments] = await Promise.all([
    prisma.project.findUnique({ where: { id } }),
    prisma.investorPayment.findMany({
      where: { projectId: id },
      orderBy: { paidAt: "desc" },
    }),
  ]);

  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const investors = await prisma.investor.findMany({ where: { projectId: id } });
  const investorById = new Map(
    investors.map((investor: { id: string }) => [investor.id, investor])
  );

  const data = payments.map((payment: Record<string, unknown>) => {
    const investor = investorById.get(String(payment.investorId)) as
      | Record<string, string>
      | undefined;
    return {
      ...payment,
      investorName: investor?.name ?? "Investor",
      investorEmail: investor?.email ?? null,
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
