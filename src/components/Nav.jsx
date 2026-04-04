'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar,
  DollarSign,
  TrendingUp,
  Wallet,
  Calculator,
  BarChart3,
  Users,
  Settings,
  ChevronRight,
} from 'lucide-react';

const menuItems = [
  { path: '/', icon: Calendar, label: 'Расписание' },
  { path: '/bets', icon: DollarSign, label: 'Ставки' },
  { path: '/teams', icon: Users, label: 'Команды' },
  { path: '/analytics', icon: TrendingUp, label: 'Аналитика' },
  { path: '/finance', icon: Wallet, label: 'Финансы' },
  { path: '/calculator', icon: Calculator, label: 'Калькулятор' },
  { path: '/odds', icon: BarChart3, label: 'Коэффициенты' },
  { path: '/admin', icon: Settings, label: 'Управление' },
];

export default function Nav() {
  const [isExpanded, setIsExpanded] = useState(false);
  const pathname = usePathname();

  return (
    <div
      className="relative flex flex-col transition-all duration-300 ease-in-out"
      style={{
        width: isExpanded ? '200px' : '48px',
        backgroundColor: '#141E30',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 50,
      }}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className="flex items-center h-16 px-3">
        {isExpanded ? (
          <span className="text-white font-semibold">MLB Analytics</span>
        ) : (
          <div
            className="w-6 h-6 rounded"
            style={{ backgroundColor: '#3D6FFF' }}
          ></div>
        )}
      </div>

      <nav className="flex-1 py-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path;

          return (
            <Link
              key={item.path}
              href={item.path}
              className="flex items-center h-12 px-3 mb-1 transition-all relative group"
              style={{
                color: isActive ? '#3D6FFF' : '#8B93A7',
              }}
            >
              {isActive && (
                <div
                  className="absolute left-0 top-0 bottom-0 w-1"
                  style={{ backgroundColor: '#3D6FFF' }}
                ></div>
              )}

              <div className="flex items-center justify-center w-6">
                <Icon className="w-5 h-5" />
              </div>

              {isExpanded && (
                <span className="ml-3 whitespace-nowrap">{item.label}</span>
              )}

              {!isActive && (
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  style={{
                    background:
                      'linear-gradient(90deg, rgba(61, 111, 255, 0.05) 0%, transparent 100%)',
                  }}
                ></div>
              )}
            </Link>
          );
        })}
      </nav>

      <div
        className="flex items-center justify-center h-12 border-t"
        style={{ borderColor: '#1A2540' }}
      >
        <ChevronRight
          className={`w-4 h-4 transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
          style={{ color: '#8B93A7' }}
        />
      </div>
    </div>
  );
}
