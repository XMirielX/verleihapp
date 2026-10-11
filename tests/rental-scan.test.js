const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

function fixture(response) {
  const messages = { textContent: "", className: "" };
  const input = { value: "123", focus() { context.document.activeElement = this; } };
  const context = {
    console: { error() {} },
    window: { innerWidth: 390 },
    navigator: {},
    alert() { throw new Error("Unexpected blocking alert"); },
    document: {
      body: { dataset: { mode: "rent" } },
      getElementById: id => ({ barcodeInput: input, result: messages, eventSelect: { value: "1" } })[id],
    },
    fetch: async () => response,
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../public/js/rental.js"), "utf8"), context);
  context.loadRentals = async () => {};
  return { context, messages, input };
}

test("successful rental, return and cancellation show green inline messages and restore focus", async () => {
  for (const status of ["wird ausgeliehen", "wird erneut ausgeliehen", "zurückgegeben", "storniert"]) {
    const f = fixture({ ok: true, json: async () => ({ results: [{ Code: 123, product: "Kabel 001", status }] }) });
    await f.context.handleScan("123");
    assert.match(f.messages.className, /message-success/);
    assert.match(f.messages.textContent, /Kabel 001/);
    assert.equal(f.messages.textContent, `Kabel 001 ${
      status === "wird ausgeliehen" ? "wurde ausgeliehen" :
      status === "wird erneut ausgeliehen" ? "wurde erneut ausgeliehen" :
      status === "zurückgegeben" ? "wurde zurückgegeben" : "wurde storniert"
    } (123)`);
    assert.equal(f.input.value, "");
    assert.equal(f.context.document.activeElement, f.input);
  }
});

test("HTTP 200 responses containing rejected scans show red messages", async () => {
  for (const status of ["nicht gefunden", "Produkt nicht gefunden", "bereits verliehen", "nicht verliehen"]) {
    const f = fixture({ ok: true, json: async () => ({ results: [{ Code: 123, status }] }) });
    await f.context.handleScan("123");
    assert.match(f.messages.className, /message-error/);
    assert.match(f.messages.textContent, new RegExp(status));
    assert.equal(f.context.document.activeElement, f.input);
  }
});

test("server failures show inline errors without alerts", async () => {
  const f = fixture({ ok: false, json: async () => ({ error: "Speichern fehlgeschlagen" }) });
  await f.context.handleScan("123");
  assert.equal(f.messages.textContent, "Speichern fehlgeschlagen");
  assert.match(f.messages.className, /message-error/);
  assert.equal(f.context.document.activeElement, f.input);
});

test("finishing a previous scan does not erase the next barcode being entered", async () => {
  const f = fixture();
  let respond;
  f.context.fetch = () => new Promise(resolve => { respond = resolve; });
  const pending = f.context.handleScan("123");
  assert.equal(f.input.value, "");
  f.input.value = "456";
  respond({ ok: true, json: async () => ({ results: [{ Code: 123, status: "wird ausgeliehen" }] }) });
  await pending;
  assert.equal(f.input.value, "456");
});

test("missing event and missing barcode show inline validation messages", async () => {
  const f = fixture();
  f.input.value = "";
  await f.context.handleRentalAction("/api/rentals");
  assert.match(f.messages.textContent, /Bitte Barcode/);
  const original = f.context.document.getElementById;
  f.context.document.getElementById = id => id === "eventSelect" ? { value: "" } : original(id);
  await f.context.handleRentalAction("/api/rentals");
  assert.equal(f.messages.textContent, "Kein Event ausgewählt");
});
