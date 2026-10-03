import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';

const jiti = createJiti(process.cwd() + '/test-loader.js', {
  alias: { '@': './src' },
});

const { useTacticalStore } = jiti('./src/store/tacticalStore.ts');
const { generateTelemetryCSV } = jiti('./src/services/csvExport.ts');

test('R1 & R2: Screen Navigation Toggling across all 5 screens', () => {
  const store = useTacticalStore.getState();
  
  const screens = ['live', 'map', 'comms', 'control', 'aar'];
  for (const s of screens) {
    store.setActiveTab(s);
    assert.equal(useTacticalStore.getState().activeTab, s);
  }
  
  // Return to live
  store.setActiveTab('live');
  assert.equal(useTacticalStore.getState().activeTab, 'live');
});

test('R2 & R3: Radio State Switches update metrics, node diagnostics, and uncertainty radii', () => {
  const store = useTacticalStore.getState();
  store.resetScenario();

  // Baseline
  assert.equal(useTacticalStore.getState().radios.ALPHA, 'ONLINE');
  assert.equal(useTacticalStore.getState().nodeDiagnostics.ALPHA.status, 'ONLINE');
  
  const alphaUnitBefore = useTacticalStore.getState().units.find(u => u.team === 'ALPHA' && u.type !== 'hostile');
  assert.equal(alphaUnitBefore?.uncertaintyRadius, 20);

  // 1. Degrade ALPHA
  store.setRadioStatus('ALPHA', 'DEGRADED');
  const degradedState = useTacticalStore.getState();
  assert.equal(degradedState.radios.ALPHA, 'DEGRADED');
  assert.equal(degradedState.nodeDiagnostics.ALPHA.status, 'DEGRADED');
  assert.equal(degradedState.nodeDiagnostics.ALPHA.packetLossPercent, 32);
  assert.equal(degradedState.nodeDiagnostics.ALPHA.latencyMs, 195);
  
  const alphaUnitDegraded = degradedState.units.find(u => u.team === 'ALPHA' && u.type !== 'hostile');
  assert.equal(alphaUnitDegraded?.uncertaintyRadius, 60);
  assert.equal(alphaUnitDegraded?.stale, true);

  // 2. Sever ALPHA
  store.setRadioStatus('ALPHA', 'CUT');
  const cutState = useTacticalStore.getState();
  assert.equal(cutState.radios.ALPHA, 'CUT');
  assert.equal(cutState.nodeDiagnostics.ALPHA.status, 'CUT');
  assert.equal(cutState.nodeDiagnostics.ALPHA.packetLossPercent, 100);
  assert.equal(cutState.nodeDiagnostics.ALPHA.latencyMs, 9999);
  
  const alphaUnitCut = cutState.units.find(u => u.team === 'ALPHA' && u.type !== 'hostile');
  assert.equal(alphaUnitCut?.uncertaintyRadius, 110);
  assert.equal(alphaUnitCut?.stale, true);

  // Hostile unit uncertainty radius must NOT be mutated by friendly team radio change
  const hostileUnit = cutState.units.find(u => u.type === 'hostile');
  assert.equal(hostileUnit?.uncertaintyRadius, 75);

  // 3. Restore ALPHA
  store.setRadioStatus('ALPHA', 'ONLINE');
  const restoredState = useTacticalStore.getState();
  assert.equal(restoredState.radios.ALPHA, 'ONLINE');
  assert.equal(restoredState.nodeDiagnostics.ALPHA.status, 'ONLINE');
  const alphaUnitRestored = restoredState.units.find(u => u.team === 'ALPHA' && u.type !== 'hostile');
  assert.equal(alphaUnitRestored?.uncertaintyRadius, 20);
});

test('R2: Rapid concurrent radio state perturbations across all teams', () => {
  const store = useTacticalStore.getState();
  store.resetScenario();

  const teams = ['HQ', 'ALPHA', 'BRAVO', 'CHARLIE'];
  const statuses = ['DEGRADED', 'CUT', 'ONLINE'];

  // Rapidly toggle each team multiple times
  for (let i = 0; i < 20; i++) {
    const t = teams[i % teams.length];
    const s = statuses[i % statuses.length];
    store.setRadioStatus(t, s);
    const current = useTacticalStore.getState();
    assert.equal(current.radios[t], s);
    const unit = current.units.find(u => u.team === t && u.type !== 'hostile');
    const expectedRadius = s === 'CUT' ? 110 : s === 'DEGRADED' ? 60 : 20;
    assert.equal(unit?.uncertaintyRadius, expectedRadius);
  }
});

