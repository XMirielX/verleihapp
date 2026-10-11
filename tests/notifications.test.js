const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

function fixture() {
  const elements = new Map();
  const storage = new Map();
  const timers = new Map();
  let timerId = 0;
  const createElement = () => ({
    children: [], attributes: {}, handlers: {},
    setAttribute(key, value) { this.attributes[key] = value; },
    append(...children) { this.children.push(...children); },
    appendChild(child) { this.children.push(child); if (child.id) elements.set(child.id, child); },
    replaceChildren(...children) { this.children = children; },
    addEventListener(event, handler) { this.handlers[event] = handler; },
  });
  const context = {
    document: { readyState: "complete", body: createElement(), getElementById: id => elements.get(id), createElement },
    sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    setTimeout: handler => { timers.set(++timerId, handler); return timerId; },
    clearTimeout: id => timers.delete(id),
  };
  context.window = context;
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, "../public/js/notifications.js"), "utf8");
  vm.runInContext(source, context);
  return { context, elements, storage, timers, source };
}

test("success messages are accessible, non-blocking and dismiss automatically", () => {
  const f = fixture();
  f.context.showAppMessage("Gespeichert");
  const container = f.elements.get("appNotifications");
  assert.equal(container.attributes["aria-live"], "polite");
  assert.equal(container.children[0].className, "app-notification app-notification-success");
  assert.equal(container.children[0].children[0].textContent, "Gespeichert");
  assert.equal(f.timers.size, 1);
  [...f.timers.values()][0]();
  assert.equal(container.children.length, 0);
});

test("a new success replaces the previous notice and resets its timer", () => {
  const f = fixture();
  f.context.showAppMessage("Erste Aktion");
  f.context.showAppMessage("Zweite Aktion");
  assert.equal(f.context.document.body.children.length, 1);
  assert.equal(f.timers.size, 1);
  assert.equal(f.elements.get("appNotifications").children[0].children[0].textContent, "Zweite Aktion");
});

test("warnings persist until dismissed and cancel an earlier success timer", () => {
  const f = fixture();
  f.context.showAppMessage("Gespeichert");
  f.context.showAppMessage("Dropbox-Upload fehlgeschlagen", "warning");
  assert.equal(f.timers.size, 0);
  const container = f.elements.get("appNotifications");
  container.children[0].children[1].handlers.click();
  assert.equal(container.children.length, 0);
});

test("queued password-change feedback survives a full-page redirect and is shown once", () => {
  const f = fixture();
  f.context.queueAppMessage("Passwort geändert");
  assert.equal(f.elements.has("appNotifications"), false);
  vm.runInContext(f.source, f.context);
  assert.equal(f.elements.get("appNotifications").children[0].children[0].textContent, "Passwort geändert");
  assert.equal(f.storage.size, 0);
});

test("messages containing markup are rendered as text", () => {
  const f = fixture();
  f.context.showAppMessage('<img src=x onerror="alert(1)">');
  const label = f.elements.get("appNotifications").children[0].children[0];
  assert.equal(label.textContent, '<img src=x onerror="alert(1)">');
  assert.equal(label.children.length, 0);
});
