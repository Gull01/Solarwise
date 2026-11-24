// Pure solar sizing + financial model. No React, no I/O — easy to test.

export type SystemType = "on-grid" | "hybrid" | "off-grid";

export interface SolarInputs {
  monthlyKwh: number; // average monthly consumption
  peakSunHours: number; // average daily peak sun hours at the site
  systemType: SystemType;
  offsetPct: number; // % of consumption the array should cover (on-grid / hybrid)
  panelWatt: number; // single panel rating (W)
  panelEfficiencyPct: number; // module efficiency, used for roof area
  performanceRatio: number; // 0..1, combined system losses (temp, wiring, inverter, soiling)
  // Battery
  backupHours: number; // hybrid: hours of backup for essential loads
  essentialLoadKw: number; // hybrid: average essential load during outages
  autonomyDays: number; // off-grid: days without sun the battery must cover
  batteryDoDPct: number; // usable depth of discharge
  batteryModuleKwh: number; // size of one battery module
  // Money
  tariff: number; // price paid per kWh from the grid
  exportRate: number; // price received per exported kWh (net metering / feed-in)
  costPerWatt: number; // installed cost of PV + inverter + BOS, per W
  batteryCostPerKwh: number;
  tariffEscalationPct: number; // yearly electricity price increase
  degradationPct: number; // yearly panel output loss
  gridEmissionFactor: number; // kg CO2 per kWh of grid electricity
  years: number; // analysis horizon
  // Optional manual choices; when omitted the recommended counts are used.
  panelCountOverride?: number;
  batteryModulesOverride?: number;
}

export interface YearRow {
  year: number;
  productionKwh: number;
  savings: number;
  cumulative: number; // cumulative net cash position (starts at -cost)
}

export interface SolarResult {
  dailyNeedKwh: number;
  annualConsumptionKwh: number;
  requiredKwp: number;
  recommendedPanels: number;
  recommendedBatteryModules: number;
  panelCount: number;
  systemKwp: number;
  inverterKw: number;
  roofAreaM2: number;
  annualProductionKwh: number;
  monthlyProductionKwh: number;
  selfConsumedKwh: number;
  exportedKwh: number;
  coveragePct: number; // share of annual consumption produced by the array
  batteryUsableKwh: number;
  batteryNominalKwh: number;
  batteryModules: number;
  pvCost: number;
  batteryCost: number;
  totalCost: number;
  firstYearSavings: number;
  paybackYears: number | null; // fractional years, null if never within horizon
  lifetimeSavings: number;
  netProfit: number;
  roiPct: number;
  co2TonnesPerYear: number;
  treesEquivalent: number;
  yearly: YearRow[];
}

// Common string/hybrid inverter ratings (kW AC).
const INVERTER_SIZES = [1, 1.5, 2, 3, 3.6, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 36, 40, 50, 60, 80, 100];
// Typical DC/AC ratio: arrays are slightly oversized relative to the inverter.
const DC_AC_RATIO = 1.15;
// Extra space between rows / edges on top of raw module area.
const ROOF_SPACING_FACTOR = 1.15;
const BATTERY_ROUND_TRIP = 0.95;
const KG_CO2_PER_TREE_YEAR = 21;

const pos = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export function pickInverterKw(systemKwp: number, minKw = 0): number {
  const target = Math.max(systemKwp / DC_AC_RATIO, minKw);
  return INVERTER_SIZES.find((s) => s >= target) ?? Math.ceil(target);
}

