import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router";
import {
  Calendar,
  TrendingUp,
  Wallet,
  Calculator,
  BarChart3,
  Settings,
  ChevronRight,
  DollarSign,
} from "lucide-react";

const menuItems = [
  { path: "/schedule", icon: Calendar, label: "Schedule" },
  { path: "/bets", icon: DollarSign, label: "Bets" },
  { path: "/analytics", icon: TrendingUp, label: "Analytics" },
  { path: "/finance", icon: Wallet, label: "Finance" },
  { path: "/calculator", icon: Calculator, label: "Calculator" },
  { path: "/odds", icon: BarChart3, label: "Odds" },
  { path: "/admin", icon: Settings, label: "Admin" },
];

export function Layout() {
  const [isExpanded, setIsExpanded] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen" style={{ 
      backgroundColor: '#0F1624',
      fontFamily: 'Inter, sans-serif'
    }}>
      {/* Sidebar */}
      <div
        className="relative flex flex-col transition-all duration-300 ease-in-out"
        style={{
          width: isExpanded ? "200px" : "48px",
          backgroundColor: "#141E30",
        }}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
      >
        {/* Logo / Header Area */}
        <div className="flex items-center h-16 px-3">
          {isExpanded ? (
            <span className="text-white font-semibold">MLB Analytics</span>
          ) : (
            <div className="w-6 h-6 rounded bg-[#3D6FFF]"></div>
          )}
        </div>

        {/* Menu Items */}
        <nav className="flex-1 py-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (location.pathname === '/' && item.path === '/schedule');
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex items-center h-12 px-3 mb-1 transition-all relative group"
                style={{
                  color: isActive ? "#3D6FFF" : "#8B93A7",
                }}
              >
                {/* Active indicator */}
                {isActive && (
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ backgroundColor: "#3D6FFF" }}
                  ></div>
                )}
                
                {/* Icon */}
                <div className="flex items-center justify-center w-6">
                  <Icon className="w-5 h-5" />
                </div>

                {/* Label */}
                {isExpanded && (
                  <span className="ml-3 whitespace-nowrap">{item.label}</span>
                )}

                {/* Hover glow effect */}
                {!isActive && (
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                    style={{
                      background: "linear-gradient(90deg, rgba(61, 111, 255, 0.05) 0%, transparent 100%)",
                    }}
                  ></div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Expand/Collapse Indicator */}
        <div className="flex items-center justify-center h-12 border-t" style={{ borderColor: "#1A2540" }}>
          <ChevronRight
            className={`w-4 h-4 transition-transform text-[#8B93A7] ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
