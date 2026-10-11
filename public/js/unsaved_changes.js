(() => {
  const sections = new Map();
  const saving = new Set();

  function getUnsavedSnapshot(key) {
    const section = sections.get(key);
    return section ? JSON.stringify(section.read()) : null;
  }

  function hasUnsavedChanges(key = null) {
    return [...sections].some(([name, section]) =>
      (!key || name === key) && getUnsavedSnapshot(name) !== section.saved);
  }

  function refreshUnsavedNotice() {
    const content = document.getElementById("content");
    if (!content) return;
    const names = [...sections].filter(([key, section]) =>
      getUnsavedSnapshot(key) !== section.saved).map(([, section]) => section.label);
    let notice = document.getElementById("unsavedChangesNotice");
    if (!names.length) {
      notice?.remove();
      return;
    }
    if (!notice) {
      notice = document.createElement("p");
      notice.id = "unsavedChangesNotice";
      notice.className = "unsaved-changes-notice";
      notice.setAttribute("role", "status");
      content.prepend(notice);
    }
    notice.textContent = `${names.join(" und ")} wurden noch nicht gespeichert.`;
  }

  function trackUnsavedChanges(key, read, label) {
    sections.set(key, { read, label, saved: JSON.stringify(read()) });
    refreshUnsavedNotice();
  }

  function markChangesSaved(key, snapshot = getUnsavedSnapshot(key)) {
    const section = sections.get(key);
    if (section) section.saved = snapshot;
    refreshUnsavedNotice();
  }

  function resetUnsavedChanges() {
    sections.clear();
    refreshUnsavedNotice();
  }

  function confirmUnsavedChanges() {
    if (saving.size) {
      showAppMessage("Das Speichern läuft noch. Bitte kurz warten.", "warning");
      return false;
    }
    if (!hasUnsavedChanges()) return true;
    return confirm("Änderungen wurden noch nicht gespeichert.\n\nMöchtest du sie verwerfen und fortfahren?");
  }

  window.addEventListener("beforeunload", event => {
    if (hasUnsavedChanges() || saving.size) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  for (const name of ["input", "change"]) {
    document.addEventListener(name, () => queueMicrotask(refreshUnsavedNotice));
  }
  Object.assign(window, {
    trackUnsavedChanges, getUnsavedSnapshot, hasUnsavedChanges, markChangesSaved,
    resetUnsavedChanges, confirmUnsavedChanges, refreshUnsavedNotice,
    setUnsavedSaving: (key, active) => active ? saving.add(key) : saving.delete(key),
  });
})();
