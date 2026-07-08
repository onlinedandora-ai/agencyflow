import type { BoardColumn } from './service-line-templates';

export const INCLUDED_REVISION_ROUNDS = 2;

export function isClientReviewColumn(column: BoardColumn): boolean {
  return column.status === 'CLIENT_REVIEW';
}

export function isApprovedColumn(column: BoardColumn): boolean {
  return column.status === 'APPROVED';
}

export function isInternalQaColumn(column: BoardColumn): boolean {
  return column.status === 'INTERNAL_QA';
}

export function nextRevisionRound(currentRound: number, returningFromClientReview: boolean): number {
  return returningFromClientReview ? currentRound + 1 : currentRound;
}

export function requiresBillableAcknowledgement(revisionRound: number): boolean {
  return revisionRound >= INCLUDED_REVISION_ROUNDS + 1;
}
