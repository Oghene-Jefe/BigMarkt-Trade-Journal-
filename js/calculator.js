/* ====================================================
   RISK / LOT SIZE CALCULATOR
   Formula: Lot Size = Risk$ ÷ (SL pips × pipValue per standard lot)
   Verified: XAU/USD 0.01 lot × 1 pip = $0.10 → 1.00 lot × 1 pip = $10
   ==================================================== */

const MIN_LOT = 0.01; // industry minimum lot

function getInstrumentInfo(pair) {
  // pipValue = $ per pip at 1.00 STANDARD LOT
  // Verified from user: XAU/USD 0.01 lot × 150 pips = $15
  // → 1 pip at 0.01 lot = $0.10 → 1 pip at 1.00 lot = $10
  const info = {

    // ── METALS ──────────────────────────────────────────────────────
    // 0.01 lot × 1 pip = $0.10 → std lot = $10/pip
    'XAU/USD': {
      pipValue: 10,
      unit: 'pips',
      hint: '1 pip = $0.01 price move (2nd decimal). <strong>$4000→$4010 = 1000 pips.</strong><br>At 0.01 lot: 1 pip = $0.10. Multiply $ distance × 100 to get pips.<br>Example: SL $1.50 away = 150 pips → costs $15 at 0.01 lot.'
    },
    'XAG/USD': {
      pipValue: 5,
      unit: 'pips',
      hint: '1 pip = $0.001 price move for Silver. Count from 3rd decimal.<br>0.01 lot × 1 pip = $0.05.'
    },

    // ── FOREX MAJORS ─────────────────────────────────────────────────
    // 0.01 lot × 1 pip = $0.10 → std lot = $10/pip
    'EUR/USD': {
      pipValue: 10,
      unit: 'pips',
      hint: '1 pip = 0.0001 (4th decimal). 0.01 lot × 1 pip = $0.10.<br>Entry 1.0850, SL 1.0820 → <strong>30 pips</strong>.'
    },
    'GBP/USD': {
      pipValue: 10,
      unit: 'pips',
      hint: '1 pip = 0.0001 (4th decimal). 0.01 lot × 1 pip = $0.10.<br>Entry 1.2700, SL 1.2670 → <strong>30 pips</strong>.'
    },
    'AUD/USD': {
      pipValue: 10,
      unit: 'pips',
      hint: '1 pip = 0.0001 (4th decimal). 0.01 lot × 1 pip = $0.10.<br>Entry 0.6500, SL 0.6470 → <strong>30 pips</strong>.'
    },
    'USD/CAD': {
      pipValue: 7.5,
      unit: 'pips',
      hint: '1 pip = 0.0001 (4th decimal). Pip value ≈ $7.50/lot.<br>Entry 1.3600, SL 1.3570 → <strong>30 pips</strong>.'
    },
    // JPY pairs: 1 pip = 0.01 · pip value ≈ $6.80/lot
    'USD/JPY': {
      pipValue: 6.8,
      unit: 'pips',
      hint: '1 pip = 0.01 (2nd decimal for JPY). Pip value ≈ $6.80/lot.<br>Entry 155.50, SL 155.20 → <strong>30 pips</strong>.'
    },
    'GBP/JPY': {
      pipValue: 6.8,
      unit: 'pips',
      hint: '1 pip = 0.01 (2nd decimal for JPY). Pip value ≈ $6.80/lot.<br>Entry 198.50, SL 198.00 → <strong>50 pips</strong>.'
    },
    'EUR/JPY': {
      pipValue: 6.8,
      unit: 'pips',
      hint: '1 pip = 0.01 (2nd decimal for JPY). Pip value ≈ $6.80/lot.<br>Entry 165.00, SL 164.50 → <strong>50 pips</strong>.'
    },

    // ── INDICES ──────────────────────────────────────────────────────
    'US30':  { pipValue: 1, unit: 'points', hint: '1 point = 1 index unit. Entry 39800, SL 39700 → <strong>100 points</strong>.' },
    'NAS100':{ pipValue: 1, unit: 'points', hint: '1 point = 1 index unit. Entry 18000, SL 17950 → <strong>50 points</strong>.' },
    'US500': { pipValue: 1, unit: 'points', hint: '1 point = 1 index unit. Entry 5300, SL 5280 → <strong>20 points</strong>.' },
    'UK100': { pipValue: 1, unit: 'points', hint: '1 point = 1 index unit (FTSE). Entry 8500, SL 8450 → <strong>50 points</strong>.' },
    'GER40': { pipValue: 1, unit: 'points', hint: '1 point = 1 index unit (DAX). Entry 18000, SL 17900 → <strong>100 points</strong>.' },

    // ── OIL ──────────────────────────────────────────────────────────
    // 0.01 lot × 1 pip = $0.10 → std lot = $10/pip
    'USOIL': {
      pipValue: 10,
      unit: 'pips',
      hint: '1 pip = $0.01 price move. Entry $72.00, SL $71.50 → $0.50 diff → <strong>50 pips</strong>.<br>0.01 lot × 1 pip = $0.10.'
    },
    'UKOIL': {
      pipValue: 10,
      unit: 'pips',
      hint: '1 pip = $0.01 price move. Entry $76.00, SL $75.50 → $0.50 diff → <strong>50 pips</strong>.<br>0.01 lot × 1 pip = $0.10.'
    },

    // ── CRYPTO ───────────────────────────────────────────────────────
    'BTC/USD': { pipValue: 1, unit: 'pips', hint: '1 pip = $1 price move. Entry $65,000, SL $64,500 → <strong>500 pips</strong>.' },
    'ETH/USD': { pipValue: 1, unit: 'pips', hint: '1 pip ≈ $0.01 price move. Use price diff × 100.' },
    'XRP/USD': { pipValue: 1, unit: 'pips', hint: '1 pip = $0.0001 price move. Multiply price diff × 10,000.' },

    // ── SYNTHETICS (Deriv) ───────────────────────────────────────────
    'Boom 500':  { pipValue: 0.1, unit: 'points', hint: 'Enter SL distance in points as shown on your MT5/DTrader chart.' },
    'Boom 1000': { pipValue: 0.1, unit: 'points', hint: 'Enter SL distance in points as shown on your MT5/DTrader chart.' },
    'Crash 500': { pipValue: 0.1, unit: 'points', hint: 'Enter SL distance in points as shown on your MT5/DTrader chart.' },
    'Crash 1000':{ pipValue: 0.1, unit: 'points', hint: 'Enter SL distance in points as shown on your MT5/DTrader chart.' },
    'V75':       { pipValue: 0.1, unit: 'points', hint: 'Volatility 75 Index. Enter SL distance in points from your chart.' },
    'V25':       { pipValue: 0.1, unit: 'points', hint: 'Volatility 25 Index. Enter SL distance in points from your chart.' },
  };

  return info[pair] || { pipValue: 10, unit: 'pips', hint: 'Standard pair. 1 pip = 0.0001 price move. Count from 4th decimal.' };
}

