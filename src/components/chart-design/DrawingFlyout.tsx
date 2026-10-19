import source from "./source.json";
import { GROUPS, type GroupKey } from "./drawing-tools";
import { HitTarget } from "./SourceNode";
const icons = source.icons as Record<string, string>;
export function DrawingFlyout({
  open,
  setOpen,
  tool,
  onPick,
  favorites,
  toggleFavorite,
  current,
}: {
  open: GroupKey | null;
  setOpen: (group: GroupKey | null) => void;
  tool: string;
  onPick: (id: string) => void;
  favorites: Set<string>;
  current: Record<GroupKey, string>;
  toggleFavorite: (id: string) => void;
}) {
  return (
    <>
      {(Object.keys(GROUPS) as GroupKey[]).map((key) => {
        const g = GROUPS[key];
        return (
          <div
            className="a tb"
            key={key}
            style={{ left: 17, top: g.y - 32, width: 82, height: 64 }}
          >
            <HitTarget
              x={0}
              y={0}
              width={64}
              height={64}
              label={`${key} drawing tools`}
              onClick={() => {
                const row = g.secs.flatMap(([, rows]) => rows).find((r) => r[0] === current[key]);
                if (row?.[4]) setOpen(key);
                else onPick(current[key]);
              }}
              onContextMenu={() => setOpen(key)}
            />
            <button
              type="button"
              className={`a tab ${open === key ? "on" : ""}`}
              style={{
                left: 64,
                top: 12,
                width: 18,
                height: 40,
                background: "#fff",
                border: "2px solid #d1d4dc",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-label={`Open ${key} tools`}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(open === key ? null : key);
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                style={{ stroke: "#787b86", fill: "none", strokeWidth: 2.2 }}
              >
                <path d={open === key ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
              </svg>
            </button>
          </div>
        );
      })}
      {open && (
        <div
          className="fl"
          role="menu"
          aria-label="Drawing tools"
          style={{
            display: "block",
            top: Math.max(
              84,
              Math.min(
                GROUPS[open].y - 20,
                1512 -
                  GROUPS[open].secs.reduce(
                    (sum, [title, rows]) => sum + rows.length * 80 + (title ? 45 : 0) + 20,
                    0,
                  ) -
                  16,
              ),
            ),
          }}
        >
          {GROUPS[open].secs.map(([title, rows], si) => (
            <div key={si}>
              {si > 0 && <div style={{ height: 2, background: "#e0e3eb", margin: "8px 0" }} />}
              {title && (
                <div
                  style={{
                    fontSize: 21,
                    color: "#787b86",
                    fontWeight: 600,
                    padding: "10px 26px 4px",
                    letterSpacing: 0.5,
                  }}
                >
                  {String(title)}
                </div>
              )}
              {(rows as (string | number)[][]).map((r) => {
                const id = String(r[0]),
                  disabled = !!r[4],
                  fav = favorites.has(id);
                return (
                  <div
                    key={id}
                    className={`fr ${tool === id ? "on" : ""} ${disabled ? "dis" : ""}`}
                    role="menuitem"
                    tabIndex={disabled ? -1 : 0}
                    aria-disabled={disabled}
                    onClick={() => {
                      if (!disabled) onPick(id);
                    }}
                    onKeyDown={(e) => {
                      if (!disabled && e.key === "Enter") onPick(id);
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="fi"
                      dangerouslySetInnerHTML={{ __html: icons[String(r[2])] ?? "" }}
                    />
                    <span className="fn">{r[1]}</span>
                    <span className="fk">{r[3]}</span>
                    {!disabled && (
                      <button
                        type="button"
                        className={`star ${fav ? "fav" : ""}`}
                        data-tip={fav ? "Remove from favorites" : "Add to favorites"}
                        aria-label={`${fav ? "Unfavorite" : "Favorite"} ${r[1]}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(id);
                        }}
                      >
                        <svg viewBox="0 0 24 24">
                          <path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
