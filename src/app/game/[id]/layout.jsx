import Link from "next/link";

import { AppShell } from "@/components/layout/AppShell.jsx";
import { Button } from "@/components/ui/button";

/**
 * @param {{ children: React.ReactNode }} props
 */
export default function GameLayout({ children }) {
  return (
    <AppShell>
      <div className="mb-4">
        <Link href="/">
          <Button variant="ghost">← Назад</Button>
        </Link>
      </div>
      {children}
    </AppShell>
  );
}
