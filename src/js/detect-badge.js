import { detectKey } from "./transpose/index.js";

export function createDetectionBadge({ wrap, label, altButton, select, onAltPick }) {
  let userPicked = false;
  let current = null;

  function hasOption(value) {
    return [...select.options].some((option) => option.value === value);
  }

  function render() {
    if (!current || !current.key) {
      wrap.classList.add("hidden");
      wrap.classList.remove("inline-flex");
      label.textContent = "";
      altButton.textContent = "";
      altButton.classList.add("hidden");
      return;
    }
    label.textContent = `Detected: ${current.key}`;
    if (current.alternate) {
      altButton.textContent = `or ${current.alternate}?`;
      altButton.classList.remove("hidden");
    } else {
      altButton.textContent = "";
      altButton.classList.add("hidden");
    }
    wrap.classList.remove("hidden");
    wrap.classList.add("inline-flex");
  }

  function apply(result) {
    current = result && result.key ? result : null;
    if (current && !userPicked && hasOption(current.key)) {
      select.value = current.key;
    }
    render();
  }

  altButton.addEventListener("click", () => {
    if (!current || !current.alternate) return;
    current = { ...current, key: current.alternate, alternate: current.key };
    userPicked = true;
    if (hasOption(current.key)) {
      select.value = current.key;
    }
    render();
    if (onAltPick) onAltPick();
  });

  return {
    apply,
    detect(text) {
      apply(detectKey(text));
    },
    markUserPick() {
      userPicked = true;
    },
    reset() {
      userPicked = false;
      current = null;
      render();
    },
  };
}