// Smart calculation — returns lot size AND feasibility check
function calcLotSize(balance, riskPct, slPips, pair) {
  const info       = getInstrumentInfo(pair);
  const riskAmt    = (balance * riskPct) / 100;
  const rawLot     = riskAmt / (slPips * info.pipValue);
  const minLotCost = slPips * info.pipValue * MIN_LOT;   // cost if forced to 0.01
  const minLotPct  = (minLotCost / balance) * 100;       // % risk at min lot
  const feasible   = rawLot >= MIN_LOT;                  // can we stay within budget?

  // Round to nearest 0.01, clamp to [0.01, 999]
  const lot = Math.round(Math.max(MIN_LOT, Math.min(rawLot, 999)) / 0.01) * 0.01;

  return { lot, rawLot, riskAmt, minLotCost, minLotPct, feasible, info };
}

function renderCalc() { runCalc(); }
function setRiskPreset(pct) {
  document.getElementById('calcRiskPct').value = pct;
  runCalc();
}

function runCalc() {
  const balance = parseFloat(document.getElementById('calcBalance').value);
  const riskPct = parseFloat(document.getElementById('calcRiskPct').value);
  const pair    = document.getElementById('calcPair').value;
  const slDist  = parseFloat(document.getElementById('calcSLPips').value);
  const info    = getInstrumentInfo(pair);

  document.getElementById('calcSLUnit').textContent = '(' + info.unit + ')';
  document.getElementById('calcHintText').innerHTML = info.hint;

  if (!balance || !riskPct || !slDist || slDist <= 0) {
    document.getElementById('calcLotOutput').textContent = '—';
    document.getElementById('calcLotSub').textContent = 'Fill in all fields to calculate';
    document.getElementById('calcBreakdown').style.display = 'none';
    const w = document.getElementById('calcWarning');
    if (w) w.style.display = 'none';
    return;
  }

  const result  = calcLotSize(balance, riskPct, slDist, pair);
  const warnEl  = document.getElementById('calcWarning');

  if (!result.feasible) {
    const maxSL        = Math.floor(result.riskAmt / (info.pipValue * MIN_LOT));
    const neededBal    = Math.ceil(result.minLotCost / (riskPct / 100));
    document.getElementById('calcLotOutput').textContent = '✕';
    document.getElementById('calcLotOutput').style.color = 'var(--loss)';
    document.getElementById('calcLotSub').textContent = 'Setup not feasible within risk budget';
    document.getElementById('calcBreakdown').style.display = 'none';
    if (warnEl) {
      warnEl.style.display = 'block';
      warnEl.innerHTML = `
        <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.4);border-radius:10px;padding:14px;margin-top:12px;">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:14px;color:var(--loss);margin-bottom:8px;">⚠️ CANNOT OPEN THIS POSITION WITHIN ${riskPct}% RISK</div>
          <div style="font-size:12px;color:var(--muted);line-height:1.8;">
            Budget: <strong style="color:var(--text);">$${result.riskAmt.toFixed(2)}</strong> · Min lot cost: <strong style="color:var(--loss);">$${result.minLotCost.toFixed(2)}</strong> (${result.minLotPct.toFixed(1)}%)<br><br>
            <strong style="color:var(--gold);">① Tighten SL</strong> to ${maxSL > 0 ? '<strong style="color:var(--text);">' + maxSL + ' ' + info.unit + '</strong>' : 'not possible — account too small'}<br>
            <strong style="color:var(--gold);">② Grow account</strong> to at least <strong style="color:var(--text);">$${neededBal.toLocaleString()}</strong><br>
            <strong style="color:var(--gold);">③ Switch pair</strong> — EUR/USD with same SL = <strong style="color:var(--text);">$${(slDist * 10 * MIN_LOT).toFixed(2)}</strong> at 0.01 lot
          </div>
        </div>`;
    }
    return;
  }

  document.getElementById('calcLotOutput').textContent = result.lot.toFixed(2);
  document.getElementById('calcLotOutput').style.color = 'var(--gold)';
  document.getElementById('calcLotSub').textContent = `${riskPct}% of $${balance.toLocaleString()} on ${pair} · SL ${slDist} ${info.unit}`;
  document.getElementById('calcBreakdown').style.display = 'grid';
  if (warnEl) warnEl.style.display = 'none';

  const actualCost = slDist * info.pipValue * result.lot;
  document.getElementById('calcRiskAmt').textContent  = '$' + result.riskAmt.toFixed(2);
  document.getElementById('calcPipVal').textContent   = '$' + (info.pipValue * result.lot).toFixed(2) + '/pip';
  document.getElementById('calcSLDist').textContent   = slDist + ' ' + info.unit;
  document.getElementById('calcMaxLoss').textContent  = '$' + actualCost.toFixed(2);
}

