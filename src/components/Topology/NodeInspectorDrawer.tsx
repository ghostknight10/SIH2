import React from 'react';
import { Cross2Icon, CheckIcon, ExclamationTriangleIcon, LightningBoltIcon } from '@radix-ui/react-icons';
import { useTacticalStore } from '@/store/tacticalStore';

interface NodeInspectorDrawerProps {
  onClose?: () => void;
}

export const NodeInspectorDrawer: React.FC<NodeInspectorDrawerProps> = ({ onClose }) => {
  const {
    selectedNodeId,
    setSelectedNodeId,
    nodeDiagnostics,
    setRadioStatus,
    userRole,
  } = useTacticalStore();

  if (!selectedNodeId) return null;

  const node = nodeDiagnostics[selectedNodeId];
  if (!node) return null;

  const isDegraded = node.status === 'DEGRADED';
  const isCut = node.status === 'CUT';

  const rows = [
    { label: 'NODE IDENT', value: node.team },
    { label: 'CALLSIGN', value: node.label },
    { label: 'OPERATIONAL ROLE', value: node.role },
    {
      label: 'RADIO LINK STATUS',
      value: (
        <span
          className={`inline-flex items-center space-x-1.5 font-semibold ${
            isCut ? 'text-rose-400' : isDegraded ? 'text-amber-400' : 'text-emerald-400'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-none ${
              isCut ? 'bg-rose-500' : isDegraded ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
          />
          <span>{node.status}</span>
        </span>
      ),
    },
    {
      label: 'PACKET LOSS',
      value: `${node.packetLossPercent}%`,
      highlight: isCut || isDegraded,
    },
    {
      label: 'ROUND-TRIP PING',
      value: isCut ? 'TIMEOUT' : `${node.latencyMs} ms`,
      highlight: isCut,
    },
    { label: 'SIGNAL RSSI', value: `${node.signalStrengthDbm} dBm` },
    { label: 'HARDWARE TEMP', value: `${node.hardwareTemp}°C` },
    { label: 'TX PACKETS SENT', value: node.packetsSent.toLocaleString() },
    { label: 'RX PACKETS RECV', value: node.packetsReceived.toLocaleString() },
    { label: 'LAST CONTACT', value: node.lastContact },
  ];

  return (
    <div className="w-full lg:w-80 border border-zinc-800 bg-[#0c0c0e] rounded-none flex flex-col font-mono text-xs">
      {/* Drawer Header */}
      <div className="p-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-950">
        <div className="flex items-center space-x-2">
          <span
            className={`w-2 h-2 rounded-none ${
              isCut ? 'bg-rose-500' : isDegraded ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
          />
          <span className="font-semibold text-zinc-100 tracking-wide">
            NODE INSPECTOR: {node.team}
          </span>
        </div>
        <button
          onClick={() => {
            setSelectedNodeId(null);
            onClose?.();
          }}
          className="text-zinc-500 hover:text-zinc-100 p-1 rounded-none transition-none cursor-pointer hover:bg-zinc-800"
          title="Close Inspector"
        >
          <Cross2Icon className="w-4 h-4" />
        </button>
      </div>

      {/* Zebra-Striped Terminal Ledger Table */}
      <div className="overflow-x-auto flex-1 p-2">
        <table className="w-full text-left border-collapse text-[11px]">
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={i}
                className="border-b border-zinc-800 even:bg-zinc-900/20 hover:bg-zinc-800/40 transition-none"
              >
                <td className="py-1.5 px-2 text-zinc-500 whitespace-nowrap">
                  {r.label}
                </td>
                <td
                  className={`py-1.5 px-2 text-right font-mono tabular-nums text-zinc-200 ${
                    r.highlight ? 'text-rose-400 font-semibold' : ''
                  }`}
                >
                  {r.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Telemetry Actions (Instructor Role) */}
        {userRole === 'instructor' && (
          <div className="mt-3 pt-3 border-t border-zinc-800 space-y-2">
            <div className="text-[10px] uppercase text-zinc-500 font-semibold tracking-wider px-1">
              CHANNEL COMMANDS
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setRadioStatus(node.team, 'ONLINE')}
                className="px-2 py-1.5 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-100 hover:text-zinc-950 rounded-none transition-none text-[10px] font-mono cursor-pointer flex items-center justify-center space-x-1"
              >
                <CheckIcon className="w-3 h-3 text-emerald-500" />
                <span>ONLINE</span>
              </button>
              <button
                type="button"
                onClick={() => setRadioStatus(node.team, 'DEGRADED')}
                className="px-2 py-1.5 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-100 hover:text-zinc-950 rounded-none transition-none text-[10px] font-mono cursor-pointer flex items-center justify-center space-x-1"
              >
                <ExclamationTriangleIcon className="w-3 h-3 text-amber-500" />
                <span>DEGRADE</span>
              </button>
              <button
                type="button"
                onClick={() => setRadioStatus(node.team, 'CUT')}
                className="px-2 py-1.5 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-100 hover:text-zinc-950 rounded-none transition-none text-[10px] font-mono cursor-pointer flex items-center justify-center space-x-1"
              >
                <LightningBoltIcon className="w-3 h-3 text-rose-500" />
                <span>SEVER</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Status Bar */}
      <div className="p-2 border-t border-zinc-800 bg-zinc-950 text-[10px] text-zinc-500 flex justify-between">
        <span>RF BAND: UHF 433MHz</span>
        <span className="tabular-nums">JITTER &lt;3ms</span>
      </div>
    </div>
  );
};
