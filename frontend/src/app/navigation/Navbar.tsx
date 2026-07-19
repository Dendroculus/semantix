import { useState } from "react";
import { NavLink } from "react-router-dom";

import { APP_PATHS, NAV_ITEMS } from "./navigationConfig";
import { SessionUptime } from "./SessionUptime";

function navClass(isActive: boolean): string {
  const tone = isActive
    ? "border-l-[var(--gold)] bg-[rgba(212,161,90,0.08)] text-[var(--gold)] md:border-b-[var(--gold)] md:border-l-transparent"
    : "border-l-transparent text-[var(--text-muted)] hover:bg-[rgba(234,230,221,0.04)] hover:text-[var(--text)] md:border-b-transparent";

  return `ui-label block border-b border-b-[var(--hairline)] border-l-2 px-3 py-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)] md:border-b md:border-l-0 md:py-2 ${tone}`;
}

export function Navbar(): JSX.Element {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-(--hairline) bg-(--ink) py-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 md:flex-nowrap md:gap-x-6">
        <div className="min-w-0 flex-1 md:min-w-48 md:flex-none">
          <p className="ui-label text-(--gold)">Semantix</p>
          <p className="font-display mt-1 hidden text-lg italic text-(--text-soft) sm:block">
            Semantic cache laboratory
          </p>
        </div>

        <nav
          aria-label="Primary navigation"
          className={`${isMenuOpen ? "block" : "hidden"} order-4 w-full border border-(--hairline) bg-(--surface) p-1 md:order-0 md:block md:min-w-0 md:flex-1`}
          id="primary-navigation"
        >
          <div className="flex flex-col md:flex-row md:items-center md:gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                end={item.to === APP_PATHS.monitor}
                key={item.to}
                className={({ isActive }) => navClass(isActive)}
                to={item.to}
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>

        <SessionUptime />

        <button
          aria-controls="primary-navigation"
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? "Close primary menu" : "Open primary menu"}
          className="flex size-11 shrink-0 items-center justify-center border border-(--hairline) bg-(--surface) text-(--gold) transition-colors hover:border-(--gold) focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-(--gold) md:hidden"
          type="button"
          onClick={() => setIsMenuOpen((current) => !current)}
        >
          <span
            aria-hidden="true"
            className="flex w-5 flex-col items-stretch gap-1.5"
          >
            <span
              className={`block h-px bg-current transition-transform ${
                isMenuOpen ? "translate-y-[7px] rotate-45" : ""
              }`}
            />
            <span
              className={`block h-px bg-current transition-opacity ${
                isMenuOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`block h-px bg-current transition-transform ${
                isMenuOpen ? "translate-y-[-7px] -rotate-45" : ""
              }`}
            />
          </span>
        </button>
      </div>
    </header>
  );
}
