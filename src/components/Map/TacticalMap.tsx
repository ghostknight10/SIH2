import React, { useState } from 'react';
import { useTacticalStore } from '@/store/tacticalStore';
import type { TeamId } from '@/services/types';

interface TacticalMapProps {
  preview?: boolean;
  onExpand?: () => void;
  className?: string;
}

interface Waypoint {
  id: string;
  name: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  type: 'recon' | 'objective' | 'checkpoint' | 'rally';
}

const WAYPOINTS: Waypoint[] = [
  { id: 'wp-1', name: 'SEC-ALPHA (OP-44)', x: 30, y: 32, type: 'recon' },
  { id: 'wp-2', name: 'OBJ-BRAVO (CORRIDOR)', x: 68, y: 44, type: 'objective' },
  { id: 'wp-3', name: 'CP-CHARLIE (DEPOT)', x: 40, y: 76, type: 'checkpoint' },
  { id: 'wp-4', name: 'WAYPOINT ECHO', x: 78, y: 18, type: 'rally' },
];

export const TacticalMap: React.FC<TacticalMapProps> = ({
  preview = false,
  onExpand,
  className = '',
}) => {
  const {
    units,
    radios,
    selectedUnitId,
    setSelectedUnitId,
    setRadioStatus,
  } = useTacticalStore();

  const [showUncertainty, setShowUncertainty] = useState(true);
  const [showWaypoints, setShowWaypoints] = useState(true);
  const [showRfLinks, setShowRfLinks] = useState(true);
  const [showGrid, setShowGrid] = useState(true);

  const selectedUnit = units.find((u) => u.id === selectedUnitId);

  const getTeamStatus = (team: TeamId) => radios[team] || 'ONLINE';

  return (
    <div
      className={`relative border border-zinc-800/50 bg-[#09090b] rounded-sm overflow-hidden flex flex-col select-none ${className}`}
    >
      {/* Map Viewport Controls Header */}
      <div className="h-9 px-3 border-b border-zinc-800/50 bg-zinc-950/80 flex items-center justify-between text-xs font-mono shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase text-zinc-400 tracking-wider">
            {preview ? 'Tactical Map Preview' : 'Tactical Geolocation Viewport'}
          </span>
          <span className="text-zinc-700">|</span>
          <span className="text-[10px] text-zinc-500 tabular-nums">
            COORD: 34°14′22″N 118°32′10″W · GRID WGS-84
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Layer toggles for full-screen mode */}
          {!preview && (
            <div className="hidden sm:flex items-center gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => setShowUncertainty(!showUncertainty)}
                className={`px-2 py-0.5 rounded-sm border cursor-pointer ${
                  showUncertainty
                    ? 'border-zinc-700 bg-zinc-900 text-zinc-200'
                    : 'border-zinc-800 text-zinc-600 hover:text-zinc-400'
                }`}
              >
                Radii
              </button>
              <button
                type="button"
                onClick={() => setShowWaypoints(!showWaypoints)}
                className={`px-2 py-0.5 rounded-sm border cursor-pointer ${
                  showWaypoints
                    ? 'border-zinc-700 bg-zinc-900 text-zinc-200'
                    : 'border-zinc-800 text-zinc-600 hover:text-zinc-400'
                }`}
              >
                Waypoints
              </button>
              <button
                type="button"
                onClick={() => setShowRfLinks(!showRfLinks)}
                className={`px-2 py-0.5 rounded-sm border cursor-pointer ${
                  showRfLinks
                    ? 'border-zinc-700 bg-zinc-900 text-zinc-200'
                    : 'border-zinc-800 text-zinc-600 hover:text-zinc-400'
                }`}
              >
                RF Links
              </button>
              <button
                type="button"
                onClick={() => setShowGrid(!showGrid)}
                className={`px-2 py-0.5 rounded-sm border cursor-pointer ${
                  showGrid
                    ? 'border-zinc-700 bg-zinc-900 text-zinc-200'
                    : 'border-zinc-800 text-zinc-600 hover:text-zinc-400'
                }`}
              >
                Grid
              </button>
            </div>
          )}

          {preview && onExpand && (
            <button
              type="button"
              onClick={onExpand}
              className="px-2.5 py-0.5 text-[11px] font-mono border border-zinc-700 hover:border-zinc-600 bg-zinc-900 text-zinc-200 hover:text-zinc-100 rounded-sm cursor-pointer"
            >
              Full Map →
            </button>
          )}
        </div>
      </div>

      {/* Main Tactical SVG Canvas */}
      <div className="relative flex-1 min-h-[320px] bg-[#09090b] overflow-hidden">
        <svg
          viewBox="0 0 1000 600"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full"
        >
          {/* Defs for technical patterns */}
          <defs>
            <pattern
              id="tac-grid"
              width="50"
              height="50"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 50 0 L 0 0 0 50"
                fill="none"
                stroke="#18181b"
                strokeWidth="0.75"
              />
              <circle cx="0" cy="0" r="1" fill="#27272a" />
            </pattern>
            <pattern
              id="tac-major-grid"
              width="200"
              height="200"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 200 0 L 0 0 0 200"
                fill="none"
                stroke="#27272a"
                strokeWidth="1"
              />
            </pattern>
          </defs>

          {/* Background Technical Grid */}
          {showGrid && (
            <>
              <rect width="1000" height="600" fill="url(#tac-grid)" />
              <rect width="1000" height="600" fill="url(#tac-major-grid)" opacity="0.6" />
              {/* Coordinate markings */}
              <text x="12" y="24" fill="#52525b" fontSize="10" fontFamily="monospace">
                SEC-NORTH / 34°15'00"N
              </text>
              <text x="12" y="584" fill="#52525b" fontSize="10" fontFamily="monospace">
                BASE-SOUTH / 34°10'00"N
              </text>
              <text x="820" y="584" fill="#52525b" fontSize="10" fontFamily="monospace">
                EAST CORRIDOR 118°25'W
              </text>
            </>
          )}

          {/* Sector Boundary Lines */}
          <line
            x1="180"
            y1="0"
            x2="180"
            y2="600"
            stroke="#1f1f23"
            strokeWidth="1"
            strokeDasharray="6 4"
          />
          <line
            x1="620"
            y1="0"
            x2="620"
            y2="600"
            stroke="#1f1f23"
            strokeWidth="1"
            strokeDasharray="6 4"
          />
          <line
            x1="0"
            y1="380"
            x2="1000"
            y2="380"
            stroke="#1f1f23"
            strokeWidth="1"
            strokeDasharray="6 4"
          />

          {/* Waypoint Waypaths & Sector Waypoints */}
          {showWaypoints && (
            <>
              {/* Waypoint vector path */}
              <polyline
                points="220,444 300,192 680,264 780,108"
                fill="none"
                stroke="#27272a"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              {WAYPOINTS.map((wp) => {
                const wx = (wp.x / 100) * 1000;
                const wy = (wp.y / 100) * 600;
                return (
                  <g key={wp.id} className="cursor-default">
                    {/* Diamond waypoint marker */}
                    <rect
                      x={wx - 5}
                      y={wy - 5}
                      width="10"
                      height="10"
                      transform={`rotate(45 ${wx} ${wy})`}
                      fill="#09090b"
                      stroke="#52525b"
                      strokeWidth="1.5"
                    />
                    <text
                      x={wx + 10}
                      y={wy + 3}
                      fill="#71717a"
                      fontSize="9"
                      fontFamily="monospace"
                      letterSpacing="0.05em"
                    >
                      {wp.name}
                    </text>
                  </g>
                );
              })}
            </>
          )}

          {/* RF Links between friendly units */}
          {showRfLinks && (
            <>
              {(() => {
                const hq = units.find((u) => u.team === 'HQ' && u.type !== 'hostile');
                const alpha = units.find((u) => u.team === 'ALPHA' && u.type !== 'hostile');
                const bravo = units.find((u) => u.team === 'BRAVO' && u.type !== 'hostile');
                const charlie = units.find((u) => u.team === 'CHARLIE' && u.type !== 'hostile');

                if (!hq || !alpha || !bravo || !charlie) return null;

                const getLinkColor = (from: TeamId, to: TeamId) => {
                  const s1 = radios[from];
                  const s2 = radios[to];
                  if (s1 === 'CUT' || s2 === 'CUT') return { stroke: '#ef4444', dash: '3 3' };
                  if (s1 === 'DEGRADED' || s2 === 'DEGRADED') return { stroke: '#eab308', dash: '5 3' };
                  return { stroke: '#22c55e', dash: 'none' };
                };

                const linkHQAlpha = getLinkColor('HQ', 'ALPHA');
                const linkAlphaBravo = getLinkColor('ALPHA', 'BRAVO');
                const linkHQCharlie = getLinkColor('HQ', 'CHARLIE');

                return (
                  <g opacity="0.6">
                    {/* HQ <-> ALPHA */}
                    <line
                      x1={(hq.x / 100) * 1000}
                      y1={(hq.y / 100) * 600}
                      x2={(alpha.x / 100) * 1000}
                      y2={(alpha.y / 100) * 600}
                      stroke={linkHQAlpha.stroke}
                      strokeWidth="1.25"
                      strokeDasharray={linkHQAlpha.dash}
                    />
                    {/* ALPHA <-> BRAVO */}
                    <line
                      x1={(alpha.x / 100) * 1000}
                      y1={(alpha.y / 100) * 600}
                      x2={(bravo.x / 100) * 1000}
                      y2={(bravo.y / 100) * 600}
                      stroke={linkAlphaBravo.stroke}
                      strokeWidth="1.25"
                      strokeDasharray={linkAlphaBravo.dash}
                    />
                    {/* HQ <-> CHARLIE */}
                    <line
                      x1={(hq.x / 100) * 1000}
                      y1={(hq.y / 100) * 600}
                      x2={(charlie.x / 100) * 1000}
                      y2={(charlie.y / 100) * 600}
                      stroke={linkHQCharlie.stroke}
                      strokeWidth="1.25"
                      strokeDasharray={linkHQCharlie.dash}
                    />
                  </g>
                );
              })()}
            </>
          )}

          {/* Uncertainty Radii Circles (expand immediately when degraded/cut) */}
          {showUncertainty && (
            <g>
              {units.map((unit) => {
                const ux = (unit.x / 100) * 1000;
                const uy = (unit.y / 100) * 600;
                const status = unit.type === 'hostile' ? 'DEGRADED' : getTeamStatus(unit.team);
                const isCut = status === 'CUT';
                const isDegraded = status === 'DEGRADED';

                // Map uncertainty pixel radius to SVG viewbox scale (~2x)
                const radiusSvg = unit.uncertaintyRadius * 1.8;

                const strokeColor = isCut
                  ? '#ef4444'
                  : isDegraded
                  ? '#eab308'
                  : '#22c55e';

                const fillColor = isCut
                  ? 'rgba(239, 68, 68, 0.08)'
                  : isDegraded
                  ? 'rgba(234, 179, 8, 0.06)'
                  : 'rgba(34, 197, 94, 0.03)';

                const labelY = uy - radiusSvg - 5 < 16 ? uy + radiusSvg + 12 : uy - radiusSvg - 5;

                return (
                  <g key={`radius-${unit.id}`}>
                    <circle
                      cx={ux}
                      cy={uy}
                      r={radiusSvg}
                      fill={fillColor}
                      stroke={strokeColor}
                      strokeWidth={isCut ? '1.5' : '1'}
                      strokeDasharray={isCut ? '4 3' : isDegraded ? '5 4' : 'none'}
                    />
                    {/* Stale label if cut */}
                    {isCut && (
                      <text
                        x={ux - 44}
                        y={labelY}
                        fill="#ef4444"
                        fontSize="9"
                        fontFamily="monospace"
                        fontWeight="600"
                      >
                        [STALE POSITION ±{Math.round(unit.uncertaintyRadius * 3)}m]
                      </text>
                    )}
                    {isDegraded && (
                      <text
                        x={ux - 36}
                        y={labelY}
                        fill="#eab308"
                        fontSize="8.5"
                        fontFamily="monospace"
                      >
                        UNCERTAINTY ±{Math.round(unit.uncertaintyRadius * 2)}m
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          )}

          {/* Tracked Units Render */}
          {units.map((unit) => {
            const ux = (unit.x / 100) * 1000;
            const uy = (unit.y / 100) * 600;
            const status = unit.type === 'hostile' ? 'DEGRADED' : getTeamStatus(unit.team);
            const isSelected = selectedUnitId === unit.id;
            const isCut = status === 'CUT';
            const isDegraded = status === 'DEGRADED';

            const unitColor =
              unit.type === 'hostile'
                ? '#f87171'
                : isCut
                ? '#ef4444'
                : isDegraded
                ? '#facc15'
                : '#4ade80';

            return (
              <g
                key={unit.id}
                onClick={() => setSelectedUnitId(isSelected ? null : unit.id)}
                className="cursor-pointer"
              >
                {/* Selection indicator reticle */}
                {isSelected && (
                  <rect
                    x={ux - 16}
                    y={uy - 16}
                    width="32"
                    height="32"
                    fill="none"
                    stroke="#f5f5f5"
                    strokeWidth="1.25"
                    strokeDasharray="4 2"
                  />
                )}

                {/* Heading vector arrow (small 12px line from center) */}
                {unit.speedKmh > 0 && (
                  <line
                    x1={ux}
                    y1={uy}
                    x2={ux + 14 * Math.sin((unit.heading * Math.PI) / 180)}
                    y2={uy - 14 * Math.cos((unit.heading * Math.PI) / 180)}
                    stroke={unitColor}
                    strokeWidth="1.5"
                  />
                )}

                {/* Unit Icon Shape */}
                {unit.type === 'hq' ? (
                  // HQ Base square
                  <rect
                    x={ux - 8}
                    y={uy - 8}
                    width="16"
                    height="16"
                    fill="#09090b"
                    stroke={unitColor}
                    strokeWidth="2"
                  />
                ) : unit.type === 'hostile' ? (
                  // Hostile triangle
                  <polygon
                    points={`${ux},${uy - 9} ${ux + 8},${uy + 7} ${ux - 8},${uy + 7}`}
                    fill="#09090b"
                    stroke="#ef4444"
                    strokeWidth="2"
                  />
                ) : (
                  // Standard friendly unit circle
                  <circle
                    cx={ux}
                    cy={uy}
                    r="7"
                    fill="#09090b"
                    stroke={unitColor}
                    strokeWidth="2"
                  />
                )}

                {/* Center pip */}
                <circle cx={ux} cy={uy} r="2.5" fill={unitColor} />

                {/* Callsign label */}
                <text
                  x={ux + 12}
                  y={uy + 4}
                  fill={isSelected ? '#ffffff' : '#d4d4d8'}
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight={isSelected ? '600' : '400'}
                >
                  {unit.callsign}
                </text>

                {/* Speed / Status subtext */}
                <text
                  x={ux + 12}
                  y={uy + 15}
                  fill="#71717a"
                  fontSize="8.5"
                  fontFamily="monospace"
                >
                  {unit.type === 'hostile'
                    ? 'HOSTILE RADAR'
                    : `${unit.speedKmh}km/h · ${status}`}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Legend in corner */}
        <div className="absolute bottom-2 left-2 bg-zinc-950/90 border border-zinc-800/80 p-2 text-[10px] font-mono text-zinc-400 space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>ONLINE (UNCERTAINTY &lt;25m)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>DEGRADED (UNCERTAINTY ±60m)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>SEVERED (STALE FEED ±110m)</span>
          </div>
        </div>

        {/* Tactical scale bar */}
        <div className="absolute bottom-2 right-2 bg-zinc-950/90 border border-zinc-800/80 px-2 py-1 text-[10px] font-mono text-zinc-400">
          <div className="flex items-center gap-1.5">
            <div className="w-12 h-1 border-b border-l border-r border-zinc-500" />
            <span>1,000 METERS</span>
          </div>
        </div>
      </div>

      {/* Selected Unit Telemetry Drawer (for full screen view) */}
      {!preview && selectedUnit && (
        <div className="p-3 border-t border-zinc-800/50 bg-zinc-950 text-xs font-mono flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-zinc-500 text-[10px] block">CALLSIGN</span>
              <span className="font-semibold text-zinc-100">{selectedUnit.callsign}</span>
            </div>
            <div>
              <span className="text-zinc-500 text-[10px] block">COORDINATES</span>
              <span className="text-zinc-300 tabular-nums">
                X: {selectedUnit.x}% · Y: {selectedUnit.y}%
              </span>
            </div>
            <div>
              <span className="text-zinc-500 text-[10px] block">SPEED / HEADING</span>
              <span className="text-zinc-300 tabular-nums">
                {selectedUnit.speedKmh} km/h @ {selectedUnit.heading}°
              </span>
            </div>
            <div>
              <span className="text-zinc-500 text-[10px] block">UNCERTAINTY RADIUS</span>
              <span
                className={`tabular-nums ${
                  selectedUnit.uncertaintyRadius > 50 ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {selectedUnit.uncertaintyRadius}px (±{selectedUnit.uncertaintyRadius * 2}m)
              </span>
            </div>
          </div>

          {/* Quick radio state switch for selected unit */}
          {selectedUnit.type !== 'hostile' && selectedUnit.team ? (
            <div className="flex items-center gap-2">
              <span className="text-zinc-500 text-[10px]">RADIO LINK:</span>
              <div className="flex border border-zinc-800 rounded-sm bg-zinc-900/40 p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setRadioStatus(selectedUnit.team, 'ONLINE')}
                  className={`px-2 py-0.5 rounded-sm cursor-pointer transition-colors ${
                    getTeamStatus(selectedUnit.team) === 'ONLINE'
                      ? 'bg-emerald-900/60 text-emerald-300 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Online
                </button>
                <button
                  type="button"
                  onClick={() => setRadioStatus(selectedUnit.team, 'DEGRADED')}
                  className={`px-2 py-0.5 rounded-sm cursor-pointer transition-colors ${
                    getTeamStatus(selectedUnit.team) === 'DEGRADED'
                      ? 'bg-amber-900/60 text-amber-300 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Degraded
                </button>
                <button
                  type="button"
                  onClick={() => setRadioStatus(selectedUnit.team, 'CUT')}
                  className={`px-2 py-0.5 rounded-sm cursor-pointer transition-colors ${
                    getTeamStatus(selectedUnit.team) === 'CUT'
                      ? 'bg-red-900/60 text-red-300 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Severed
                </button>
              </div>
            </div>
          ) : selectedUnit.type === 'hostile' ? (
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-zinc-500 text-[10px]">CLASSIFICATION:</span>
              <span className="px-2 py-0.5 rounded-sm border border-red-900/60 bg-red-950/40 text-red-400 text-[11px] font-semibold">
                NON-FRIENDLY RADAR CONTACT
              </span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
