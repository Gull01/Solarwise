# SolarWise — Solar System Calculator

A Next.js app that sizes a residential solar PV system from your electricity use and location.

**Live:** https://solarwattwise.vercel.app

**It calculates:** system size (kWp), panel count, inverter size, battery bank (hybrid / off-grid), roof area, yearly production, cost, first-year and lifetime savings, payback period, ROI, and CO₂ avoided. It also shows a 25-year cash-flow chart.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Where things live

- `src/lib/solar.ts` — the sizing and financial model (pure TypeScript, no React). Location presets, currency/price presets and defaults are here too.
- `src/components/SolarCalculator.tsx` — form and results UI.
- `src/components/CashflowChart.tsx` — SVG cumulative cash-flow chart.

## Model in brief

- Required kWp = daily need ÷ (peak sun hours × performance ratio). Off-grid also adds battery round-trip losses.
- Inverter = array kWp ÷ 1.15 (DC/AC ratio), rounded up to a standard size and never below the essential load for battery systems.
- Battery (hybrid) = essential load × backup hours; (off-grid) = daily use × days of autonomy; both ÷ depth of discharge ÷ 95% efficiency, rounded up to whole modules.
- Savings = self-consumed kWh × tariff + exported kWh × export price, with yearly tariff escalation and panel degradation.

The prices and sun hours are rough defaults. Replace them with local quotes and data for real decisions.
