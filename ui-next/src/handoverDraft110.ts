import type { HandoverDraft110, HandoverSnapshot } from './HandoverPage';
import type { ReadSession1098 } from './queries1098/readCoordinator1098';

const drafts = new WeakMap<ReadSession1098, HandoverDraft110>();

export function handoverContext110(snapshot: HandoverSnapshot): string {
  const shift = snapshot.shiftId || snapshot.date + '|' + snapshot.shift;
  return [shift, snapshot.stage, snapshot.deliveryId || ''].join('|');
}

export function readHandoverDraft110(session: ReadSession1098): HandoverDraft110 | undefined {
  return session.active ? drafts.get(session) : undefined;
}

export function saveHandoverDraft110(session: ReadSession1098, draft: HandoverDraft110): void {
  if (session.active) drafts.set(session, draft);
}

export function reconcileHandoverDraft110(snapshot: HandoverSnapshot, previous?: HandoverDraft110): {draft:HandoverDraft110;message:string} {
  const contextKey = handoverContext110(snapshot);
  const reviewContext = JSON.stringify(snapshot.items.map(item => [item.id,!!item.critical,!!item.overdue,!!item.dueSoon]).sort((a,b) => String(a[0]).localeCompare(String(b[0]))));
  if (!previous || previous.contextKey !== contextKey) {
    return {
      draft:{contextKey,summary:snapshot.stage==='delivery'?'':snapshot.deliverySummary||'',receiptNote:snapshot.receiptNote||'',deliveryChecks:{},reviewedVersions:{},reviewToken:snapshot.reviewToken,reviewContext},
      message:previous?'O contexto da passagem mudou. A conferência foi reiniciada para este turno.':'',
    };
  }
  const changed = previous.reviewToken !== snapshot.reviewToken || previous.reviewContext !== reviewContext;
  const reviewedVersions = Object.fromEntries(snapshot.items
    .filter(item => item.critical && previous.reviewedVersions[item.id] === item.readVersion)
    .map(item => [item.id, item.readVersion]));
  const readingsChanged = Object.keys(previous.reviewedVersions).length !== Object.keys(reviewedVersions).length;
  return {
    draft:{...previous,reviewToken:snapshot.reviewToken,reviewContext,deliveryChecks:changed?{}:previous.deliveryChecks,reviewedVersions},
    message:changed||readingsChanged?'As informações do turno foram atualizadas. Seu texto foi preservado; confira novamente os itens alterados.':'',
  };
}
