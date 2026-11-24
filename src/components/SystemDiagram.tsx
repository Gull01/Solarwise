import type { SystemType } from "@/lib/solar";

interface Props {
  systemType: SystemType;
  panelCount: number;
  systemKwp: number;
  inverterKw: number;
  batteryModules: number;
  batteryKwh: number;
  monthlyUsageKwh: number;
  monthlyProductionKwh: number;
  coveragePct: number;
  num: (n: number) => string;
  dec: (n: number) => string;
}

const MAX_PANELS_SHOWN = 21; // 7 columns × 3 rows
const MAX_CELLS_SHOWN = 8;

// Simple picture of the system: sun → panels → inverter → home, plus battery and grid.
// Panel and battery icons repeat to match the counts, and the energy lines animate.
export default function SystemDiagram(p: Props) {
  const hasBattery = p.systemType !== "on-grid";
  const hasGrid = p.systemType !== "off-grid";
  const producing = p.panelCount > 0;

  const overflow = p.panelCount > MAX_PANELS_SHOWN;
  const panelIcons = overflow ? MAX_PANELS_SHOWN - 1 : p.panelCount;
  const cells = Math.min(p.batteryModules, MAX_CELLS_SHOWN);

  const surplus = p.coveragePct >= 100;
  const gridText = !hasGrid ? "Not connected" : surplus ? "You sell extra" : "Fills the gap";

  return (
    <svg viewBox="0 0 480 320" className="h-auto w-full" role="img" aria-label={`${p.panelCount} solar panels feed a ${p.inverterKw} kilowatt inverter that powers your home`}>
      {/* Sun */}
      <g className="text-accent" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <circle cx="34" cy="32" r="12" fill="currentColor" stroke="none" />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          return <line key={i} x1={34 + Math.cos(a) * 17} y1={32 + Math.sin(a) * 17} x2={34 + Math.cos(a) * 23} y2={32 + Math.sin(a) * 23} />;
        })}
      </g>
      <text x="64" y="30" className="fill-muted text-[14px]">Sunlight</text>
      <text x="64" y="45" className="fill-foreground text-[14px] font-semibold">→ electricity</text>

      {/* Panels */}
      {Array.from({ length: panelIcons }, (_, i) => {
        const col = i % 7;
        const row = Math.floor(i / 7);
        return <PanelIcon key={i} x={18 + col * 26} y={66 + row * 36} />;
      })}
      {overflow && (
        <g>
          <rect x={18 + 6 * 26} y={66 + 2 * 36} width="22" height="32" rx="3" className="fill-sunken stroke-line" />
          <text x={18 + 6 * 26 + 11} y={66 + 2 * 36 + 20} textAnchor="middle" className="fill-foreground text-[11px] font-semibold">
            +{p.panelCount - panelIcons}
          </text>
        </g>
      )}
      {!producing && (
        <text x="100" y="125" textAnchor="middle" className="fill-muted text-[14px]">No panels</text>
      )}
      <Label
        x={100}
        y={66 + Math.max(1, Math.ceil((overflow ? MAX_PANELS_SHOWN : p.panelCount) / 7)) * 36 + 14}
        title={`${p.panelCount} panel${p.panelCount === 1 ? "" : "s"}`}
        sub={`${p.systemKwp.toFixed(2).replace(/\.?0+$/, "")} kW · ${p.num(p.monthlyProductionKwh)} kWh/mo`}
      />

      {/* Energy lines */}
      <Flow d="M202 118 H226" active={producing} />
      <Flow d="M296 118 H352" active={producing} />
      <Flow d="M261 146 V226" active={producing && hasBattery} dim={!hasBattery} />
      <Flow d="M296 132 H330 V262 H372" active={hasGrid} dim={!hasGrid} reverse={!surplus} />

      {/* Inverter */}
      <rect x="226" y="90" width="70" height="56" rx="8" className="fill-surface stroke-axis" strokeWidth="1.5" />
      <path d="M244 112 q6 -8 12 0 t12 0" fill="none" className="stroke-accent" strokeWidth="2" strokeLinecap="round" />
      <line x1="244" y1="126" x2="278" y2="126" className="stroke-axis" strokeWidth="2" strokeLinecap="round" />
      <Label x={261} y={68} title="Inverter" sub={`${p.dec(p.inverterKw)} kW`} above />

      {/* Home */}
      <g transform="translate(352 72)">
        <path d="M0 40 L44 4 L88 40" fill="none" className="stroke-foreground" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <rect x="10" y="36" width="68" height="52" className="fill-surface stroke-foreground" strokeWidth="2" />
        <rect x="20" y="48" width="16" height="14" rx="2" className={producing ? "fill-accent" : "fill-sunken"} />
        <rect x="52" y="48" width="16" height="14" rx="2" className={producing ? "fill-accent" : "fill-sunken"} />
        <rect x="37" y="66" width="14" height="22" className="fill-sunken" />
      </g>
      <Label x={396} y={182} title="Your home" sub={`Uses ${p.num(p.monthlyUsageKwh)} kWh/mo`} />
      <text x="396" y="214" textAnchor="middle" className="fill-positive text-[13px] font-semibold">
        Solar covers {Math.min(100, Math.round(p.coveragePct))}%
      </text>

      {/* Battery */}
      <g opacity={hasBattery ? 1 : 0.35}>
        <rect x="216" y="226" width="90" height="42" rx="6" className="fill-surface stroke-axis" strokeWidth="1.5" />
        <rect x="306" y="240" width="5" height="14" rx="1.5" className="fill-axis" />
        {cells > 0 &&
          Array.from({ length: cells }, (_, i) => {
            const inner = 90 - 10;
            const gap = 3;
            const w = (inner - gap * (cells - 1)) / cells;
            return <rect key={i} x={221 + i * (w + gap)} y="231" width={w} height="32" rx="2" className="fill-positive" />;
          })}
        {!hasBattery && (
          <text x="261" y="251" textAnchor="middle" className="fill-muted text-[13px]">None</text>
        )}
      </g>
      <Label
        x={261}
        y={286}
        title={hasBattery ? `Battery ${p.dec(p.batteryKwh)} kWh` : "No battery"}
        sub={hasBattery ? `${p.batteryModules} module${p.batteryModules === 1 ? "" : "s"} · stores for night` : "Not needed on-grid"}
        dim={!hasBattery}
      />

      {/* Grid */}
      <g transform="translate(374 232)" opacity={hasGrid ? 1 : 0.35} className="stroke-foreground" strokeWidth="2" strokeLinecap="round" fill="none">
        <path d="M22 0 L8 50 M22 0 L36 50 M12 34 H32 M15 22 H29 M2 10 H42" />
        {!hasGrid && <line x1="-2" y1="-2" x2="46" y2="52" className="stroke-negative" strokeWidth="2.5" />}
      </g>
      <Label x={396} y={300} title="Grid" sub={gridText} dim={!hasGrid} />
    </svg>
  );
}