test('R2: Message Transmission dropped when receiver OR sender is severed', () => {
  const store = useTacticalStore.getState();
  store.resetScenario();

  const initialDropped = useTacticalStore.getState().droppedCount;
  const initialTransmissions = useTacticalStore.getState().totalTransmissions;

  // 1. Normal delivery between online nodes
  store.sendMessage({
    sender: 'ALPHA',
    receiver: 'BRAVO',
    content: 'All clear on sector line.',
    priority: 'NORMAL',
    delaySeconds: 1.5,
    freshnessPercent: 95,
    confidencePercent: 95,
  });

  const state1 = useTacticalStore.getState();
  assert.equal(state1.messages[0].status, 'delivered');
  assert.equal(state1.totalTransmissions, initialTransmissions + 1);
  assert.equal(state1.droppedCount, initialDropped);

  // 2. Sever receiver (BRAVO)
  store.setRadioStatus('BRAVO', 'CUT');
  store.sendMessage({
    sender: 'ALPHA',
    receiver: 'BRAVO',
    content: 'Attempting contact with Bravo.',
    priority: 'URGENT',
    delaySeconds: 1.5,
    freshnessPercent: 95,
    confidencePercent: 95,
  });

  const state2 = useTacticalStore.getState();
  assert.equal(state2.messages[0].status, 'dropped');
  assert.equal(state2.messages[0].freshnessPercent, 0);
  assert.equal(state2.droppedCount, initialDropped + 1);

  // 3. Sever sender (HQ) and attempt to send to online node (ALPHA)
  store.setRadioStatus('BRAVO', 'ONLINE');
  store.setRadioStatus('HQ', 'CUT');
  store.sendMessage({
    sender: 'HQ',
    receiver: 'ALPHA',
    content: 'Directive from severed HQ.',
    priority: 'HIGH',
    delaySeconds: 2.0,
    freshnessPercent: 90,
    confidencePercent: 90,
  });

  const state3 = useTacticalStore.getState();
  assert.equal(state3.messages[0].status, 'dropped');
  assert.equal(state3.droppedCount, initialDropped + 2);

  // 4. Degraded link adds latency and reduces freshness
  store.setRadioStatus('HQ', 'ONLINE');
  store.setRadioStatus('ALPHA', 'DEGRADED');
  store.sendMessage({
    sender: 'HQ',
    receiver: 'ALPHA',
    content: 'Degraded link message payload.',
    priority: 'NORMAL',
    delaySeconds: 2.0,
    freshnessPercent: 90,
    confidencePercent: 90,
  });

  const state4 = useTacticalStore.getState();
  assert.equal(state4.messages[0].status, 'delivered');
  assert.ok(state4.messages[0].delaySeconds > 2.0, 'Delay must be increased for degraded link');
  assert.ok(state4.messages[0].freshnessPercent < 90, 'Freshness must be reduced for degraded link');
});

test('R2: Adversarial False Intel Injector applies conflict probability weighting', () => {
  const store = useTacticalStore.getState();
  store.resetScenario();

  store.injectConflictingIntel('BRAVO', 'False retreat directive bearing 180.', 90);

  const state = useTacticalStore.getState();
  const latestMsg = state.messages[0];
  assert.equal(latestMsg.isConflicted, true);
  assert.equal(latestMsg.isFake, true);
  assert.equal(latestMsg.confidencePercent, 10); // 100 - 90
  assert.ok(state.dataFreshnessIndex <= 42);

  const latestTimeline = state.aarTimeline[0];
  assert.equal(latestTimeline.category, 'conflict');
  assert.equal(latestTimeline.statusBadge, 'INJECTED ANOMALY');
  assert.equal(latestTimeline.isCritical, true);
});

test('R2 & Acceptance Criteria: CSV Export produces valid RFC 4180 telemetry bundle', () => {
  const store = useTacticalStore.getState();
  store.resetScenario();

  const csv = generateTelemetryCSV();
  assert.ok(typeof csv === 'string' && csv.length > 500);

  // Check required sections
  assert.ok(csv.includes('"SECTION","KEY","VALUE"'), 'Missing session header');
  assert.ok(csv.includes('"SESSION","Session Name","OP: AMBUSH NORTH"'));
  assert.ok(csv.includes('"SECTION","FROM","TO","STATUS","LATENCY_MS"'), 'Missing matrix header');
  assert.ok(csv.includes('"SECTION","TEAM","LABEL","STATUS"'), 'Missing node diagnostics header');
  assert.ok(csv.includes('"SECTION","CALLSIGN","TEAM","TYPE"'), 'Missing units header');
  assert.ok(csv.includes('"SECTION","ID","TIMESTAMP","SENDER","RECEIVER"'), 'Missing message header');
  assert.ok(csv.includes('"SECTION","ID","TIMESTAMP","CATEGORY","TITLE"'), 'Missing timeline header');

  // Verify matrix lines: 4 teams * 3 other teams = 12 directed link rows
  const matrixLines = csv.split('\r\n').filter(line => line.startsWith('"MATRIX"'));
  assert.equal(matrixLines.length, 12, 'Must have exactly 12 matrix links for 4 nodes');
});

