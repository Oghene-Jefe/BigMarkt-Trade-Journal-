/* ====================================================
   OFFLINE QUEUE — IndexedDB
   Stores trades locally when the device has no network.
   Syncs to Supabase automatically on reconnection.

   Record shape stored in IndexedDB:
   {
     trade:              {},        // full trade payload for Supabase insert
     user_id:            'uuid',
     queued_at:          timestamp, // when it was queued
     original_timestamp: timestamp  // exact moment trader hit submit (used as created_at)
   }
   ==================================================== */

let _offlineDB = null;

/* Open (or create) the IndexedDB database */
function initOfflineDB() {
  return new Promise((resolve) => {
    if (!('indexedDB' in window)) {
      console.warn('IndexedDB not supported — offline queue disabled');
      return resolve();
    }

    const req = indexedDB.open('bigmarkt_offline', 1);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('pending_trades')) {
        db.createObjectStore('pending_trades', { autoIncrement: true });
      }
    };

    req.onsuccess = (e) => {
      _offlineDB = e.target.result;
      console.log('Offline queue ready (IndexedDB)');
      // Restore badge if trades were queued in a previous session
      _updateOfflineBadge();
      resolve();
    };

    req.onerror = (e) => {
      // Non-fatal — app works normally, just without offline support
      console.error('IndexedDB failed to open:', e.target.error);
      resolve();
    };
  });
}

/* Wrap an IDB request in a Promise */
function _idbRequest(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror  = () => reject(req.error);
  });
}

/* Returns the pending_trades object store in the given transaction mode */
function _idbStore(mode) {
  if (!_offlineDB) return null;
  return _offlineDB.transaction('pending_trades', mode).objectStore('pending_trades');
}

/* Update the nav badge to reflect pending queue count */
async function _updateOfflineBadge() {
  const badge = document.getElementById('offlineBadge');
  if (!badge) return;
  if (!_offlineDB) { badge.style.display = 'none'; return; }

  try {
    const count = await _idbRequest(_idbStore('readonly').count());
    if (count === 0) {
      badge.style.display = 'none';
    } else {
      badge.textContent  = count + ' pending';
      badge.style.display = '';
    }
  } catch (e) {
    badge.style.display = 'none';
  }
}

/* Queue a trade in IndexedDB when the device is offline */
async function queueTrade(tradeData, userId) {
  if (!_offlineDB) {
    toast('Offline save unavailable — please reconnect and try again.', 'error');
    return;
  }

  const record = {
    trade: { ...tradeData },        // snapshot so later mutations don't affect it
    user_id: userId,
    queued_at: Date.now(),
    original_timestamp: Date.now()  // preserves exact submit time for calendar accuracy
  };

  try {
    await _idbRequest(_idbStore('readwrite').add(record));
    // Neutral toast — this is expected behaviour, not an error
    toast("No connection — trade saved offline. Will sync when you're back online.");
    await _updateOfflineBadge();
  } catch (e) {
    console.error('Failed to write to offline queue:', e);
    toast('Failed to save trade offline.', 'error');
  }
}

/* Sync all queued trades to Supabase when back online */
async function syncPendingTrades() {
  if (!_offlineDB || !state.user) return;

  let records, keys;
  try {
    // Fetch records and their IDB keys in one round-trip each
    [records, keys] = await Promise.all([
      _idbRequest(_idbStore('readonly').getAll()),
      _idbRequest(_idbStore('readonly').getAllKeys())
    ]);
  } catch (e) {
    console.error('Failed to read offline queue:', e);
    return;
  }

  if (!records || records.length === 0) return;

  let synced = 0;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const key    = keys[i];

    try {
      // Restore original submit timestamp so calendar heatmap dates stay accurate
      const payload = {
        ...record.trade,
        created_at: new Date(record.original_timestamp).toISOString()
      };

      const { error } = await _sb.from('trades').insert(payload);

      if (!error) {
        await _idbRequest(_idbStore('readwrite').delete(key));
        synced++;
      } else {
        // Leave in queue — likely a transient error; retry on next reconnect
        console.warn('Sync attempt failed for queued trade:', error.message);
      }
    } catch (e) {
      // fetch() threw — still no network despite 'online' event; leave in queue
      console.warn('Network error during sync, will retry:', e.message);
    }
  }

  if (synced > 0) {
    toast(synced + ' trade' + (synced > 1 ? 's' : '') + ' synced successfully ✅');
    clearCache();
    await loadTrades();
    if (state.currentPage === 'journal')   renderJournal();
    if (state.currentPage === 'dashboard') renderDashboard();
  }

  await _updateOfflineBadge();
}
