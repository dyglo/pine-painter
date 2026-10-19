import { useState } from "react";
import { GROUPS, type GroupKey } from "./drawing-tools";
import { FLYOUT_GROUPS, EMOJI_FACES } from "./flyout-data";
import { HitTarget } from "./SourceNode";

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
  const [emojiSearch, setEmojiSearch] = useState("");
  const [emojiTab, setEmojiTab] = useState<"emojis" | "stickers" | "icons">("emojis");

  const groupKeys = Object.keys(GROUPS) as GroupKey[];

  return (
    <>
      {/* 1. Left toolbar trigger targets and chevron tab buttons */}
      {groupKeys.map((key) => {
        const g = GROUPS[key];
        const isOpen = open === key;
        const curId = current[key] || g.cur;

        return (
          <div
            className="a tb"
            key={key}
            style={{ left: 18, top: g.y - 34, width: 86, height: 68 }}
          >
            <HitTarget
              x={0}
              y={0}
              width={68}
              height={68}
              label={`${key} drawing tools`}
              onClick={() => {
                onPick(curId);
              }}
              onContextMenu={() => setOpen(isOpen ? null : key)}
            />
            <button
              type="button"
              className={`a tab ${isOpen ? "on" : ""}`}
              style={{
                left: 68,
                top: 14,
                width: 18,
                height: 40,
                background: isOpen ? "#e6f0ff" : "#f0f3fa",
                border: "1px solid #d1d4dc",
                borderRadius: "6px 0 0 6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                cursor: "pointer",
              }}
              aria-label={`Open ${key} tools`}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(isOpen ? null : key);
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                style={{
                  stroke: isOpen ? "#2962ff" : "#787b86",
                  fill: "none",
                  strokeWidth: 2,
                }}
              >
                <path d={isOpen ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
              </svg>
            </button>
          </div>
        );
      })}

      {/* 2. Pixel-perfect Drawing Flyout Modals */}
      {open && FLYOUT_GROUPS[open] && (
        <div
          className="fl"
          role="menu"
          aria-label={`${FLYOUT_GROUPS[open].title} tools`}
          style={{
            display: "block",
            left: 104,
            width: FLYOUT_GROUPS[open].width * 2,
            top: Math.max(
              80,
              Math.min(
                FLYOUT_GROUPS[open].y - 34,
                1512 - (open === "lines" || open === "fib" ? 1100 : 700),
              ),
            ),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {FLYOUT_GROUPS[open].isEmoji ? (
            <div className="emoji-panel" style={{ padding: "16px 36px 28px" }}>
              <div className="emoji-tabs">
                <button
                  type="button"
                  className={`emoji-tab ${emojiTab === "emojis" ? "on" : ""}`}
                  onClick={() => setEmojiTab("emojis")}
                >
                  Emojis
                </button>
                <button
                  type="button"
                  className={`emoji-tab ${emojiTab === "stickers" ? "on" : ""}`}
                  onClick={() => setEmojiTab("stickers")}
                >
                  Stickers
                </button>
                <button
                  type="button"
                  className={`emoji-tab ${emojiTab === "icons" ? "on" : ""}`}
                  onClick={() => setEmojiTab("icons")}
                >
                  Icons
                </button>
              </div>
              <div style={{ marginTop: 24 }}>
                <input
                  className="emoji-search"
                  type="text"
                  placeholder="Search"
                  aria-label="Search emojis"
                  value={emojiSearch}
                  onChange={(e) => setEmojiSearch(e.target.value)}
                />
              </div>
              <div className="hd" style={{ marginTop: 12, paddingLeft: 8 }}>
                Smileys
              </div>
              <div className="emoji-grid">
                {EMOJI_FACES.map((f) => (
                  <div
                    key={f.id}
                    className="cell"
                    role="menuitem"
                    tabIndex={0}
                    onClick={() => onPick(f.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onPick(f.id);
                    }}
                  >
                    <svg className="f" viewBox="0 0 28 28" aria-hidden="true">
                      <circle
                        cx="14"
                        cy="14"
                        r="11"
                        fill="#f2c230"
                        stroke="#c4921a"
                        strokeWidth="0.8"
                      />
                      <path
                        d={f.eyes}
                        fill="none"
                        stroke="#4a3000"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                      <path
                        d={f.mouth}
                        fill="none"
                        stroke="#4a3000"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            FLYOUT_GROUPS[open].sections?.map((sec, si) => (
              <div key={sec.header || si}>
                {si > 0 && <div className="sp" />}
                {sec.header && <div className="hd">{sec.header}</div>}
                {sec.rows.map((row) => {
                  const isCurrent = tool === row.id || current[open] === row.id;
                  const isFav = favorites.has(row.id);

                  return (
                    <div
                      key={row.id}
                      className={`row ${isCurrent ? "on" : ""}`}
                      role="menuitem"
                      tabIndex={0}
                      onClick={() => onPick(row.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") onPick(row.id);
                      }}
                    >
                      <span className="ic">
                        <svg
                          className="i"
                          viewBox="0 0 28 28"
                          dangerouslySetInnerHTML={{ __html: row.svg }}
                        />
                      </span>
                      <span className="lb">
                        {row.label}
                        {row.hasHelp && <span className="hp">?</span>}
                      </span>
                      {row.shortcut && <span className="ky">{row.shortcut}</span>}
                      <button
                        type="button"
                        className={`st ${isFav ? "fav" : ""}`}
                        aria-label={`${isFav ? "Unfavorite" : "Favorite"} ${row.label}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(row.id);
                        }}
                      >
                        <svg className="s" viewBox="0 0 18 18">
                          <path d="M9 1.8l2.1 4.5 4.9.6-3.6 3.4.9 4.9L9 12.7l-4.3 2.5.9-4.9L2 6.9l4.9-.6z" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </>
  );
}