export function calculateSolar(i: SolarInputs): SolarResult {
  const monthlyKwh = pos(i.monthlyKwh);
  const psh = pos(i.peakSunHours);
  const pr = Math.min(pos(i.performanceRatio), 1);
  const panelWatt = pos(i.panelWatt);
  const offGrid = i.systemType === "off-grid";

  const annualConsumptionKwh = monthlyKwh * 12;
  // Off-grid must cover 100% of the load; grid-tied systems cover the chosen offset.
  const offset = offGrid ? 1 : Math.min(pos(i.offsetPct), 200) / 100;
  const dailyNeedKwh = (annualConsumptionKwh / 365) * offset;

  // Off-grid arrays also have to refill battery losses.
  const dailyArrayKwh = offGrid ? dailyNeedKwh / BATTERY_ROUND_TRIP : dailyNeedKwh;
  const yieldPerKwp = psh * pr; // kWh per kWp per day
  const requiredKwp = yieldPerKwp > 0 ? dailyArrayKwh / yieldPerKwp : 0;

  const recommendedPanels = panelWatt > 0 ? Math.ceil((requiredKwp * 1000) / panelWatt - 1e-9) : 0;
  const panelCount = i.panelCountOverride !== undefined ? Math.max(0, Math.round(i.panelCountOverride)) : recommendedPanels;
  const systemKwp = (panelCount * panelWatt) / 1000;

  const essentialKw = pos(i.essentialLoadKw);
  const inverterKw = systemKwp > 0 ? pickInverterKw(systemKwp, i.systemType === "on-grid" ? 0 : essentialKw) : 0;

  const panelAreaM2 = panelWatt / (1000 * (pos(i.panelEfficiencyPct) / 100 || 0.21));
  const roofAreaM2 = panelCount * panelAreaM2 * ROOF_SPACING_FACTOR;

  const annualProductionKwh = systemKwp * yieldPerKwp * 365;

  // Battery sizing.
  const dod = Math.min(pos(i.batteryDoDPct), 100) / 100 || 0.9;
  let batteryUsableKwh = 0;
  if (i.systemType === "hybrid") batteryUsableKwh = pos(i.backupHours) * essentialKw;
  if (offGrid) batteryUsableKwh = (annualConsumptionKwh / 365) * pos(i.autonomyDays);
  const batteryNominalRaw = batteryUsableKwh > 0 ? batteryUsableKwh / dod / BATTERY_ROUND_TRIP : 0;
  const moduleKwh = pos(i.batteryModuleKwh) || 5;
  const recommendedBatteryModules = batteryNominalRaw > 0 ? Math.ceil(batteryNominalRaw / moduleKwh - 1e-9) : 0;
  const batteryModules =
    i.systemType !== "on-grid" && i.batteryModulesOverride !== undefined
      ? Math.max(0, Math.round(i.batteryModulesOverride))
      : recommendedBatteryModules;
  const batteryNominalKwh = batteryModules * moduleKwh;

  // Costs.
  const pvCost = systemKwp * 1000 * pos(i.costPerWatt);
  const batteryCost = batteryNominalKwh * pos(i.batteryCostPerKwh);
  const totalCost = pvCost + batteryCost;

  // Yearly cash flow.
  const years = Math.max(1, Math.round(pos(i.years) || 25));
  const deg = pos(i.degradationPct) / 100;
  const esc = pos(i.tariffEscalationPct) / 100;
  const yearly: YearRow[] = [];
  let cumulative = -totalCost;
  let paybackYears: number | null = totalCost === 0 ? 0 : null;
  let lifetimeSavings = 0;
  let selfConsumedKwh = 0;
  let exportedKwh = 0;
  let firstYearSavings = 0;

  for (let y = 1; y <= years; y++) {
    const production = annualProductionKwh * Math.pow(1 - deg, y - 1);
    const self = Math.min(production, annualConsumptionKwh);
    const exported = offGrid ? 0 : Math.max(0, production - annualConsumptionKwh);
    const factor = Math.pow(1 + esc, y - 1);
    const savings = (self * pos(i.tariff) + exported * pos(i.exportRate)) * factor;

    if (y === 1) {
      selfConsumedKwh = self;
      exportedKwh = exported;
      firstYearSavings = savings;
    }

    const before = cumulative;
    cumulative += savings;
    lifetimeSavings += savings;
    if (paybackYears === null && cumulative >= 0 && savings > 0) {
      paybackYears = y - 1 + -before / savings;
    }
    yearly.push({ year: y, productionKwh: production, savings, cumulative });
  }

  const netProfit = lifetimeSavings - totalCost;
  const co2TonnesPerYear = (Math.min(annualProductionKwh, offGrid ? annualConsumptionKwh : Infinity) * pos(i.gridEmissionFactor)) / 1000;

  return {
    dailyNeedKwh,
    annualConsumptionKwh,
    requiredKwp,
    recommendedPanels,
    recommendedBatteryModules,
    panelCount,
    systemKwp,
    inverterKw,
    roofAreaM2,
    annualProductionKwh,
    monthlyProductionKwh: annualProductionKwh / 12,
    selfConsumedKwh,
    exportedKwh,
    coveragePct: annualConsumptionKwh > 0 ? (annualProductionKwh / annualConsumptionKwh) * 100 : 0,
    batteryUsableKwh,
    batteryNominalKwh,
    batteryModules,
    pvCost,
    batteryCost,
    totalCost,
    firstYearSavings,
    paybackYears,
    lifetimeSavings,
    netProfit,
    roiPct: totalCost > 0 ? (netProfit / totalCost) * 100 : 0,
    co2TonnesPerYear,
    treesEquivalent: (co2TonnesPerYear * 1000) / KG_CO2_PER_TREE_YEAR,
    yearly,
  };
}

