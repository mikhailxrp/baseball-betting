import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Schedule } from "./pages/Schedule";
import { Analytics } from "./pages/Analytics";
import { Bets } from "./pages/Bets";
import { Finance } from "./pages/Finance";
import { Calculator } from "./pages/Calculator";
import { Odds } from "./pages/Odds";
import { Admin } from "./pages/Admin";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Schedule },
      { path: "schedule", Component: Schedule },
      { path: "bets", Component: Bets },
      { path: "analytics", Component: Analytics },
      { path: "finance", Component: Finance },
      { path: "calculator", Component: Calculator },
      { path: "odds", Component: Odds },
      { path: "admin", Component: Admin },
    ],
  },
]);
