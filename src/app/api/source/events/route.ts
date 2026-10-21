import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type EventBody = {
  eventId?: string;
  eventType?: string;
  payload?: Record<string, unknown>;
};

function authorised(request: NextRequest) {
  const expected = process.env.SOURCE_API_KEY;
  return !expected || request.headers.get("x-source-api-key") === expected;
}

export async function POST(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Invalid source API key." }, { status: 401 });
  }

  let body: EventBody;
  try {
    body = (await request.json()) as EventBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const eventId = body.eventId?.trim();
  const eventType = body.eventType?.trim();
  const payload = body.payload ?? {};
  if (!eventId || !eventType) {
    return NextResponse.json(
      { error: "eventId and eventType are required." },
      { status: 400 }
    );
  }

  const existing = await prisma.integrationEvent.findUnique({ where: { eventId } });
  if (existing?.status === "PROCESSED") {
    return NextResponse.json({ duplicate: true, eventId, status: existing.status });
  }

  try {
    if (eventType === "investor.payment.confirmed") {
      const paymentId = typeof payload.paymentId === "string" ? payload.paymentId : null;
      const reference = typeof payload.reference === "string" ? payload.reference : null;
      if (!paymentId && !reference) {
        throw new Error("paymentId or reference is required.");
      }
      const payment = await prisma.investorPayment.findFirst({
        where: paymentId ? { id: paymentId } : { reference },
      });
      if (!payment) throw new Error("Investor payment not found.");
      if (payment.status !== "ACKNOWLEDGED") {
        const acknowledgedAt = new Date();
        const receiptRef = `FT-${String(payment.reference).replace(/[^A-Za-z0-9]/g, "")}`;
        await prisma.investorPayment.update({
          where: { id: payment.id },
          data: {
            status: "ACKNOWLEDGED",
            acknowledgedAt,
            acknowledgedById: "source_event",
            receiptRef,
            notificationStatus: "SENT",
            notificationSentAt: acknowledgedAt,
          },
        });
        const investor = await prisma.investor.findUnique({ where: { id: payment.investorId } });
        if (investor) {
          await prisma.investor.update({
            where: { id: investor.id },
            data: { paymentStatus: "ACKNOWLEDGED", acknowledgedAt },
          });
        }
        await prisma.notification.create({
          data: {
            projectId: payment.projectId,
            recipientType: "INVESTOR",
            recipientRef: payment.investorId,
            title: "Investor Payment Confirmed",
            body: `The source application confirmed your payment of ₦${payment.amount.toLocaleString()} (reference ${payment.reference}). Receipt ${receiptRef} has been issued.`,
            relatedDrawdownId: null,
            createdAt: acknowledgedAt,
          },
        });
        await prisma.auditLog.create({
          data: {
            projectId: payment.projectId,
            actorId: "source_event",
            actorName: "Source application",
            action: "INVESTOR_PAYMENT_ACKNOWLEDGED",
            details: `Payment ${payment.reference} confirmed by the source application. Receipt ${receiptRef} issued automatically; no manual entry was required.`,
            timestamp: acknowledgedAt,
          },
        });
      }
    } else if (eventType === "developer.message.created") {
      const sourceEventId = eventId;
      const alreadyMirrored = await prisma.developerMessage.findUnique({ where: { sourceEventId } });
      if (!alreadyMirrored) {
        const projectId = String(payload.projectId ?? "");
        const bodyText = String(payload.body ?? "").trim();
        if (!projectId || !bodyText) throw new Error("projectId and body are required.");
        await prisma.developerMessage.create({
          data: {
            projectId,
            senderId: String(payload.senderId ?? "developer"),
            senderName: String(payload.senderName ?? "Project developer"),
            senderRole: "DEVELOPER",
            body: bodyText,
            drawdownRequestId: payload.drawdownRequestId ? String(payload.drawdownRequestId) : null,
            sourceEventId,
            createdAt: new Date(),
          },
        });
      }
    } else if (eventType === "milestone.updated") {
      const sourceMilestoneId = typeof payload.sourceMilestoneId === "string" ? payload.sourceMilestoneId : null;
      const externalId = typeof payload.externalId === "string" ? payload.externalId : null;
      if (!sourceMilestoneId && !externalId) {
        throw new Error("sourceMilestoneId or externalId is required.");
      }
      const milestone = await prisma.sourceMilestone.findFirst({
        where: sourceMilestoneId ? { id: sourceMilestoneId } : { externalId },
      });
      if (!milestone) throw new Error("Source milestone not found.");
      await prisma.sourceMilestone.update({
        where: { id: milestone.id },
        data: {
          amount: typeof payload.amount === "number" ? payload.amount : milestone.amount,
          sourceStatus:
            typeof payload.sourceStatus === "string" ? payload.sourceStatus : milestone.sourceStatus,
          progressPct:
            typeof payload.progressPct === "number" ? payload.progressPct : milestone.progressPct,
          sourceUpdatedAt: new Date(),
        },
      });
    } else {
      throw new Error(`Unsupported event type: ${eventType}`);
    }

    await prisma.integrationEvent.upsert({
      where: { eventId },
      update: {
        eventType,
        status: "PROCESSED",
        detail: "Event applied successfully.",
        payload: JSON.stringify(payload),
        processedAt: new Date(),
      },
      create: {
        eventId,
        eventType,
        status: "PROCESSED",
        detail: "Event applied successfully.",
        payload: JSON.stringify(payload),
        processedAt: new Date(),
        createdAt: new Date(),
      },
    });

    return NextResponse.json({ duplicate: false, eventId, status: "PROCESSED" });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Event processing failed.";
    await prisma.integrationEvent.upsert({
      where: { eventId },
      update: { status: "FAILED", detail },
      create: {
        eventId,
        eventType,
        status: "FAILED",
        detail,
        payload: JSON.stringify(payload),
        processedAt: new Date(),
        createdAt: new Date(),
      },
    });
    return NextResponse.json({ error: detail, eventId }, { status: 422 });
  }
}
