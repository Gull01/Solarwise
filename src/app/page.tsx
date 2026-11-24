import SolarCalculator from "@/components/SolarCalculator";
import ThemeToggle from "@/components/ThemeToggle";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8">
        <div className="mb-3 flex items-center justify-between gap-4">
          <div className="text-accent-strong inline-flex items-center gap-2 text-lg font-bold tracking-tight">
            <SunIcon />
            SolarWise
          </div>
          <ThemeToggle />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">How much solar do you need?</h1>
        <p className="text-muted mt-3 max-w-2xl text-base">
          Answer three quick questions to see how many panels you need, what it costs, and how much you save.
        </p>
      </header>
      <SolarCalculator />
    </main>
  );
}

function SunIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}
