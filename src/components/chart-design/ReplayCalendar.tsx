import { useState } from "react";
export function ReplayCalendar({
  initial,
  available,
  onSelect,
}: {
  initial: number;
  available?: { first: number; last: number } | undefined;
  onSelect: (time: number) => void;
}) {
  const [month, setMonth] = useState(() => {
    const d = new Date(initial);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  });
  const year = new Date(month).getUTCFullYear(),
    m = new Date(month).getUTCMonth(),
    offset = (new Date(month).getUTCDay() + 6) % 7,
    days = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
  return (
    <div
      className="a source-calendar"
      role="dialog"
      aria-label="Go to replay date"
      onClick={(e) => e.stopPropagation()}
      style={{
        left: 672,
        bottom: 152,
        width: 560,
        background: "#fff",
        borderRadius: 12,
        boxShadow: "0 4px 24px rgba(0,0,0,.18),0 0 0 1px rgba(0,0,0,.04)",
        padding: "28px 32px 32px",
        zIndex: 6,
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 600, marginBottom: 6 }}>Go to</div>
      <div
        tabIndex={0}
        role="button"
        aria-label="Calendar month; use left and right arrows to change month"
        onKeyDown={(e) => {
          if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
            e.preventDefault();
            setMonth(Date.UTC(year, m + (e.key === "ArrowLeft" ? -1 : 1), 1));
          }
        }}
        style={{ fontSize: 24, color: "#787b86", marginBottom: 18 }}
      >
        {new Date(month).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        })}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7,64px)",
          gap: 6,
          textAlign: "center",
          fontSize: 24,
        }}
      >
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((day) => (
          <div key={day} style={{ color: "#787b86", height: 44, lineHeight: "44px" }}>
            {day}
          </div>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const day = i + 1,
            time = Date.UTC(year, m, day, 12);
          const ok =
            time <= Date.now() &&
            (!available || (time >= available.first && time <= available.last));
          return (
            <button
              type="button"
              className={ok ? "h" : ""}
              key={day}
              disabled={!ok}
              aria-label={`Select ${year}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`}
              style={{
                height: 64,
                lineHeight: "64px",
                borderRadius: 8,
                cursor: ok ? "pointer" : "default",
                color: ok ? "#131722" : "#c3c6cf",
              }}
              onClick={() => onSelect(time)}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