/* ====================================================
   FLOATING RISK CALCULATOR DRAWER
   ==================================================== */
function openCalcDrawer() {
  document.getElementById('calcDrawer').classList.add('open');
  document.getElementById('calcDrawerBackdrop').classList.add('open');
  document.body.style.overflow = 'hidden';
  // Sync pair from form if on Add page
  syncDrawerPairFromForm();
  // Build risk table immediately on open
  runDrawerCalc();
}

function closeCalcDrawer() {
  document.getElementById('calcDrawer').classList.remove('open');
  document.getElementById('calcDrawerBackdrop').classList.remove('open');
  document.body.style.overflow = '';
}

// Sync drawer pair from the Add Trade form pair selector
function syncDrawerPairFromForm() {
  const formPair = document.getElementById('pairSelect')?.value;
  const drawerSel = document.getElementById('drawerPair');
  if (formPair && formPair !== '__custom' && drawerSel) {
    const opt = drawerSel.querySelector(`option[value="${formPair}"]`);
    if (opt) drawerSel.value = formPair;
  }
}

function setDrawerRisk(pct) {
  document.getElementById('drawerRiskPct').value = pct;
  runDrawerCalc();
}

function runDrawerCalc() {
  const balance = parseFloat(document.getElementById('drawerBalance')?.value);
  const riskPct = parseFloat(document.getElementById('drawerRiskPct')?.value);
  const slDist  = parseFloat(document.getElementById('drawerSLPips')?.value);
  const pair    = document.getElementById('drawerPair')?.value || 'XAU/USD';

  const info = getInstrumentInfo(pair);

  // Update unit label and hint
  const unitEl = document.getElementById('drawerSLUnit');
  const hintEl = document.getElementById('drawerHintText');
  if (unitEl) unitEl.textContent = '(' + info.unit + ')';
  if (hintEl) hintEl.innerHTML = info.hint || 'Enter your stop loss distance.';

  // Always build the account risk reference table
  const tableEl = document.getElementById('drawerRiskTable');
  if (tableEl) {
    const sizes = [100, 200, 500, 1000, 2000, 5000, 10000, 25000, 50000];
    tableEl.innerHTML = sizes.map(s => `
      <tr style="border-bottom:1px solid var(--line);">
        <td style="padding:6px 8px;font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--gold);">$${s.toLocaleString()}</td>
        <td style="text-align:right;padding:6px 8px;font-family:'JetBrains Mono',monospace;color:var(--muted);">$${(s*0.005).toFixed(2)}</td>
        <td style="text-align:right;padding:6px 8px;font-family:'JetBrains Mono',monospace;color:var(--text);">$${(s*0.01).toFixed(2)}</td>
        <td style="text-align:right;padding:6px 8px;font-family:'JetBrains Mono',monospace;color:var(--gold);">$${(s*0.02).toFixed(2)}</td>
        <td style="text-align:right;padding:6px 8px;font-family:'JetBrains Mono',monospace;color:var(--loss);">$${(s*0.05).toFixed(2)}</td>
      </tr>`).join('');
  }

  const loEl = document.getElementById('drawerLotOutput');
  const lsEl = document.getElementById('drawerLotSub');
  const bdEl = document.getElementById('drawerBreakdown');
  const warnEl = document.getElementById('drawerWarning');

  if (!balance || !riskPct || !slDist || slDist <= 0) {
    if (loEl) loEl.textContent = '—';
    if (lsEl) lsEl.textContent = 'Enter balance, risk % and SL distance';
    if (bdEl) bdEl.style.display = 'none';
    if (warnEl) warnEl.style.display = 'none';
    return;
  }

  const result = calcLotSize(balance, riskPct, slDist, pair);

  // ── FEASIBILITY CHECK ──────────────────────────────────────────────
  if (!result.feasible) {
    // Can't open position within risk budget — show clear warning
    const maxSL = Math.floor(result.riskAmt / (info.pipValue * MIN_LOT));
    const neededBalance = Math.ceil(result.minLotCost / (riskPct / 100));

    if (loEl) {
      loEl.textContent = '✕';
      loEl.style.color = 'var(--loss)';
    }
    if (lsEl) {
      lsEl.style.color = 'var(--loss)';
      lsEl.textContent = 'Cannot trade this setup within your risk budget';
    }
    if (bdEl) bdEl.style.display = 'none';

    if (warnEl) {
      warnEl.style.display = 'block';
      warnEl.innerHTML = `
        <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.4);border-radius:10px;padding:14px;margin-bottom:12px;">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:15px;letter-spacing:0.08em;color:var(--loss);margin-bottom:8px;">⚠️ POSITION NOT FEASIBLE</div>
          <div style="font-size:12px;color:var(--muted);line-height:1.8;">
            Your ${riskPct}% risk budget = <strong style="color:var(--text);">$${result.riskAmt.toFixed(2)}</strong><br>
            Minimum lot (0.01) on ${pair} with ${slDist} ${info.unit} SL costs <strong style="color:var(--loss);">$${result.minLotCost.toFixed(2)}</strong> (${result.minLotPct.toFixed(1)}% of account)<br><br>
            <strong style="color:var(--text);">You have 3 options:</strong>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px;">
            <div style="background:var(--black-3);border:1px solid var(--line);border-radius:8px;padding:10px 12px;font-size:12px;color:var(--muted);line-height:1.6;">
              <span style="color:var(--gold);font-weight:700;">① Tighten SL</span> — reduce to <strong style="color:var(--text);">${maxSL > 0 ? maxSL + ' ' + info.unit : 'not possible at this balance'}</strong> to stay within ${riskPct}% at 0.01 lot
            </div>
            <div style="background:var(--black-3);border:1px solid var(--line);border-radius:8px;padding:10px 12px;font-size:12px;color:var(--muted);line-height:1.6;">
              <span style="color:var(--gold);font-weight:700;">② Grow your account</span> — you need at least <strong style="color:var(--text);">$${neededBalance.toLocaleString()}</strong> to risk ${riskPct}% on this exact setup
            </div>
            <div style="background:var(--black-3);border:1px solid var(--line);border-radius:8px;padding:10px 12px;font-size:12px;color:var(--muted);line-height:1.6;">
              <span style="color:var(--gold);font-weight:700;">③ Trade a different pair</span> — EUR/USD with ${slDist} pip SL at 0.01 lot costs <strong style="color:var(--text);">$${(slDist * 10 * MIN_LOT).toFixed(2)}</strong> — may fit your budget
            </div>
          </div>
        </div>`;
    }
    return;
  }

  // ── NORMAL RESULT ─────────────────────────────────────────────────
  const display = result.lot >= 0.1 ? result.lot.toFixed(2) : result.lot.toFixed(2);

  if (loEl) {
    loEl.textContent = display;
    loEl.style.color = 'var(--gold)';
  }
  if (lsEl) {
    lsEl.style.color = 'var(--muted)';
    lsEl.textContent = `${riskPct}% of $${balance.toLocaleString()} · ${pair} · SL ${slDist} ${info.unit}`;
  }
  if (bdEl) bdEl.style.display = 'grid';
  if (warnEl) warnEl.style.display = 'none';

  // Verify: actual cost at calculated lot
  const actualCost = slDist * info.pipValue * result.lot;

  const raEl = document.getElementById('drawerRiskAmt');
  const pvEl = document.getElementById('drawerPipVal');
  const sdEl = document.getElementById('drawerSLDist');
  const mlEl = document.getElementById('drawerMaxLoss');

  if (raEl) raEl.textContent = '$' + result.riskAmt.toFixed(2);
  if (pvEl) pvEl.textContent = '$' + (info.pipValue * result.lot).toFixed(2) + '/pip';
  if (sdEl) sdEl.textContent = slDist + ' ' + info.unit;
  if (mlEl) mlEl.textContent = '$' + actualCost.toFixed(2);
}

// Close drawer on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeCalcDrawer();
});
