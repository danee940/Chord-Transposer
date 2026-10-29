import { detectKey, type KeyDetection } from "./transpose/index";

export interface DetectionBadgeOptions {
  wrap: HTMLElement;
  label: HTMLElement;
  altButton: HTMLElement;
  select: HTMLSelectElement;
  onAltPick?: () => void;
}

export interface DetectionBadge {
  apply(result: KeyDetection | null): void;
  detect(text: string): void;
  markUserPick(): void;
  reset(): void;
}

interface DetectedKey {
  key: string;
  alternate: string | null;
}

export function createDetectionBadge({
  wrap,
  label,
  altButton,
  select,
  onAltPick,
}: DetectionBadgeOptions): DetectionBadge {
  let userPicked = false;
  let current: DetectedKey | null = null;

  function hasOption(value: string): boolean {
    return [...select.options].some((option) => option.value === value);
  }

  function render(): void {
    if (current === null) {
      wrap.classList.add("hidden");
      wrap.classList.remove("inline-flex");
      label.textContent = "";
      altButton.textContent = "";
      altButton.classList.add("hidden");
      return;
    }
    label.textContent = `Detected: ${current.key}`;
    if (current.alternate !== null) {
      altButton.textContent = `or ${current.alternate}?`;
      altButton.classList.remove("hidden");
    } else {
      altButton.textContent = "";
      altButton.classList.add("hidden");
    }
    wrap.classList.remove("hidden");
    wrap.classList.add("inline-flex");
  }

  function apply(result: KeyDetection | null): void {
    current = result?.key ? { key: result.key, alternate: result.alternate } : null;
    if (current !== null && !userPicked && hasOption(current.key)) {
      select.value = current.key;
    }
    render();
  }

  altButton.addEventListener("click", () => {
    if (current === null || current.alternate === null) return;
    current = { key: current.alternate, alternate: current.key };
    userPicked = true;
    if (hasOption(current.key)) {
      select.value = current.key;
    }
    render();
    if (onAltPick) onAltPick();
  });

  return {
    apply,
    detect(text: string): void {
      apply(detectKey(text));
    },
    markUserPick(): void {
      userPicked = true;
    },
    reset(): void {
      userPicked = false;
      current = null;
      render();
    },
  };
}
