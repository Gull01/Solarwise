"use client";

import { useMemo, useState, type ReactNode } from "react";
import CashflowChart from "@/components/CashflowChart";
import SystemDiagram from "@/components/SystemDiagram";
import {
  CURRENCIES,
  DEFAULT_INPUTS,
  LOCATIONS,
  calculateSolar,
  type SolarInputs,
  type SystemType,
} from "@/lib/solar";

// Required numeric fields only (the optional *Override fields are excluded).
type NumericKey = { [K in keyof SolarInputs]-?: SolarInputs[K] extends number ? K : never }[keyof SolarInputs];
type TextInputs = Record<NumericKey, string>;

const toText = (i: SolarInputs): TextInputs =>
  Object.fromEntries(
    Object.entries(i).filter(([, v]) => typeof v === "number").map(([k, v]) => [k, String(v)]),
  ) as TextInputs;

// Plain-language names for the three system types.
const SYSTEM_TYPES: { id: SystemType; label: string }[] = [
  { id: "on-grid", label: "No" },
  { id: "hybrid", label: "Yes, backup" },
  { id: "off-grid", label: "I have no grid" },
];

export default function SolarCalculator() {
  const [text, setText] = useState<TextInputs>(() => toText(DEFAULT_INPUTS));
  const [systemType, setSystemType] = useState<SystemType>(DEFAULT_INPUTS.systemType);
  const [currency, setCurrency] = useState(CURRENCIES[0].code);
  const [location, setLocation] = useState("custom");
  const [usageMode, setUsageMode] = useState<"kwh" | "bill">("kwh");
  const [billText, setBillText] = useState("100");
  const [showOptions, setShowOptions] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const set = (key: NumericKey) => (v: string) => setText((t) => ({ ...t, [key]: v }));

  const inputs: SolarInputs = useMemo(() => {
    const parsed = Object.fromEntries(
      Object.entries(text).map(([k, v]) => [k, Number.parseFloat(v) || 0]),
    ) as Record<NumericKey, number>;
    const monthlyKwh =
      usageMode === "bill" ? (parsed.tariff > 0 ? (Number.parseFloat(billText) || 0) / parsed.tariff : 0) : parsed.monthlyKwh;
    return { ...parsed, monthlyKwh, systemType };
  }, [text, systemType, usageMode, billText]);

  // Manual panel/battery counts apply only to the sizing inputs they were chosen for;
  // changing usage, location, system type etc. returns to the recommendation.
  const sizingKey = [
    inputs.monthlyKwh, inputs.peakSunHours, systemType, inputs.offsetPct, inputs.panelWatt, inputs.performanceRatio,
    inputs.backupHours, inputs.essentialLoadKw, inputs.autonomyDays, inputs.batteryDoDPct, inputs.batteryModuleKwh,
  ].join("|");
  const [custom, setCustom] = useState<{ key: string; panels?: number; modules?: number }>({ key: "" });
  const active = custom.key === sizingKey ? custom : { panels: undefined, modules: undefined };

  const r = useMemo(
    () => calculateSolar({ ...inputs, panelCountOverride: active.panels, batteryModulesOverride: active.modules }),
    [inputs, active.panels, active.modules],
  );
  const customized = r.panelCount !== r.recommendedPanels || r.batteryModules !== r.recommendedBatteryModules;

  const setPanels = (n: number) => setCustom({ key: sizingKey, panels: Math.max(0, Math.min(500, n)), modules: active.modules });
  const setModules = (n: number) => setCustom({ key: sizingKey, panels: active.panels, modules: Math.max(0, Math.min(100, n)) });

  const fmt = useMemo(() => {
    const money = new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 });
    const compact = new Intl.NumberFormat("en", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 });
    const num = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });
    const dec = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
    const kw = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });
    return {
      money: (n: number) => money.format(n),
      compact: (n: number) => compact.format(n),
      num: (n: number) => num.format(n),
      dec: (n: number) => dec.format(n),
      kw: (n: number) => kw.format(n),
    };
  }, [currency]);

  const symbol = CURRENCIES.find((c) => c.code === currency)?.symbol ?? currency;

  function changeCurrency(code: string) {
    const c = CURRENCIES.find((x) => x.code === code);
    if (!c) return;
    setCurrency(code);
    setText((t) => ({
      ...t,
      tariff: String(c.tariff),
      exportRate: String(c.exportRate),
      costPerWatt: String(c.costPerWatt),
      batteryCostPerKwh: String(c.batteryCostPerKwh),
    }));
  }

  function changeLocation(name: string) {
    setLocation(name);
    const loc = LOCATIONS.find((l) => l.name === name);
    set("peakSunHours")(String(loc ? loc.psh : DEFAULT_INPUTS.peakSunHours));
  }

  const hasBattery = systemType !== "on-grid";
  const tooSmall = inputs.monthlyKwh <= 0 || inputs.peakSunHours <= 0;
  const paysBack = r.paybackYears !== null;

  // What one more panel / battery module changes.
  const perPanelKwhMonth = (inputs.panelWatt / 1000) * inputs.peakSunHours * inputs.performanceRatio * (365 / 12);
  const perPanelRate = r.coveragePct < 100 ? inputs.tariff : systemType === "off-grid" ? 0 : inputs.exportRate;
  const perPanelSavingMonth = perPanelKwhMonth * perPanelRate;
  const perPanelCost = inputs.panelWatt * inputs.costPerWatt;
  const batteryUsableKwh = r.batteryNominalKwh * (Math.min(inputs.batteryDoDPct, 100) / 100) * 0.95;
  const backupHours = inputs.essentialLoadKw > 0 ? batteryUsableKwh / inputs.essentialLoadKw : 0;
  const dailyUseKwh = inputs.monthlyKwh / (365 / 12);
  const nightsCovered = dailyUseKwh > 0 ? batteryUsableKwh / dailyUseKwh : 0;
  const perModuleCost = inputs.batteryModuleKwh * inputs.batteryCostPerKwh;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
      {/* ---------- Inputs: three questions, everything else tucked away ---------- */}
      <form className="space-y-4 lg:sticky lg:top-6" onSubmit={(e) => e.preventDefault()}>
        <div className="border-line bg-surface space-y-6 rounded-xl border p-5 shadow-sm">
          <Question n={1} title="How much electricity do you use?">
            <Segmented
              value={usageMode}
              onChange={(v) => setUsageMode(v as "kwh" | "bill")}
              options={[
                { id: "kwh", label: "Units (kWh)" },
                { id: "bill", label: "Bill amount" },
              ]}
            />
            {usageMode === "kwh" ? (
              <NumberField label="Per month" unit="kWh" value={text.monthlyKwh} onChange={set("monthlyKwh")} step={10} hint="Shown on your electricity bill." />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Bill per month" unit={symbol} value={billText} onChange={setBillText} step={5} />
                <NumberField label="Price per unit" unit={`${symbol}/kWh`} value={text.tariff} onChange={set("tariff")} step={0.01} />
              </div>
            )}
          </Question>

          <Question n={2} title="Where do you live?">
            <select className="input" value={location} onChange={(e) => changeLocation(e.target.value)} aria-label="City">
              <option value="custom">Somewhere else (average sun)</option>
              {LOCATIONS.map((l) => (
                <option key={l.name} value={l.name}>
                  {l.name}
                </option>
              ))}
            </select>
          </Question>

          <Question n={3} title="Do you want power during outages?">
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Backup power">
              {SYSTEM_TYPES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={systemType === s.id}
                  onClick={() => setSystemType(s.id)}
                  className={`rounded-lg border px-2 py-2 text-sm font-medium transition ${
                    systemType === s.id ? "border-accent bg-accent-soft text-accent-strong" : "border-line hover:border-accent/60"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </Question>
        </div>

        <div className="border-line rounded-xl border">
          <button type="button" onClick={() => setShowOptions((s) => !s)} className="flex w-full items-center justify-between px-5 py-3 text-sm font-medium" aria-expanded={showOptions}>
            <span>
              More options <span className="text-muted font-normal">(prices, panels, battery)</span>
            </span>
            <span className={`text-muted transition ${showOptions ? "rotate-180" : ""}`}>▾</span>
          </button>
          {showOptions && (
            <div className="grid grid-cols-2 gap-3 px-5 pb-5">
              <Field label="Currency">
                <select className="input" value={currency} onChange={(e) => changeCurrency(e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </Field>
              {usageMode === "kwh" && <NumberField label="Price per unit" unit={`${symbol}/kWh`} value={text.tariff} onChange={set("tariff")} step={0.01} />}
              <NumberField label="Installed cost" unit={`${symbol}/W`} value={text.costPerWatt} onChange={set("costPerWatt")} step={0.1} />
              {hasBattery && <NumberField label="Battery cost" unit={`${symbol}/kWh`} value={text.batteryCostPerKwh} onChange={set("batteryCostPerKwh")} step={10} />}
              {systemType !== "off-grid" && <NumberField label="Export price" unit={`${symbol}/kWh`} value={text.exportRate} onChange={set("exportRate")} step={0.01} />}
              <NumberField label="Panel size" unit="W" value={text.panelWatt} onChange={set("panelWatt")} step={5} />
              {systemType !== "off-grid" && <NumberField label="Cover my usage" unit="%" value={text.offsetPct} onChange={set("offsetPct")} step={5} />}
              {systemType === "hybrid" && (
                <>
                  <NumberField label="Backup load" unit="kW" value={text.essentialLoadKw} onChange={set("essentialLoadKw")} step={0.1} />
                  <NumberField label="Backup time" unit="hours" value={text.backupHours} onChange={set("backupHours")} step={0.5} />
                </>
              )}
              {systemType === "off-grid" && <NumberField label="Cloudy days covered" unit="days" value={text.autonomyDays} onChange={set("autonomyDays")} step={0.5} />}
              <NumberField
                label="Sun hours per day"
                unit="h"
                value={text.peakSunHours}
                onChange={(v) => {
                  setLocation("custom");
                  set("peakSunHours")(v);
                }}
                step={0.1}
              />
              <NumberField label="Price rise" unit="%/yr" value={text.tariffEscalationPct} onChange={set("tariffEscalationPct")} step={0.5} />
              <p className="text-muted col-span-2 text-xs">Prices are rough {currency} defaults. Use quotes from local installers for an accurate result.</p>
            </div>
          )}
        </div>
      </form>

      {/* ---------- Results: one headline, three numbers, details on demand ---------- */}
      <section className="min-w-0 space-y-4" aria-live="polite">
        {tooSmall ? (
          <div className="border-line text-muted rounded-xl border border-dashed p-10 text-center">Enter how much electricity you use to see your result.</div>
        ) : (
          <>
            <div className="border-accent bg-accent-soft rounded-xl border p-6 shadow-sm">
              <div className="text-muted text-sm font-medium">{customized ? "Your custom system" : "You need"}</div>
              <div className="text-accent-strong mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">
                {r.panelCount} solar panel{r.panelCount === 1 ? "" : "s"}
              </div>
              {customized && (
                <div className="text-muted mt-1 text-sm">
                  We recommend {r.recommendedPanels} panels{hasBattery && ` and ${r.recommendedBatteryModules} battery modules`}.
                </div>
              )}
              <p className="mt-3 text-base">
                A <b>{fmt.kw(r.systemKwp)} kW</b> system with a <b>{fmt.dec(r.inverterKw)} kW</b> inverter
                {hasBattery && (
                  <>
                    {" "}
                    and a <b>{fmt.dec(r.batteryNominalKwh)} kWh</b> battery
                  </>
                )}
                . It needs about <b>{fmt.num(r.roofAreaM2)} m²</b> of roof.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Kpi label="Cost" value={fmt.money(r.totalCost)} sub="Approximate, installed" />
              <Kpi label="You save" value={`${fmt.money(r.firstYearSavings / 12)}`} sub="per month" tone="positive" />
              <Kpi
                label="Pays for itself in"
                value={paysBack ? `${fmt.dec(r.paybackYears!)} years` : `> ${inputs.years} years`}
                sub={paysBack ? `${fmt.compact(r.netProfit)} profit over ${inputs.years} yrs` : "Lower costs to break even"}
                tone={paysBack ? "positive" : "negative"}
              />
            </div>

            <div className="border-line bg-surface space-y-4 rounded-xl border p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold">How your system works</h2>
                {customized && (
                  <button type="button" onClick={() => setCustom({ key: "" })} className="text-accent-strong text-xs font-medium hover:underline">
                    Back to recommended
                  </button>
                )}
              </div>
              <SystemDiagram
                systemType={systemType}
                panelCount={r.panelCount}
                systemKwp={r.systemKwp}
                inverterKw={r.inverterKw}
                batteryModules={r.batteryModules}
                batteryKwh={r.batteryNominalKwh}
                monthlyUsageKwh={inputs.monthlyKwh}
                monthlyProductionKwh={r.monthlyProductionKwh}
                coveragePct={r.coveragePct}
                num={fmt.num}
                dec={fmt.dec}
              />
              <p className="text-muted text-xs">Try adding or removing panels and batteries to see how cost and savings change.</p>
              <div className={`grid gap-3 ${hasBattery ? "sm:grid-cols-2" : ""}`}>
                <Stepper
                  label="Solar panels"
                  value={r.panelCount}
                  onChange={setPanels}
                  recommended={r.recommendedPanels}
                  note={`Each panel adds ~${fmt.num(perPanelKwhMonth)} kWh/month${perPanelSavingMonth > 0 ? `, saves ~${fmt.money(perPanelSavingMonth)}/month` : ""} and costs ~${fmt.money(perPanelCost)}.`}
                />
                {hasBattery && (
                  <Stepper
                    label="Battery modules"
                    value={r.batteryModules}
                    onChange={setModules}
                    recommended={r.recommendedBatteryModules}
                    note={`${
                      systemType === "hybrid"
                        ? `Backup lasts ~${fmt.dec(backupHours)} hours at ${fmt.dec(inputs.essentialLoadKw)} kW load.`
                        : `Stores ~${fmt.dec(nightsCovered)} days of your use.`
                    } Each ${fmt.dec(inputs.batteryModuleKwh)} kWh module costs ~${fmt.money(perModuleCost)}.`}
                  />
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowDetails((s) => !s)}
              aria-expanded={showDetails}
              className="border-line hover:border-accent/60 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition"
            >
              {showDetails ? "Hide details" : "Show full details"}
              <span className={`text-muted transition ${showDetails ? "rotate-180" : ""}`}>▾</span>
            </button>

            {showDetails && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card title="Energy">
                    <Rows
                      rows={[
                        ["Your yearly usage", `${fmt.num(r.annualConsumptionKwh)} kWh`],
                        ["Solar produces per year", `${fmt.num(r.annualProductionKwh)} kWh`],
                        ["Panels", `${r.panelCount} × ${inputs.panelWatt} W`],
                        ...(hasBattery ? [["Battery modules", `${r.batteryModules} × ${inputs.batteryModuleKwh} kWh`] as [string, string]] : []),
                        ["Roof space", `${fmt.num(r.roofAreaM2)} m² · ${fmt.num(r.roofAreaM2 * 10.764)} ft²`],
                      ]}
                    />
                    <UsageBar coverage={r.coveragePct} />
                  </Card>
                  <Card title="Money">
                    <Rows
                      rows={[
                        ["Panels + inverter + install", fmt.money(r.pvCost)],
                        ...(hasBattery ? [["Batteries", fmt.money(r.batteryCost)] as [string, string]] : []),
                        ["Savings in year 1", fmt.money(r.firstYearSavings)],
                        [`Savings over ${inputs.years} years`, fmt.money(r.lifetimeSavings)],
                        ["Net profit", fmt.money(r.netProfit)],
                      ]}
                    />
                  </Card>
                </div>
                <Card title={`Your money over ${inputs.years} years`}>
                  <CashflowChart data={r.yearly} totalCost={r.totalCost} paybackYears={r.paybackYears} format={fmt.money} formatCompact={fmt.compact} />
                </Card>
                <p className="text-muted text-sm">
                  🌱 Saves about <b className="text-positive">{fmt.dec(r.co2TonnesPerYear)} tonnes of CO₂</b> a year, like planting {fmt.num(r.treesEquivalent)} trees.
                </p>
              </div>
            )}

            <p className="text-muted text-xs leading-relaxed">
              This is an estimate. Real output depends on season, shading and roof angle. Ask an installer for a site survey before you buy.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

function Stepper({ label, value, onChange, recommended, note }: { label: string; value: number; onChange: (n: number) => void; recommended: number; note: string }) {
  const btn = "border-line hover:border-accent hover:text-accent-strong flex size-9 items-center justify-center rounded-lg border text-lg font-semibold transition disabled:opacity-40";
  return (
    <div className="bg-sunken rounded-lg p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">{label}</div>
          <div className="text-muted text-xs">{value === recommended ? "Recommended" : `Recommended: ${recommended}`}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={value <= 0} aria-label={`Remove one from ${label}`}>
            −
          </button>
          <span className="w-8 text-center text-lg font-semibold tabular-nums" aria-live="polite">
            {value}
          </span>
          <button type="button" className={btn} onClick={() => onChange(value + 1)} aria-label={`Add one to ${label}`}>
            +
          </button>
        </div>
      </div>
      <p className="text-muted mt-2 text-xs">{note}</p>
    </div>
  );
}

function Question({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <span className="bg-accent flex size-6 shrink-0 items-center justify-center rounded-full text-xs text-black">{n}</span>
        {title}
      </h2>
      {children}
    </div>
  );
}

/* ---------- Small UI pieces ---------- */

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-line bg-surface space-y-3 rounded-xl border p-4 shadow-sm">
      <h2 className="text-sm font-semibold tracking-wide">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-muted text-xs font-medium">{label}</span>
      {children}
      {hint && <span className="text-muted block text-xs">{hint}</span>}
    </label>
  );
}

function NumberField(props: { label: string; unit: string; value: string; onChange: (v: string) => void; step?: number; hint?: string }) {
  return (
    <Field label={props.label} hint={props.hint}>
      <div className="input flex items-center gap-2 focus-within:ring-2">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step={props.step ?? 1}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          className="w-full min-w-0 bg-transparent outline-none"
        />
        <span className="text-muted shrink-0 text-xs">{props.unit}</span>
      </div>
    </Field>
  );
}

function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { id: string; label: string }[] }) {
  return (
    <div className="bg-sunken grid grid-cols-2 gap-1 rounded-lg p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${value === o.id ? "bg-surface shadow-sm" : "text-muted hover:text-foreground"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Kpi({ label, value, sub, highlight, tone }: { label: string; value: string; sub?: string; highlight?: boolean; tone?: "positive" | "negative" }) {
  return (
    <div className={`min-w-0 rounded-xl border p-4 shadow-sm ${highlight ? "border-accent bg-accent-soft" : "border-line bg-surface"}`}>
      <div className="text-muted text-xs font-medium">{label}</div>
      <div
        className={`mt-1 truncate text-xl font-semibold tabular-nums sm:text-2xl ${
          tone === "positive" ? "text-positive" : tone === "negative" ? "text-negative" : highlight ? "text-accent-strong" : ""
        }`}
        title={value}
      >
        {value}
      </div>
      {sub && <div className="text-muted mt-0.5 truncate text-xs">{sub}</div>}
    </div>
  );
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="divide-line divide-y text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 py-2">
          <dt className="text-muted">{k}</dt>
          <dd className="text-right font-medium tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function UsageBar({ coverage }: { coverage: number }) {
  const solar = Math.min(coverage, 100);
  return (
    <div className="pt-1">
      <div className="bg-sunken flex h-2.5 overflow-hidden rounded-full">
        <div className="bg-accent h-full" style={{ width: `${solar}%` }} />
      </div>
      <div className="text-muted mt-1.5 flex justify-between text-xs">
        <span>Solar {Math.round(solar)}%</span>
        <span>{coverage >= 100 ? `Surplus ${Math.round(coverage - 100)}%` : `Grid ${Math.round(100 - solar)}%`}</span>
      </div>
    </div>
  );
}
