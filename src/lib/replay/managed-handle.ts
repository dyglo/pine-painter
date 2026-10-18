// The indicator runner owns a handle across native workspace rebuilds. Resolve its
// removal against the CURRENT chart, including restored sessions. A cancelled new
// candidate removes only itself; retiring the previous candidate removes the
// previous logical agent indicator, never the newly accepted one.
export const MANAGED_PREFIX = "deplyze-agent-";
export class ManagedHandles {
  private latest = "";
  constructor(private current: () => { id: string; remove(): void }[]) {}
  candidate(id: string) {
    this.latest = id;
    return {
      remove: () => {
        for (const handle of this.current()) {
          if (
            id === this.latest
              ? handle.id === id
              : handle.id.startsWith(MANAGED_PREFIX) && handle.id !== this.latest
          )
            handle.remove();
        }
      },
    };
  }
}
