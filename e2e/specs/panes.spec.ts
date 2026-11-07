import { expect, test } from "../support/test";

const LONG_SHEET = Array.from({ length: 120 }, (_, line) =>
  line % 2 === 0 ? "C   G   Am   F" : `Lyric line ${line}`
).join("\n");

test("scrolling the input scrolls the output in step", async ({ home }) => {
  const { paste } = home;
  await home.goto();
  await paste.enter(LONG_SHEET);
  await expect(paste.chord("Bm").first()).toBeVisible();

  await paste.input.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event("scroll"));
  });
  await expect
    .poll(() =>
      paste.output.evaluate(
        (element) => element.scrollTop / (element.scrollHeight - element.clientHeight)
      )
    )
    .toBeGreaterThan(0.95);
});

test("shows one sheet at a time on a phone and both side by side on a desktop @mobile", async ({
  home,
  isMobile,
}) => {
  const { paste } = home;
  await home.goto();
  await paste.enter("C   G   Am   F");
  await expect(paste.input).toBeVisible();

  if (isMobile) {
    await expect(paste.output).toBeHidden();
    await paste.showTransposed();
    await expect(paste.chord("D")).toBeVisible();
    await expect(paste.input).toBeHidden();
  } else {
    await expect(paste.transposedSheetToggle).toBeHidden();
    await expect(paste.chord("D")).toBeVisible();
  }
});
