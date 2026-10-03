import { useTacticalStore } from '../store/tacticalStore';

export function generateTelemetryCSV(): string {
  const state = useTacticalStore.getState();

  const escapeCell = (val: string | number | boolean | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows: string[][] = [
    // Header section: Session Info
    ['SECTION', 'KEY', 'VALUE', 'EXTRA1', 'EXTRA2', 'EXTRA3', 'EXTRA4', 'EXTRA5'],
    ['SESSION', 'Session Name', state.sessionName, 'Clock', state.missionClock, 'Role', state.userRole, ''],
    ['SESSION', 'Global Reliability', `${state.globalReliability}%`, 'Avg Latency', `${state.avgNetworkLatencyMs}ms`, 'Freshness', `${state.dataFreshnessIndex}%`, ''],
    ['SESSION', 'Total Transmissions', String(state.totalTransmissions), 'Dropped Packets', String(state.droppedCount), 'Active Links', String(state.activeLinksCount), ''],
    [],
    // Communications Matrix Section
    ['SECTION', 'FROM', 'TO', 'STATUS', 'LATENCY_MS', 'DELIVERED_PCT', 'FRESHNESS_PCT', 'NOTES'],
  ];

  const teams = ['HQ', 'ALPHA', 'BRAVO', 'CHARLIE'] as const;
  for (const from of teams) {
    for (const to of teams) {
      if (from === to) continue;
      const fromStat = state.radios[from];
      const toStat = state.radios[to];
      const isCut = fromStat === 'CUT' || toStat === 'CUT';
      const isDeg = fromStat === 'DEGRADED' || toStat === 'DEGRADED';
      const status = isCut ? 'SEVERED' : isDeg ? 'DEGRADED' : 'ONLINE';
      const latency = isCut ? 'TIMEOUT' : isDeg ? '184' : '22';
      const delivered = isCut ? '0%' : isDeg ? '71.6%' : '98.4%';
      const fresh = isCut ? '0%' : isDeg ? '42%' : '96%';
      rows.push(['MATRIX', from, to, status, latency, delivered, fresh, `RF Channel ${from}-${to}`]);
    }
  }

  rows.push([]);
  // Node Diagnostics Section
  rows.push(['SECTION', 'TEAM', 'LABEL', 'STATUS', 'PACKET_LOSS_PCT', 'PING_MS', 'HARDWARE_TEMP_C', 'SIGNAL_DBM']);
  for (const node of Object.values(state.nodeDiagnostics)) {
    rows.push([
      'NODE',
      node.team,
      node.label,
      node.status,
      String(node.packetLossPercent),
      String(node.latencyMs),
      String(node.hardwareTemp),
      String(node.signalStrengthDbm),
    ]);
  }

  rows.push([]);
  // Tactical Units Section
  rows.push(['SECTION', 'CALLSIGN', 'TEAM', 'TYPE', 'POS_X', 'POS_Y', 'UNCERTAINTY_RADIUS_PX', 'STALE']);
  for (const u of state.units) {
    rows.push([
      'UNIT',
      u.callsign,
      u.team,
      u.type,
      String(u.x),
      String(u.y),
      String(u.uncertaintyRadius),
      String(u.stale),
    ]);
  }

  rows.push([]);
  // Dispatch Messages Section
  rows.push(['SECTION', 'ID', 'TIMESTAMP', 'SENDER', 'RECEIVER', 'PRIORITY', 'STATUS', 'DELAY_S', 'FRESHNESS_PCT', 'CONFIDENCE_PCT', 'CONTENT']);
  for (const m of state.messages) {
    rows.push([
      'MESSAGE',
      m.id,
      m.timestamp,
      m.sender,
      m.receiver,
      m.priority,
      m.status,
      String(m.delaySeconds),
      String(m.freshnessPercent),
      String(m.confidencePercent),
      m.content,
    ]);
  }

  rows.push([]);
  // Decision Timeline Section
  rows.push(['SECTION', 'ID', 'TIMESTAMP', 'CATEGORY', 'TITLE', 'STATUS_BADGE', 'QUALITY_PCT', 'CRITICAL', 'DETAIL']);
  for (const t of state.aarTimeline) {
    rows.push([
      'TIMELINE',
      t.id,
      t.timestamp,
      t.category,
      t.title,
      t.statusBadge || 'NONE',
      t.infoQualityPercent !== undefined ? String(t.infoQualityPercent) : 'N/A',
      String(Boolean(t.isCritical)),
      t.detail,
    ]);
  }

  return rows
    .map((row) => (row.length === 0 ? '' : row.map(escapeCell).join(',')))
    .join('\r\n');
}

export function exportTelemetryCSV(): string {
  const csvContent = generateTelemetryCSV();

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PS248_TELEMETRY_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return csvContent;
}
