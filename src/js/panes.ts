export interface ScrollMetrics {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

export function scaledScrollTop(source: ScrollMetrics, target: ScrollMetrics): number {
  const sourceRange = source.scrollHeight - source.clientHeight;
  const targetRange = target.scrollHeight - target.clientHeight;
  if (sourceRange <= 0 || targetRange <= 0) return 0;
  const ratio = source.scrollTop / sourceRange;
  return ratio * targetRange;
}

export function initSyncedPanes(): void {
  const panes = Array.from(document.querySelectorAll<HTMLElement>("[data-sync-scroll]"));
  if (panes.length < 2) return;

  let syncing = false;

  function syncFrom(source: HTMLElement): void {
    if (syncing) return;
    syncing = true;
    for (const target of panes) {
      if (target === source) continue;
      target.scrollTop = scaledScrollTop(source, target);
    }
    requestAnimationFrame(() => {
      syncing = false;
    });
  }

  for (const pane of panes) {
    pane.addEventListener("scroll", () => syncFrom(pane));
  }
}
