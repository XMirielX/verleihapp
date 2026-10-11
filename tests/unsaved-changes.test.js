const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

function fixture() {
  const elements = new Map();
  const handlers = {};
  const content = { prepend: element => elements.set(element.id, element) };
  const messages = [];
  const context = {
    document: {
      getElementById: id => id === "content" ? content : elements.get(id),
      createElement: () => ({ setAttribute() {}, remove() { elements.delete(this.id); } }),
      addEventListener() {},
    },
    window: { addEventListener: (name, handler) => { handlers[name] = handler; } },
    queueMicrotask,
    confirm: () => false,
    showAppMessage: (...args) => messages.push(args),
  };
  context.window = Object.assign(context, context.window);
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../public/js/unsaved_changes.js"), "utf8"), context);
  return { context, handlers, messages, elements };
}

test("saved baselines detect edits and reverting to original values", () => {
  const f = fixture();
  let quantity = 1;
  f.context.trackUnsavedChanges("plan", () => quantity, "Planungsänderungen");
  assert.equal(f.context.hasUnsavedChanges(), false);
  quantity = 2;
  f.context.refreshUnsavedNotice();
  assert.equal(f.context.hasUnsavedChanges(), true);
  assert.match(f.elements.get("unsavedChangesNotice").textContent, /noch nicht gespeichert/);
  quantity = 1;
  f.context.refreshUnsavedNotice();
  assert.equal(f.context.hasUnsavedChanges(), false);
  assert.equal(f.elements.has("unsavedChangesNotice"), false);
});

test("saving invoice headers does not mark their unsaved positions as saved", () => {
  const f = fixture();
  let header = "Original";
  const items = [1];
  f.context.trackUnsavedChanges("header", () => header, "Rechnungsdaten");
  f.context.trackUnsavedChanges("items", () => items, "Rechnungspositionen");
  header = "Changed";
  items.push(2);
  f.context.markChangesSaved("header");
  assert.equal(f.context.hasUnsavedChanges("header"), false);
  assert.equal(f.context.hasUnsavedChanges("items"), true);
  assert.match(f.elements.get("unsavedChangesNotice").textContent, /Rechnungspositionen/);
});

test("edits made during a save remain unsaved when its captured snapshot is confirmed", () => {
  const f = fixture();
  let value = 1;
  f.context.trackUnsavedChanges("plan", () => value, "Planung");
  value = 2;
  const submitted = f.context.getUnsavedSnapshot("plan");
  value = 3;
  f.context.markChangesSaved("plan", submitted);
  assert.equal(f.context.hasUnsavedChanges(), true);
});

test("cancelled discard leaves changes intact and accepting permits navigation", () => {
  const f = fixture();
  let value = 1;
  f.context.trackUnsavedChanges("plan", () => value, "Planung");
  value = 2;
  assert.equal(f.context.confirmUnsavedChanges(), false);
  assert.equal(f.context.hasUnsavedChanges(), true);
  f.context.confirm = () => true;
  assert.equal(f.context.confirmUnsavedChanges(), true);
  f.context.resetUnsavedChanges();
  assert.equal(f.context.hasUnsavedChanges(), false);
});

test("browser closing warns only when there are changes or a save is pending", () => {
  const f = fixture();
  let warned = false;
  const event = { preventDefault() { warned = true; } };
  f.handlers.beforeunload(event);
  assert.equal(warned, false);
  f.context.setUnsavedSaving("items", true);
  f.handlers.beforeunload(event);
  assert.equal(warned, true);
  assert.equal(f.context.confirmUnsavedChanges(), false);
  assert.equal(f.messages[0][1], "warning");
  f.context.setUnsavedSaving("items", false);
  assert.equal(f.context.confirmUnsavedChanges(), true);
});
