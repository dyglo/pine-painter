import { useState } from "react";
import {
  ChevronsLeft,
  ChevronsRight,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react";
import type { ReplayHost, ReplayHostView } from "@/lib/replay/workspace";
import { REPLAY_VERIFIED } from "@/lib/replay/versions";

const utcInput = (time: number) => new Date(time).toISOString().slice(0, 16);
export function BarReplayControls({
  state,
  host,
}: {
  state: ReplayHostView;
  host: ReplayHost | null;
}) {
  const [date, setDate] = useState(() => utcInput(Date.now() - 7 * 86400000));
  const [selection, setSelection] = useState<number | null>(null);
  const dataset = state.dataset;
  const view = state.view;
  const busy = state.loading || view?.status === "calculating";
  const active = !!dataset && !!view;
  const closedAt = active ? dataset.bars[view.cursor]!.time + dataset.interval : null;
  const goToDate = () => {
    const time = Date.parse(`${date}:00Z`);
    if (dataset && host) {
      const cursor = dataset.bars.filter((bar) => bar.time + dataset.interval <= time).length - 1;
      if (cursor >= dataset.warmup && time <= dataset.coverage.lastClose) void host.seek(cursor);
      else setSelection(-1);
    } else void host?.enter(time);
  };
  return (
    <div className="replay-strip" role="region" aria-label="Bar Replay">
      <div className="replay-tools">
        <span className={active ? "replay-status replay-active" : "replay-status"}>
          <span className="replay-dot" />
          {active ? "REPLAY MODE" : "BAR REPLAY"}
        </span>
        <label className="replay-date">
          Closed candle · UTC
          <input
            aria-label="Historical closed candle time in UTC"
            type="datetime-local"
            value={date}
            max={utcInput(Date.now())}
            onChange={(event) => {
              setDate(event.target.value);
              setSelection(null);
            }}
            disabled={busy}
          />
        </label>
        <button
          type="button"
          className="replay-command"
          disabled={busy || !state.ready || !REPLAY_VERIFIED}
          onClick={goToDate}
        >
          {active ? "Go to candle" : "Enter Replay"}
        </button>
        {!active && state.saved && (
          <button
            type="button"
            className="replay-command"
            disabled={busy || !REPLAY_VERIFIED}
            onClick={() => void host?.restore()}
          >
            <RotateCcw size={13} /> Restore session
          </button>
        )}
        {active && (
          <>
            <span className="replay-divider" />
            <button
              type="button"
              title="First replay candle"
              aria-label="First replay candle"
              disabled={busy || view.cursor === dataset.warmup}
              onClick={() => void host?.seek(dataset.warmup)}
            >
              <ChevronsLeft size={15} />
            </button>
            <button
              type="button"
              title="Previous candle"
              aria-label="Previous candle"
              disabled={busy || view.cursor === dataset.warmup}
              onClick={() => void host?.previous()}
            >
              <SkipBack size={15} />
            </button>
            <button
              type="button"
              title={view.status === "playing" ? "Pause replay" : "Play replay"}
              aria-label={
                view.status === "playing" || (busy && active) ? "Pause replay" : "Play replay"
              }
              disabled={view.status === "ended" || view.status === "error"}
              onClick={() => (view.status === "playing" || busy ? host?.pause() : host?.play())}
            >
              {view.status === "playing" || busy ? <Pause size={15} /> : <Play size={15} />}
            </button>
            <button
              type="button"
              title="Next candle"
              aria-label="Next candle"
              disabled={busy || view.cursor === dataset.bars.length - 1}
              onClick={() => void host?.next()}
            >
              <SkipForward size={15} />
            </button>
            <button
              type="button"
              title="Final replay candle"
              aria-label="Final replay candle"
              disabled={busy || view.cursor === dataset.bars.length - 1}
              onClick={() => void host?.seek(dataset.bars.length - 1)}
            >
              <ChevronsRight size={15} />
            </button>
            <label className="replay-speed">
              Speed{" "}
              <select
                aria-label="Replay playback speed"
                value={view.speed}
                onChange={(event) => host?.speed(Number(event.target.value))}
              >
                {[0.5, 1, 2, 5, 10].map((value) => (
                  <option key={value} value={value}>
                    {value}×
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="replay-command replay-exit"
              disabled={busy}
              onClick={() => void host?.exit()}
            >
              <X size={13} /> Exit Replay
            </button>
          </>
        )}
        <a
          className="replay-attribution"
          href="https://velacharts.dev"
          target="_blank"
          rel="noreferrer"
        >
          Charts by Vela
        </a>
      </div>
      {active && (
        <div className="replay-progress">
          <span className="replay-time">{utcInput(closedAt!).replace("T", " ")} UTC</span>
          <input
            aria-label="Replay candle position"
            type="range"
            min={dataset.warmup}
            max={dataset.bars.length - 1}
            value={selection != null && selection >= 0 ? selection : view.cursor}
            disabled={busy}
            onChange={(event) => setSelection(Number(event.target.value))}
            onPointerUp={(event) => {
              void host?.seek(Number(event.currentTarget.value));
              setSelection(null);
            }}
            onKeyUp={(event) => {
              if (
                ["ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(event.key)
              ) {
                void host?.seek(Number(event.currentTarget.value));
                setSelection(null);
              }
            }}
          />
          <span>
            {view.cursor - dataset.warmup + 1} / {dataset.bars.length - dataset.warmup}
          </span>
          <span role="status">
            {busy
              ? "Calculating…"
              : view.status === "ended"
                ? "Complete · frozen"
                : view.status === "playing"
                  ? "Playing"
                  : "Paused"}
          </span>
          <span
            className="replay-coverage"
            title="Missing intervals are recorded, never filled with invented candles"
          >
            {dataset.warmup} warm-up · {dataset.coverage.gaps.length} gaps ·{" "}
            {dataset.id.slice(0, 8)}
          </span>
        </div>
      )}
      {(state.error || view?.error || selection === -1 || !REPLAY_VERIFIED) && (
        <p className="replay-error" role="alert">
          {!REPLAY_VERIFIED
            ? "Replay disabled: engine versions have not passed correctness verification."
            : state.error ||
              view?.error ||
              "This date is outside the session's warm-up and coverage. Exit Replay to load another range."}
        </p>
      )}
    </div>
  );
}
