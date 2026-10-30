import { beforeEach, describe, expect, it } from "vitest";

import { createChangesDisclosure, type ChangesDisclosure } from "./changes-disclosure";
import { requireElement } from "./dom";

function init(): ChangesDisclosure {
  document.body.innerHTML = `
    <div id="wrap" class="hidden">
      <button id="toggle" aria-expanded="false"><svg id="caret"></svg><span id="label"></span></button>
      <div id="list" class="hidden"></div>
    </div>
  `;
  return createChangesDisclosure({
    wrap: requireElement("wrap"),
    toggle: requireElement("toggle"),
    label: requireElement("label"),
    caret: requireElement("caret"),
    list: requireElement("list"),
  });
}

function row(text: string): HTMLElement {
  const element = document.createElement("div");
  element.textContent = text;
  return element;
}

describe("createChangesDisclosure", () => {
  let disclosure: ChangesDisclosure;

  beforeEach(() => {
    disclosure = init();
  });

  it("shows the rows collapsed with a counted label", () => {
    disclosure.show([row("a"), row("b")]);
    expect(requireElement("wrap").classList.contains("hidden")).toBe(false);
    expect(requireElement("list").classList.contains("hidden")).toBe(true);
    expect(requireElement("list").children).toHaveLength(2);
    expect(requireElement("label").textContent).toBe("Show 2 chord changes");
  });

  it("toggles between expanded and collapsed", () => {
    disclosure.show([row("a")]);
    requireElement("toggle").click();
    expect(requireElement("list").classList.contains("hidden")).toBe(false);
    expect(requireElement("toggle").getAttribute("aria-expanded")).toBe("true");
    expect(requireElement("caret").classList.contains("rotate-90")).toBe(true);
    expect(requireElement("label").textContent).toBe("Hide 1 chord change");

    requireElement("toggle").click();
    expect(requireElement("list").classList.contains("hidden")).toBe(true);
    expect(requireElement("label").textContent).toBe("Show 1 chord change");
  });

  it("collapses again when new rows arrive", () => {
    disclosure.show([row("a")]);
    requireElement("toggle").click();
    disclosure.show([row("b"), row("c"), row("d")]);
    expect(requireElement("list").classList.contains("hidden")).toBe(true);
    expect(requireElement("label").textContent).toBe("Show 3 chord changes");
  });

  it("hides and empties the list", () => {
    disclosure.show([row("a")]);
    disclosure.hide();
    expect(requireElement("wrap").classList.contains("hidden")).toBe(true);
    expect(requireElement("list").children).toHaveLength(0);
    expect(requireElement("label").textContent).toBe("Show 0 chord changes");
  });
});