// ---------- Presets ----------

export interface LocationPreset {
  name: string;
  psh: number; // approximate annual-average peak sun hours
}

// Rough annual averages for a south-facing (north in the southern hemisphere), latitude-tilted array.
export const LOCATIONS: LocationPreset[] = [
  { name: "Riyadh, Saudi Arabia", psh: 6.2 },
  { name: "Dubai, UAE", psh: 6.0 },
  { name: "Phoenix, USA", psh: 6.5 },
  { name: "Karachi, Pakistan", psh: 5.6 },
  { name: "Lahore, Pakistan", psh: 5.2 },
  { name: "Islamabad, Pakistan", psh: 5.0 },
  { name: "Cairo, Egypt", psh: 6.0 },
  { name: "Nairobi, Kenya", psh: 5.8 },
  { name: "Cape Town, South Africa", psh: 5.6 },
  { name: "New Delhi, India", psh: 5.3 },
  { name: "Mumbai, India", psh: 5.0 },
  { name: "Sydney, Australia", psh: 5.0 },
  { name: "Los Angeles, USA", psh: 5.7 },
  { name: "New York, USA", psh: 4.2 },
  { name: "Madrid, Spain", psh: 5.0 },
  { name: "Istanbul, Türkiye", psh: 4.3 },
  { name: "Berlin, Germany", psh: 3.0 },
  { name: "London, UK", psh: 2.7 },
];

export interface CurrencyPreset {
  code: string;
  symbol: string;
  tariff: number;
  exportRate: number;
  costPerWatt: number;
  batteryCostPerKwh: number;
}

// Ballpark residential figures — users should replace them with local quotes.
export const CURRENCIES: CurrencyPreset[] = [
  { code: "USD", symbol: "$", tariff: 0.17, exportRate: 0.08, costPerWatt: 2.8, batteryCostPerKwh: 700 },
  { code: "EUR", symbol: "€", tariff: 0.3, exportRate: 0.08, costPerWatt: 1.6, batteryCostPerKwh: 600 },
  { code: "GBP", symbol: "£", tariff: 0.25, exportRate: 0.12, costPerWatt: 1.5, batteryCostPerKwh: 550 },
  { code: "PKR", symbol: "Rs", tariff: 60, exportRate: 11, costPerWatt: 100, batteryCostPerKwh: 55000 },
  { code: "INR", symbol: "₹", tariff: 8, exportRate: 3, costPerWatt: 50, batteryCostPerKwh: 25000 },
  { code: "AED", symbol: "AED", tariff: 0.38, exportRate: 0.2, costPerWatt: 3.5, batteryCostPerKwh: 2500 },
  { code: "SAR", symbol: "SAR", tariff: 0.3, exportRate: 0.1, costPerWatt: 3.5, batteryCostPerKwh: 2500 },
];

export const DEFAULT_INPUTS: SolarInputs = {
  monthlyKwh: 600,
  peakSunHours: 5.0,
  systemType: "on-grid",
  offsetPct: 100,
  panelWatt: 550,
  panelEfficiencyPct: 21.3,
  performanceRatio: 0.8,
  backupHours: 4,
  essentialLoadKw: 1.5,
  autonomyDays: 1.5,
  batteryDoDPct: 90,
  batteryModuleKwh: 5,
  tariff: CURRENCIES[0].tariff,
  exportRate: CURRENCIES[0].exportRate,
  costPerWatt: CURRENCIES[0].costPerWatt,
  batteryCostPerKwh: CURRENCIES[0].batteryCostPerKwh,
  tariffEscalationPct: 3,
  degradationPct: 0.5,
  gridEmissionFactor: 0.45,
  years: 25,
};