test('R2: Comms search query matches severed, degraded, online, and status filters', () => {
  const teams = ['HQ', 'ALPHA', 'BRAVO', 'CHARLIE'];
  const matrixRows = [];

  for (const from of teams) {
    for (const to of teams) {
      if (from === to) continue;
      const status = from === 'CHARLIE' ? 'CUT' : from === 'BRAVO' ? 'DEGRADED' : 'ONLINE';
      matrixRows.push({ from, to, status });
    }
  }

  // Filter for severed
  const filterSevered = (query) => {
    return matrixRows.filter((r) => {
      const isCutMatch = r.status === 'CUT' && ('severed'.includes(query) || query === 'cut');
      return r.status.toLowerCase().includes(query) || isCutMatch;
    });
  };

  const severedResults = filterSevered('severed');
  assert.ok(severedResults.length > 0, 'Searching severed must return rows');
  assert.ok(severedResults.every(r => r.status === 'CUT'), 'All matched rows must be CUT');

  const cutResults = filterSevered('cut');
  assert.ok(cutResults.length > 0, 'Searching cut must return rows');

  // Filter messages by status
  const messages = [
    { content: 'Alpha check in', status: 'delivered', sender: 'ALPHA', receiver: 'HQ', priority: 'NORMAL' },
    { content: 'Bravo lost contact', status: 'dropped', sender: 'HQ', receiver: 'BRAVO', priority: 'URGENT' },
  ];

  const filterMessages = (query) => {
    return messages.filter(m => 
      m.content.toLowerCase().includes(query) ||
      m.sender.toLowerCase().includes(query) ||
      m.receiver.toLowerCase().includes(query) ||
      m.priority.toLowerCase().includes(query) ||
      m.status.toLowerCase().includes(query)
    );
  };

  assert.equal(filterMessages('dropped').length, 1);
  assert.equal(filterMessages('delivered').length, 1);
});

test('R2: Scenario Reset restores all telemetry to baseline', () => {
  const store = useTacticalStore.getState();
  
  // Mutate state
  store.setRadioStatus('ALPHA', 'CUT');
  store.setRadioStatus('HQ', 'CUT');
  store.setActiveTab('aar');

  // Reset
  store.resetScenario();
  const resetState = useTacticalStore.getState();

  assert.equal(resetState.radios.ALPHA, 'ONLINE');
  assert.equal(resetState.radios.HQ, 'ONLINE');
  assert.equal(resetState.radios.CHARLIE, 'DEGRADED');
  assert.equal(resetState.globalReliability, 93.6);
  assert.equal(resetState.avgNetworkLatencyMs, 46);
  assert.equal(resetState.dataFreshnessIndex, 82);
  assert.equal(resetState.totalTransmissions, 18);
  assert.equal(resetState.droppedCount, 2);
  assert.equal(resetState.missionClock, '14:32:05');
  assert.equal(resetState.clockSeconds, 872);
});

test('R1 & R2: Session clock progresses forward without jumping backward', () => {
  const store = useTacticalStore.getState();
  store.resetScenario();

  assert.equal(useTacticalStore.getState().missionClock, '14:32:05');
  assert.equal(useTacticalStore.getState().clockSeconds, 872);

  store.tickClock();
  assert.equal(useTacticalStore.getState().missionClock, '14:32:06');
  assert.equal(useTacticalStore.getState().clockSeconds, 873);

  store.tickClock();
  assert.equal(useTacticalStore.getState().missionClock, '14:32:07');
  assert.equal(useTacticalStore.getState().clockSeconds, 874);

  store.tickClock();
  assert.equal(useTacticalStore.getState().missionClock, '14:32:08');
  assert.equal(useTacticalStore.getState().clockSeconds, 875);
});

test('R2: Background clock ticks preserve false intel freshness degradation', () => {
  const store = useTacticalStore.getState();
  store.resetScenario();

  // Inject false intel with 90% conflict probability
  store.injectConflictingIntel('BRAVO', 'False flank clearance.', 90);
  const freshnessAfterInject = useTacticalStore.getState().dataFreshnessIndex;
  assert.ok(freshnessAfterInject <= 42, `Expected freshness <= 42, got ${freshnessAfterInject}`);

  // Run 6 clock ticks (crossing the % 3 === 0 auto-refresh threshold twice)
  for (let i = 0; i < 6; i++) {
    store.tickClock();
  }

  const freshnessAfterTicks = useTacticalStore.getState().dataFreshnessIndex;
  assert.ok(
    freshnessAfterTicks <= 45,
    `Freshness must remain degraded under active conflict, expected <= 45, got ${freshnessAfterTicks}`
  );
});

