import { writeFile } from "node:fs/promises";
import { pdfConversionFailureMarker } from "../support/environment";
import { sheets, uploadFile } from "../support/files";
import { expect, test } from "../support/test";

const MEGABYTE = 1024 * 1024;

test.beforeEach(async ({ home }) => {
  await home.goto();
  await home.openTab("upload");
});

test.describe("rejecting files before upload", () => {
  const cases = [
    {
      title: "an unsupported file type",
      files: [uploadFile("notes.pdf", "%PDF-1.4")],
      message: "Unsupported file type. Upload .docx, .txt, .pro, or .cho.",
    },
    {
      title: "an empty file",
      files: [uploadFile("empty.docx", "")],
      message: "The selected file is empty.",
    },
    {
      title: "a file over 10 MB",
      files: [uploadFile("huge.txt", Buffer.alloc(10 * MEGABYTE + 1, "C "))],
      message: "File is too large. The maximum size is 10 MB.",
    },
  ];

  for (const { title, files, message } of cases) {
    test(`rejects ${title}`, async ({ home }) => {
      const { upload } = home;
      await upload.choose(...files);
      await expect(upload.message).toHaveText(message);
      await expect(upload.message).toHaveClass(/notice-error/);
      await expect(upload.dropzoneText).toContainText("Drop your chord sheets here");
      await expect(upload.fileInput).toHaveJSProperty("files.length", 0);
    });
  }

  const binderCases = [
    {
      title: "a non-.docx file in the binder",
      files: [sheets.amazingGraceDocx(), sheets.plainText()],
      flagged: "Twinkle_C.txt",
      reason: "Only .docx files can go in a binder.",
    },
    {
      title: "an empty file in the binder",
      files: [sheets.amazingGraceDocx(), uploadFile("empty.docx", "")],
      flagged: "empty.docx",
      reason: "This file is empty.",
    },
  ];

  for (const { title, files, flagged, reason } of binderCases) {
    test(`flags ${title} and keeps the rest of the selection`, async ({ home }) => {
      const { upload } = home;
      await upload.choose(...files);
      await expect(upload.message).toHaveText("Remove the highlighted file to build the binder.");
      await expect(upload.fileRow(flagged)).toHaveAttribute("data-invalid");
      await expect(upload.fileRow(flagged)).toContainText(reason);
      await expect(upload.fileInput).toHaveJSProperty("files.length", 2);

      await upload.remove(flagged);
      await expect(upload.message).toBeHidden();
      await expect(upload.fileInput).toHaveJSProperty("files.length", 1);
      await expect(upload.preview).toBeVisible();
    });
  }

  test("rejects more than 20 binder files", async ({ home }) => {
    const { upload } = home;
    await upload.choose(
      ...Array.from({ length: 21 }, (_, index) => uploadFile(`song-${index}.docx`, "x"))
    );
    await expect(upload.message).toHaveText("Too many files. The maximum is 20.");
    await expect(upload.fileList.locator("li")).toHaveCount(21);
  });

  test("rejects binder files over 40 MB combined", async ({ home }, testInfo) => {
    const paths = await Promise.all(
      Array.from({ length: 5 }, async (_, index) => {
        const path = testInfo.outputPath(`large-${index}.docx`);
        await writeFile(path, Buffer.alloc(9 * MEGABYTE, 1));
        return path;
      })
    );
    await home.upload.fileInput.setInputFiles(paths);
    await expect(home.upload.message).toHaveText(
      "Files are too large. The combined maximum is 40 MB."
    );
  });

  test("asks for a file when none is chosen", async ({ home, page }) => {
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await home.upload.submitButton.click();
    await expect(home.upload.message).toHaveText("Please choose a file to upload.");
    await expect(home.upload.message).toHaveClass(/notice-error/);
    expect(requests.filter((url) => url.includes("/transpose"))).toEqual([]);
  });

  test("clears an earlier error when a valid file is chosen", async ({ home }) => {
    const { upload } = home;
    await upload.choose(uploadFile("notes.pdf", "%PDF-1.4"));
    await expect(upload.message).toBeVisible();
    await upload.choose(sheets.plainText());
    await expect(upload.message).toBeHidden();
    await expect(upload.preview).toBeVisible();
  });
});

test.describe("reporting server errors", () => {
  test("reports a .docx the server cannot read @mobile", async ({ home }) => {
    const { upload } = home;
    await upload.choose(uploadFile("broken.docx", "this is not a zip archive"));
    await expect(upload.preview).toBeHidden();
    await upload.submitButton.click();
    await expect(upload.message).toHaveText("Could not read the file as a valid .docx document.");
    await expect(upload.submitButton).toBeEnabled();
  });

  test("flags the binder song the server cannot read", async ({ home }) => {
    const { upload } = home;
    await upload.choose(sheets.amazingGraceDocx(), uploadFile("broken.docx", "not a zip archive"));
    await upload.submitButton.click();
    await expect(upload.message).toHaveText(
      "Could not read broken.docx as a valid .docx document."
    );
    await expect(upload.fileRow("broken.docx")).toHaveAttribute("data-invalid");
    await expect(upload.fileRow("Amazing_Grace_C.docx")).not.toHaveAttribute("data-invalid");
  });

  test("reports a text file that is not UTF-8", async ({ home }) => {
    const { upload } = home;
    await upload.choose(uploadFile("latin1.txt", Buffer.from("C  G\nCaf\xe9\n", "latin1")));
    await upload.submitButton.click();
    await expect(upload.message).toHaveText("The file must be UTF-8 encoded text.");
  });

  test("reports a failed PDF conversion", async ({ home }) => {
    const { upload } = home;
    await upload.choose(uploadFile("Unconvertible.txt", `C  G\n${pdfConversionFailureMarker}\n`));
    await upload.chooseFormat("pdf");
    await upload.submitButton.click();
    await expect(upload.message).toHaveText(
      "The PDF conversion service failed to convert the document."
    );
  });

  test("reports a network failure", async ({ home, page }) => {
    await page.route("/transpose", (route) => route.abort());
    await home.upload.choose(sheets.amazingGraceDocx());
    await home.upload.submitButton.click();
    await expect(home.upload.message).toHaveText("Network error. Please try again.");
    await expect(home.upload.submitButton).toBeEnabled();
  });

  test("falls back to a generic message for unexpected responses", async ({ home, page }) => {
    await page.route("/transpose", (route) =>
      route.fulfill({ status: 502, contentType: "text/html", body: "<h1>Bad gateway</h1>" })
    );
    await home.upload.choose(sheets.amazingGraceDocx());
    await home.upload.submitButton.click();
    await expect(home.upload.message).toHaveText("Something went wrong.");
  });
});