function PanelIcon({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width="22" height="32" rx="2" className="fill-panel" />
      <path d="M7.3 0 V32 M14.6 0 V32 M0 8 H22 M0 16 H22 M0 24 H22" className="stroke-panel-line" strokeWidth="0.8" />
    </g>
  );
}

function Flow({ d, active, dim, reverse }: { d: string; active: boolean; dim?: boolean; reverse?: boolean }) {
  return (
    <g opacity={dim ? 0.25 : 1}>
      <path d={d} fill="none" className="stroke-line" strokeWidth="4" strokeLinecap="round" />
      {active && !dim && <path d={d} fill="none" className={`stroke-accent flow ${reverse ? "flow-reverse" : ""}`} strokeWidth="3" strokeLinecap="round" />}
    </g>
  );
}

function Label({ x, y, title, sub, above, dim }: { x: number; y: number; title: string; sub: string; above?: boolean; dim?: boolean }) {
  return (
    <g opacity={dim ? 0.6 : 1}>
      <text x={x} y={above ? y - 16 : y} textAnchor="middle" className="fill-foreground text-[14px] font-semibold">
        {title}
      </text>
      <text x={x} y={above ? y - 2 : y + 15} textAnchor="middle" className="fill-muted text-[13px]">
        {sub}
      </text>
    </g>
  );
}
