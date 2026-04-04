import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, format, isSameDay, startOfDay } from "date-fns";

const mockGames = [
  {
    id: 1,
    homeTeam: "New York Yankees",
    awayTeam: "Boston Red Sox",
    homePitcher: "Gerrit Cole",
    awayPitcher: "Chris Sale",
    time: "7:05 PM ET",
    series: "Game 1 of 3",
    date: new Date(2026, 3, 3), // April 3, 2026
  },
  {
    id: 2,
    homeTeam: "Los Angeles Dodgers",
    awayTeam: "San Francisco Giants",
    homePitcher: "Walker Buehler",
    awayPitcher: "Logan Webb",
    time: "10:10 PM ET",
    series: "Game 2 of 3",
    date: new Date(2026, 3, 3),
  },
  {
    id: 3,
    homeTeam: "Chicago Cubs",
    awayTeam: "St. Louis Cardinals",
    homePitcher: "Justin Steele",
    awayPitcher: "Miles Mikolas",
    time: "2:20 PM ET",
    series: "Game 1 of 3",
    date: new Date(2026, 3, 3),
  },
  {
    id: 4,
    homeTeam: "Houston Astros",
    awayTeam: "Seattle Mariners",
    homePitcher: "Framber Valdez",
    awayPitcher: "Luis Castillo",
    time: "8:10 PM ET",
    series: "Game 2 of 4",
    date: new Date(2026, 3, 3),
  },
  {
    id: 5,
    homeTeam: "Atlanta Braves",
    awayTeam: "Miami Marlins",
    homePitcher: "Spencer Strider",
    awayPitcher: "Sandy Alcantara",
    time: "7:20 PM ET",
    series: "Game 1 of 3",
    date: new Date(2026, 3, 4),
  },
  {
    id: 6,
    homeTeam: "Toronto Blue Jays",
    awayTeam: "Tampa Bay Rays",
    homePitcher: "Alek Manoah",
    awayPitcher: "Shane McClanahan",
    time: "7:07 PM ET",
    series: "Game 3 of 3",
    date: new Date(2026, 3, 4),
  },
];

export function Schedule() {
  const today = startOfDay(new Date(2026, 3, 3)); // April 3, 2026
  const [currentWeekStart, setCurrentWeekStart] = useState(today);
  const [selectedDate, setSelectedDate] = useState(today);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  const handlePrevWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, -7));
  };

  const handleNextWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, 7));
  };

  const filteredGames = mockGames.filter((game) =>
    isSameDay(game.date, selectedDate)
  );

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: "#0F1624" }}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-white mb-2">Game Schedule</h1>
        <p className="text-[#8B93A7]">View upcoming MLB games and matchups</p>
      </div>

      {/* Date Navigation Strip */}
      <div
        className="flex items-center gap-4 p-4 mb-8 rounded-xl"
        style={{ backgroundColor: "#1A2540" }}
      >
        <button
          onClick={handlePrevWeek}
          className="flex items-center justify-center w-8 h-8 rounded-lg transition-all hover:bg-[#3D6FFF]/20"
          style={{ color: "#8B93A7" }}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex-1 flex gap-2">
          {weekDays.map((day) => {
            const isToday = isSameDay(day, today);
            const isSelected = isSameDay(day, selectedDate);

            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className="flex-1 py-3 px-4 rounded-lg transition-all"
                style={{
                  backgroundColor: isSelected ? "#3D6FFF" : "transparent",
                  color: isSelected ? "#FFFFFF" : "#8B93A7",
                  border: isToday && !isSelected ? "1px solid #3D6FFF" : "1px solid transparent",
                }}
              >
                <div className="text-xs mb-1">{format(day, "EEE")}</div>
                <div className="font-semibold">{format(day, "d")}</div>
              </button>
            );
          })}
        </div>

        <button
          onClick={handleNextWeek}
          className="flex items-center justify-center w-8 h-8 rounded-lg transition-all hover:bg-[#3D6FFF]/20"
          style={{ color: "#8B93A7" }}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Games Grid */}
      <div className="grid grid-cols-2 gap-6">
        {filteredGames.length > 0 ? (
          filteredGames.map((game) => (
            <div
              key={game.id}
              className="relative p-6 rounded-xl transition-all group hover:shadow-[0_0_20px_rgba(61,111,255,0.3)]"
              style={{
                backgroundColor: "#1A2540",
                border: "1px solid #2A3550",
              }}
            >
              {/* Get Stats Button */}
              <button
                className="absolute top-4 right-4 px-3 py-1 rounded-md text-xs transition-all"
                style={{
                  color: "#3D6FFF",
                  border: "1px solid #3D6FFF",
                  backgroundColor: "transparent",
                }}
              >
                Get Stats
              </button>

              {/* Series Badge */}
              <div
                className="inline-block px-2 py-1 rounded text-xs mb-4"
                style={{
                  backgroundColor: "#F5A623",
                  color: "#0F1624",
                }}
              >
                {game.series}
              </div>

              {/* Away Team */}
              <div className="flex items-center gap-4 mb-4">
                <div
                  className="flex items-center justify-center w-12 h-12 rounded-lg"
                  style={{ backgroundColor: "#2A3550" }}
                >
                  <span className="text-[#8B93A7] text-xs font-semibold">
                    {game.awayTeam.split(" ").pop()?.substring(0, 3).toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="text-white font-semibold">{game.awayTeam}</div>
                  <div className="text-[#8B93A7] text-sm">{game.awayPitcher}</div>
                </div>
              </div>

              {/* VS Divider */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px" style={{ backgroundColor: "#2A3550" }}></div>
                <span className="text-[#8B93A7] text-xs font-semibold">VS</span>
                <div className="flex-1 h-px" style={{ backgroundColor: "#2A3550" }}></div>
              </div>

              {/* Home Team */}
              <div className="flex items-center gap-4 mb-4">
                <div
                  className="flex items-center justify-center w-12 h-12 rounded-lg"
                  style={{ backgroundColor: "#2A3550" }}
                >
                  <span className="text-[#8B93A7] text-xs font-semibold">
                    {game.homeTeam.split(" ").pop()?.substring(0, 3).toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="text-white font-semibold">{game.homeTeam}</div>
                  <div className="text-[#8B93A7] text-sm">{game.homePitcher}</div>
                </div>
              </div>

              {/* Time */}
              <div
                className="text-center py-2 rounded-lg"
                style={{
                  backgroundColor: "#0F1624",
                  color: "#8B93A7",
                }}
              >
                {game.time}
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-2 text-center py-12">
            <p className="text-[#8B93A7]">No games scheduled for this date</p>
          </div>
        )}
      </div>
    </div>
  );
}
