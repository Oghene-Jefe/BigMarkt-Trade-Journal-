/* ================================================
   BIGMARKT TRADE JOURNAL — analytics.js
   Charts: PnL curve, pair win rate, session,
   emotion tracker, grade breakdown, tag impact
   ================================================ */

   let charts = { pnl: null, pair: null, emotion: null };

   /* ---------- MAIN RENDER ---------- */
   function renderAnalytics() {
     setTimeout(() => {
       drawPnLChart();
       drawPairChart();
       drawSessionList();
       drawEmotionChart();
     }, 30);
   }
   
   /* ---------- SHARED CHART CONFIG ---------- */
   function chartCommon() {
     return {
       plugins: {
         legend: { display: false },
         tooltip: {
           backgroundColor: '#181818',
           borderColor:      '#D4AF37',
           borderWidth:       1,
           titleColor:       '#D4AF37',
           bodyColor:        '#F5F5F5',
           padding:           10,
           titleFont: { family: 'JetBrains Mono', size: 11 },
           bodyFont:  { family: 'Inter', size: 12 },
         }
       },
       scales: {
         x: { grid: { color: '#1c1c1c' }, ticks: { color: '#888', font: { family: 'JetBrains Mono', size: 10 } } },
         y: { grid: { color: '#1c1c1c' }, ticks: { color: '#888', font: { family: 'JetBrains Mono', size: 10 } } }
       },
       responsive:          true,
       maintainAspectRatio: false
     };
   }
   
   /* ---------- PNL CURVE ---------- */
   function drawPnLChart() {
     const ctx    = document.getElementById('chartPnL').getContext('2d');
     if (charts.pnl) charts.pnl.destroy();
   
     const sorted = [...state.trades].sort((a, b) => a.created_at - b.created_at);
     let cum = 0;
     const labels = sorted.map(t => fmtDate(t.created_at));
     const data   = sorted.map(t => { cum += Number(t.pnl) || 0; return cum; });
     if (sorted.length === 0) { labels.push(''); data.push(0); }
   
     const grad = ctx.createLinearGradient(0, 0, 0, 260);
     grad.addColorStop(0, 'rgba(212,175,55,0.4)');
     grad.addColorStop(1, 'rgba(212,175,55,0)');
   
     charts.pnl = new Chart(ctx, {
       type: 'line',
       data: {
         labels,
         datasets: [{
           data,
           borderColor:        '#D4AF37',
           backgroundColor:     grad,
           fill:                true,
           tension:             0.3,
           borderWidth:         2.5,
           pointBackgroundColor:'#D4AF37',
           pointBorderColor:    '#0A0A0A',
           pointBorderWidth:    2,
           pointRadius:         4,
           pointHoverRadius:    6
         }]
       },
       options: {
         ...chartCommon(),
         plugins: {
           ...chartCommon().plugins,
           tooltip: {
             ...chartCommon().plugins.tooltip,
             callbacks: { label: (c) => 'Cum PnL: ' + fmtMoney(c.parsed.y) }
           }
         }
       }
     });
   }
   
   /* ---------- WIN RATE BY PAIR ---------- */
   function drawPairChart() {
     const ctx = document.getElementById('chartPair').getContext('2d');
     if (charts.pair) charts.pair.destroy();
   
     const map = {};
     state.trades.forEach(t => {
       if (!map[t.pair]) map[t.pair] = { wins: 0, losses: 0 };
       if (t.result === 'WIN')  map[t.pair].wins++;
       if (t.result === 'LOSS') map[t.pair].losses++;
     });
   
     const pairs = Object.keys(map).filter(p => map[p].wins + map[p].losses > 0);
     const rates = pairs.map(p => Math.round((map[p].wins / (map[p].wins + map[p].losses)) * 100));
   
     charts.pair = new Chart(ctx, {
       type: 'bar',
       data: {
         labels:   pairs.length ? pairs : ['—'],
         datasets: [{
           data:            pairs.length ? rates : [0],
           backgroundColor: pairs.map((_, i) => rates[i] >= 50 ? '#D4AF37' : '#5a5a5a'),
           borderRadius:    6,
           borderSkipped:   false
         }]
       },
       options: {
         ...chartCommon(),
         scales: {
           x: chartCommon().scales.x,
           y: {
             ...chartCommon().scales.y,
             max: 100,
             ticks: { ...chartCommon().scales.y.ticks, callback: v => v + '%' }
           }
         },
         plugins: {
           ...chartCommon().plugins,
           tooltip: {
             ...chartCommon().plugins.tooltip,
             callbacks: { label: (c) => 'Win rate: ' + c.parsed.y + '%' }
           }
         }
       }
     });
   }
   
   /* ---------- SESSION PERFORMANCE ---------- */
   function drawSessionList() {
     const sessions = ['London', 'New York', 'Asian', 'Overlap'];
     const data = sessions.map(s => {
       const arr    = state.trades.filter(t => t.session === s);
       const pnl    = arr.reduce((acc, t) => acc + (Number(t.pnl) || 0), 0);
       const wins   = arr.filter(t => t.result === 'WIN').length;
       const losses = arr.filter(t => t.result === 'LOSS').length;
       const rate   = (wins + losses) === 0 ? null : Math.round(wins / (wins + losses) * 100);
       return { name: s, count: arr.length, pnl, rate };
     });
   
     const maxAbs = Math.max(1, ...data.map(d => Math.abs(d.pnl)));
   
     document.getElementById('sessionList').innerHTML = data.map(d => {
       const pct = Math.min(100, Math.abs(d.pnl) / maxAbs * 100);
       return `
         <div class="session-row">
           <div class="session-name">${d.name}</div>
           <div class="session-bar">
             <div class="session-bar-fill" style="width:${pct}%; background:${d.pnl >= 0
               ? 'linear-gradient(90deg,var(--gold-dim),var(--gold))'
               : 'linear-gradient(90deg,#7a2222,#ef4444)'}">
             </div>
           </div>
           <div class="session-stat">
             <span style="color:${d.pnl > 0 ? 'var(--win)' : d.pnl < 0 ? 'var(--loss)' : 'var(--muted)'}">${fmtMoney(d.pnl)}</span>
             <span style="margin-left:10px;">${d.count} tr</span>
             ${d.rate !== null ? `<span style="margin-left:10px;color:var(--gold)">${d.rate}%</span>` : ''}
           </div>
         </div>`;
     }).join('');
   }
   
   /* ---------- EMOTION TRACKER ---------- */
   function drawEmotionChart() {
     const ctx = document.getElementById('chartEmotion').getContext('2d');
     if (charts.emotion) charts.emotion.destroy();
   
     const emotions = ['Confident', 'Patient', 'Hesitant', 'FOMO', 'Revenge'];
     const counts   = emotions.map(e => state.trades.filter(t => t.emotions === e).length);
     const pnls     = emotions.map(e =>
       state.trades.filter(t => t.emotions === e).reduce((s, t) => s + (Number(t.pnl) || 0), 0));
   
     charts.emotion = new Chart(ctx, {
       type: 'bar',
       data: {
         labels:   emotions,
         datasets: [{
           label:           'PnL',
           data:            pnls,
           backgroundColor: pnls.map(v => v > 0 ? '#D4AF37' : v < 0 ? '#ef4444' : '#3a3a3a'),
           borderRadius:    6,
           borderSkipped:   false
         }]
       },
       options: {
         ...chartCommon(),
         plugins: {
           ...chartCommon().plugins,
           tooltip: {
             ...chartCommon().plugins.tooltip,
             callbacks: {
               label: (c) => {
                 const i = c.dataIndex;
                 return ['PnL: ' + fmtMoney(pnls[i]), 'Trades: ' + counts[i]];
               }
             }
           }
         }
       }
     });
   
     // ── GRADE WIN RATE BREAKDOWN ──
     const gradeEl = document.getElementById('gradeBreakdown');
     if (gradeEl) {
       const grades       = ['A+', 'A', 'B', 'C', 'D'];
       const gradeColors  = { 'A+': '#16a34a', 'A': '#22c55e', 'B': '#D4AF37', 'C': '#f97316', 'D': '#ef4444' };
       const gradedTrades = state.trades.filter(t => t.setup_grade);
   
       if (gradedTrades.length === 0) {
         gradeEl.innerHTML = `<div style="color:var(--muted);font-size:13px;text-align:center;padding:24px 0;">No graded trades yet.<br><span style="font-size:11px;">Add setup grades when logging trades.</span></div>`;
       } else {
         const rows = grades.map(g => {
           const gt   = gradedTrades.filter(t => t.setup_grade === g);
           if (gt.length === 0) return '';
           const wins = gt.filter(t => t.result === 'WIN').length;
           const wr   = Math.round(wins / gt.length * 100);
           const pnl  = gt.reduce((s, t) => s + (Number(t.pnl) || 0), 0);
           const col  = gradeColors[g] || 'var(--gold)';
           return `
             <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--line);">
               <div style="width:36px;height:36px;border-radius:8px;background:${col};display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:16px;color:${g==='A'||g==='B'?'#000':'#fff'};flex-shrink:0;">${g}</div>
               <div style="flex:1;">
                 <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
                   <span style="font-size:12px;color:var(--text);font-weight:600;">${gt.length} trade${gt.length>1?'s':''}</span>
                   <span style="font-size:12px;color:${pnl>=0?'var(--win)':'var(--loss)'};">${fmtMoney(pnl)}</span>
                 </div>
                 <div style="background:var(--black-3);border-radius:4px;height:6px;overflow:hidden;">
                   <div style="width:${wr}%;height:100%;background:${col};border-radius:4px;transition:width 0.4s;"></div>
                 </div>
                 <div style="font-size:10px;color:var(--muted);margin-top:3px;">${wr}% win rate · ${wins}W / ${gt.length-wins}L</div>
               </div>
             </div>`;
         }).filter(Boolean).join('');
         gradeEl.innerHTML = rows || `<div style="color:var(--muted);font-size:13px;padding:16px 0;">No graded trades yet.</div>`;
       }
     }
   
     // ── TAG PNL IMPACT ──
     const tagEl = document.getElementById('tagBreakdown');
     if (tagEl) {
       const taggedTrades = state.trades.filter(t => t.tags);
   
       if (taggedTrades.length === 0) {
         tagEl.innerHTML = `<div style="color:var(--muted);font-size:13px;text-align:center;padding:24px 0;">No tagged trades yet.<br><span style="font-size:11px;">Add tags when logging trades.</span></div>`;
       } else {
         const tagStats = {};
         taggedTrades.forEach(t => {
           (t.tags || '').split(',').forEach(tag => {
             tag = tag.trim();
             if (!tag) return;
             if (!tagStats[tag]) tagStats[tag] = { total: 0, wins: 0, pnl: 0 };
             tagStats[tag].total++;
             if (t.result === 'WIN') tagStats[tag].wins++;
             tagStats[tag].pnl += Number(t.pnl) || 0;
           });
         });
   
         const sorted = Object.entries(tagStats).sort((a, b) => a[1].pnl - b[1].pnl);
         const maxAbs = Math.max(1, ...Object.values(tagStats).map(v => Math.abs(v.pnl)));
   
         tagEl.innerHTML = sorted.map(([tag, s]) => {
           const wr       = Math.round(s.wins / s.total * 100);
           const isNeg    = s.pnl < 0;
           const barWidth = Math.round(Math.abs(s.pnl) / maxAbs * 100);
           const barCol   = isNeg ? 'var(--loss)' : 'var(--win)';
           return `
             <div style="padding:10px 0;border-bottom:1px solid var(--line);">
               <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                 <span style="font-size:12px;font-weight:600;color:var(--text);">${tag}</span>
                 <div style="display:flex;gap:10px;align-items:center;">
                   <span style="font-size:11px;color:var(--muted);">${s.total} trades · ${wr}% WR</span>
                   <span style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:${isNeg?'var(--loss)':'var(--win)'};">${fmtMoney(s.pnl)}</span>
                 </div>
               </div>
               <div style="background:var(--black-3);border-radius:4px;height:5px;overflow:hidden;">
                 <div style="width:${barWidth}%;height:100%;background:${barCol};border-radius:4px;"></div>
               </div>
             </div>`;
         }).join('');
       }
     }
   }