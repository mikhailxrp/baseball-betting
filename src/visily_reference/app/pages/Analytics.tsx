import { TrendingUp, TrendingDown, CheckCircle2, AlertCircle } from "lucide-react";

const statsData = {
  overall: [
    { metric: "Total Bets", value: "156", change: "+12" },
    { metric: "Win Rate", value: "62.8%", winRate: 62.8 },
    { metric: "Total Profit", value: "$4,820", change: "+$680" },
    { metric: "ROI", value: "18.4%", change: "+2.3%" },
  ],
  teamPerformance: [
    { team: "New York Yankees", bets: 24, wins: 17, winRate: 70.8 },
    { team: "Los Angeles Dodgers", bets: 22, wins: 15, winRate: 68.2 },
    { team: "Houston Astros", bets: 18, wins: 11, winRate: 61.1 },
    { team: "Atlanta Braves", bets: 20, wins: 12, winRate: 60.0 },
    { team: "San Diego Padres", bets: 15, wins: 8, winRate: 53.3 },
    { team: "Toronto Blue Jays", bets: 16, wins: 7, winRate: 43.8 },
  ],
};

const conclusions = [
  {
    type: "positive",
    text: "Strong performance on home favorites (+15.2% ROI)",
  },
  {
    type: "warning",
    text: "Underperformance on divisional games (-3.4% ROI)",
  },
  {
    type: "positive",
    text: "Excellent timing on afternoon games (68% win rate)",
  },
];

export function Analytics() {
  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: "#0F1624" }}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-white mb-2">Analytics Dashboard</h1>
        <p className="text-[#8B93A7]">Track your betting performance and insights</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Overall Performance */}
        <div
          className="p-6 rounded-xl"
          style={{
            backgroundColor: "#1A2540",
            border: "1px solid #2A3550",
          }}
        >
          <h2 className="text-white mb-6">Overall Performance</h2>
          <div className="space-y-4">
            <table className="w-full">
              <tbody>
                {statsData.overall.map((stat, index) => (
                  <tr key={index} className="border-b border-[#2A3550]">
                    <td className="py-3 text-[#8B93A7]">{stat.metric}</td>
                    <td className="py-3 text-right">
                      {stat.winRate !== undefined ? (
                        <div>
                          <div className="text-white font-semibold mb-2">{stat.value}</div>
                          <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#2A3550" }}>
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${stat.winRate}%`,
                                backgroundColor:
                                  stat.winRate >= 60
                                    ? "#00C48C"
                                    : stat.winRate >= 45
                                    ? "#F5A623"
                                    : "#FF4757",
                              }}
                            ></div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-white font-semibold">{stat.value}</span>
                          {stat.change && (
                            <span
                              className="text-xs"
                              style={{
                                color: stat.change.startsWith("+") ? "#00C48C" : "#FF4757",
                              }}
                            >
                              {stat.change}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Team Performance */}
        <div
          className="p-6 rounded-xl"
          style={{
            backgroundColor: "#1A2540",
            border: "1px solid #2A3550",
          }}
        >
          <h2 className="text-white mb-6">Team Performance</h2>
          <div className="space-y-4">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2A3550]">
                  <th className="py-2 text-left text-[#8B93A7] font-medium text-sm">Team</th>
                  <th className="py-2 text-center text-[#8B93A7] font-medium text-sm">W/L</th>
                  <th className="py-2 text-right text-[#8B93A7] font-medium text-sm">Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {statsData.teamPerformance.map((team, index) => (
                  <tr key={index} className="border-b border-[#2A3550]">
                    <td className="py-3 text-white text-sm">{team.team}</td>
                    <td className="py-3 text-center text-[#8B93A7] text-sm">
                      {team.wins}/{team.bets - team.wins}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className="text-sm font-semibold"
                          style={{
                            color:
                              team.winRate >= 60
                                ? "#00C48C"
                                : team.winRate >= 45
                                ? "#F5A623"
                                : "#FF4757",
                          }}
                        >
                          {team.winRate.toFixed(1)}%
                        </span>
                        <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#2A3550" }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${team.winRate}%`,
                              backgroundColor:
                                team.winRate >= 60
                                  ? "#00C48C"
                                  : team.winRate >= 45
                                  ? "#F5A623"
                                  : "#FF4757",
                            }}
                          ></div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Conclusions */}
      <div
        className="p-6 rounded-xl"
        style={{
          backgroundColor: "#1A2540",
          border: "1px solid #2A3550",
        }}
      >
        <h2 className="text-white mb-6">Key Insights</h2>
        <div className="space-y-4">
          {conclusions.map((conclusion, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-4 rounded-lg"
              style={{
                backgroundColor: "#0F1624",
              }}
            >
              <div className="flex-shrink-0 mt-0.5">
                {conclusion.type === "positive" ? (
                  <CheckCircle2 className="w-5 h-5" style={{ color: "#00C48C" }} />
                ) : (
                  <AlertCircle className="w-5 h-5" style={{ color: "#F5A623" }} />
                )}
              </div>
              <p className="text-[#E5E7EB] text-sm">{conclusion.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