test('R2: Unique IDs guaranteed on rapid concurrent actions', () => {
  const store = useTacticalStore.getState();
  store.resetScenario();

  const generatedIds = new Set();

  for (let i = 0; i < 15; i++) {
    store.sendMessage({
      sender: 'ALPHA',
      receiver: 'BRAVO',
      content: `Rapid ping #${i}`,
      priority: 'NORMAL',
      delaySeconds: 1.0,
      freshnessPercent: 95,
      confidencePercent: 95,
    });
    const latestMsg = useTacticalStore.getState().messages[0];
    assert.ok(!generatedIds.has(latestMsg.id), `Duplicate message ID found: ${latestMsg.id}`);
    generatedIds.add(latestMsg.id);
  }
});

test('R2 & Acceptance Criteria: exportTelemetryCSV returns valid RFC 4180 CSV safely in Node', () => {
  const store = useTacticalStore.getState();
  store.resetScenario();

  const { exportTelemetryCSV } = jiti('./src/services/csvExport.ts');
  const csv = exportTelemetryCSV();
  assert.ok(typeof csv === 'string' && csv.length > 500);
  assert.ok(csv.includes('"SECTION","KEY","VALUE"'));
  assert.ok(csv.includes('"MATRIX","HQ","ALPHA","ONLINE","22","98.4%","96%"'));
});

test('R1 & R2: Session clock wraps smoothly past 24:00:00 without producing hour 24', () => {
  const store = useTacticalStore.getState();
  store.resetScenario();

  // Set clockSeconds near 23:59:59:
  // Base totalSec = 51453 + clockSeconds.
  // 86399 - 51453 = 34946
  useTacticalStore.setState({ clockSeconds: 34945 }); // totalSec = 86398 -> 23:59:58
  store.tickClock(); // 34946 -> totalSec = 86399 -> 23:59:59
  assert.equal(useTacticalStore.getState().missionClock, '23:59:59');

  store.tickClock(); // 34947 -> totalSec = 86400 -> 00:00:00
  assert.equal(useTacticalStore.getState().missionClock, '00:00:00');

  store.tickClock(); // 34948 -> totalSec = 86401 -> 00:00:01
  assert.equal(useTacticalStore.getState().missionClock, '00:00:01');
});

test('R2: Loopback transmission to self is rejected', () => {
  const store = useTacticalStore.getState();
  store.resetScenario();

  const initialCount = useTacticalStore.getState().totalTransmissions;
  const initialMsgCount = useTacticalStore.getState().messages.length;

  store.sendMessage({
    sender: 'ALPHA',
    receiver: 'ALPHA',
    content: 'Loopback message test',
    priority: 'NORMAL',
    delaySeconds: 1.0,
    freshnessPercent: 95,
    confidencePercent: 95,
  });

  assert.equal(useTacticalStore.getState().totalTransmissions, initialCount);
  assert.equal(useTacticalStore.getState().messages.length, initialMsgCount);
});

test('R2: Radio status toggling preserves active false intel degradation', () => {
  const store = useTacticalStore.getState();
  store.resetScenario();

  // Inject false intel with 90% conflict probability
  store.injectConflictingIntel('BRAVO', 'Ambush alert east corridor', 90);
  const freshnessAfterInject = useTacticalStore.getState().dataFreshnessIndex;
  assert.ok(freshnessAfterInject <= 35, `Expected freshness <= 35, got ${freshnessAfterInject}`);

  // Toggle ALPHA radio to DEGRADED
  store.setRadioStatus('ALPHA', 'DEGRADED');
  const freshnessAfterToggle = useTacticalStore.getState().dataFreshnessIndex;
  assert.ok(
    freshnessAfterToggle <= 35,
    `Freshness must remain degraded under active conflict, expected <= 35, got ${freshnessAfterToggle}`
  );

  // Restore ALPHA radio to ONLINE
  store.setRadioStatus('ALPHA', 'ONLINE');
  const freshnessAfterRestore = useTacticalStore.getState().dataFreshnessIndex;
  assert.ok(
    freshnessAfterRestore <= 35,
    `Freshness must not bounce back to normal while false intel is active, expected <= 35, got ${freshnessAfterRestore}`
  );
});

test('R1 & R2: Timeline initial entries use consistent 14:xx:xx format matching clock', () => {
  const store = useTacticalStore.getState();
  store.resetScenario();

  const timeline = useTacticalStore.getState().aarTimeline;
  for (const item of timeline) {
    assert.match(item.timestamp, /^14:\d{2}/, `Timeline timestamp ${item.timestamp} must be 14:xx format`);
  }
});
