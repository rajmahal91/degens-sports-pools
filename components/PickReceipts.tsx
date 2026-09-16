'use client';

import { useEffect, useState } from 'react';

type Receipt = {
  id: string;
  pick_type: string;
  pick_key: string;
  action: string;
  after_state: Record<string, unknown>;
  recorded_at: string;
  entry_name?: string;
};

function pickLabel(receipt: Receipt) {
  const state = receipt.after_state || {};
  return String(state.team_code || state.selected_team || state.athlete_id || 'Pick saved');
}

function typeLabel(type: string) {
  return type === 'PICKEM' ? 'Pick’em' : type === 'PLAYOFF_FANTASY' ? 'Playoff Fantasy' : 'Survivor';
}

export default function PickReceipts({ entryId, poolId, refreshToken = 0 }: { entryId?: string; poolId?: string; refreshToken?: number }) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!entryId && !poolId) {
      setReceipts([]);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const query = entryId
      ? `entryId=${encodeURIComponent(entryId)}`
      : `poolId=${encodeURIComponent(poolId || '')}`;
    fetch(`/api/picks/history?${query}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Could not load pick receipts.');
        setReceipts(body.receipts || []);
      })
      .catch((reason) => {
        if (reason?.name !== 'AbortError') setError('Pick history is temporarily unavailable.');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [entryId, poolId, refreshToken]);

  if (!entryId && !poolId) return null;
  return (
    <section className="pickReceipts">
      <div className="pickReceiptsHeader">
        <div>
          <span className="eyebrow">PROOF OF SUBMISSION</span>
          <h2>Pick receipts</h2>
        </div>
        <button type="button" className="secondary" onClick={() => setOpen((value) => !value)}>
          {open ? 'Hide history' : 'View history'}
        </button>
      </div>
      {loading && <p className="muted">Loading receipt history…</p>}
      {error && <p className="warning">{error}</p>}
      {!loading && !error && !receipts.length && <p className="muted">Your confirmed submissions will appear here.</p>}
      {!loading && !error && receipts.length > 0 && (
        <div className="receiptList">
          {(open ? receipts : receipts.slice(0, 3)).map((receipt) => (
            <article className="receiptRow" key={receipt.id}>
              <div>
                <strong>{pickLabel(receipt)}</strong>
                <span>{receipt.entry_name && poolId ? receipt.entry_name + ' · ' : ''}{typeLabel(receipt.pick_type)} · {receipt.pick_key.replaceAll('-', ' ')}</span>
              </div>
              <div>
                <b>{receipt.action === 'CHANGED' ? 'Changed' : 'Confirmed and locked'}</b>
                <small>{new Date(receipt.recorded_at).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}</small>
              </div>
            </article>
          ))}
          {!open && receipts.length > 3 && <small className="muted">Showing the three most recent receipts.</small>}
        </div>
      )}
    </section>
  );
}
