"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SECTION_SCHEDULE = "schedule";

const NAV_ITEMS = [
  { id: SECTION_SCHEDULE, label: "Расписание", href: "/" },
  { id: "bets", label: "Ставки", href: "/bets" },
  { id: "analytics", label: "Аналитика", href: "/analytics" },
  { id: "finance", label: "Финансы", href: "/finance" },
  { id: "calculator", label: "Калькулятор", href: "/calculator" },
  { id: "odds", label: "Коэффициенты букмекеров", href: "/odds" },
  { id: "admin", label: "Управление системой", href: "/admin" },
];

const SECTION_TITLES = {
  [SECTION_SCHEDULE]: "Расписание",
};

/** @type {React.Context<null | {
 *   activeSection: string;
 *   setActiveSection: (id: string) => void;
 *   sidebarCollapsed: boolean;
 *   setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
 * }>} */
const AppShellContext = createContext(null);

export function useAppShell() {
  const ctx = useContext(AppShellContext);
  if (ctx == null) {
    throw new Error("useAppShell: обёртка AppShell отсутствует");
  }
  return ctx;
}

export { SECTION_SCHEDULE, SECTION_TITLES };

/**
 * Тот же каркас, что на главной: левый сайдбар + основная колонка.
 *
 * @param {{ children: React.ReactNode }} props
 */
export function AppShell({ children }) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState(SECTION_SCHEDULE);

  const value = useMemo(
    () => ({
      activeSection,
      setActiveSection,
      sidebarCollapsed,
      setSidebarCollapsed,
    }),
    [activeSection, sidebarCollapsed],
  );

  return (
    <AppShellContext.Provider value={value}>
      <div className="flex h-screen min-h-0 w-full font-sans">
        <aside
          className={cn(
            "flex shrink-0 flex-col border-r border-white/15 bg-medium-slate transition-[width] duration-200 ease-out",
            sidebarCollapsed ? "w-14" : "w-56",
          )}
        >
          <div
            className={cn(
              "flex items-center p-2",
              sidebarCollapsed ? "justify-center" : "justify-end",
            )}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={
                sidebarCollapsed ? "Развернуть панель" : "Свернуть панель"
              }
              className="text-white hover:bg-soft-periwinkle hover:text-white"
              onClick={() => setSidebarCollapsed((c) => !c)}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="size-5" />
              ) : (
                <ChevronLeft className="size-5" />
              )}
            </Button>
          </div>

          {!sidebarCollapsed ? (
            <nav className="flex flex-col gap-1 px-2 pb-4">
              {NAV_ITEMS.map((item) => {
                const navLinkClass = cn(
                  buttonVariants({ variant: "ghost" }),
                  "w-full justify-start text-white hover:bg-soft-periwinkle hover:text-white",
                );
                if (item.href != null) {
                  let isActive = false;
                  if (item.href === "/") {
                    isActive = pathname === "/" && activeSection === item.id;
                  } else {
                    isActive = pathname === item.href;
                  }
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={cn(
                        navLinkClass,
                        isActive && "bg-soft-periwinkle text-white",
                      )}
                      onClick={() => {
                        if (item.href === "/") {
                          setActiveSection(item.id);
                        }
                      }}
                    >
                      {item.label}
                    </Link>
                  );
                }
                return (
                  <Button
                    key={item.id}
                    type="button"
                    variant="ghost"
                    className={cn(
                      "w-full justify-start text-white hover:bg-soft-periwinkle hover:text-white",
                      activeSection === item.id && "bg-soft-periwinkle text-white",
                    )}
                    onClick={() => setActiveSection(item.id)}
                  >
                    {item.label}
                  </Button>
                );
              })}
            </nav>
          ) : null}
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-muted">
          <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
            {children}
          </div>
        </main>
      </div>
    </AppShellContext.Provider>
  );
}
