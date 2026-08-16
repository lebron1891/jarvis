import type { Prisma, TransactionType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../middleware/error";

type Tx = Prisma.TransactionClient;

/**
 * Applies a ledger entry and keeps User.creditBalance in sync, atomically.
 * Throws 409 when a debit would take the balance below zero.
 */
export async function applyLedgerEntry(
  tx: Tx,
  params: {
    userId: string;
    amount: number;
    type: TransactionType;
    description: string;
    bookingId?: string;
  },
) {
  const user = await tx.user.findUniqueOrThrow({
    where: { id: params.userId },
    select: { creditBalance: true },
  });
  const balanceAfter = user.creditBalance + params.amount;
  if (balanceAfter < 0) {
    throw ApiError.conflict("Not enough credits for this exchange");
  }
  await tx.user.update({
    where: { id: params.userId },
    data: { creditBalance: balanceAfter },
  });
  return tx.creditTransaction.create({
    data: {
      userId: params.userId,
      amount: params.amount,
      balanceAfter,
      type: params.type,
      description: params.description,
      bookingId: params.bookingId,
    },
  });
}

export async function grantCredits(
  userId: string,
  amount: number,
  type: TransactionType,
  description: string,
) {
  return prisma.$transaction((tx) =>
    applyLedgerEntry(tx, { userId, amount, type, description }),
  );
}
