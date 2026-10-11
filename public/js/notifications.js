(() => {
  const pendingKey = "pendingAppMessage";
  let timeout = null;

  function showAppMessage(message, type = "success") {
    let container = document.getElementById("appNotifications");
    if (!container) {
      container = document.createElement("div");
      container.id = "appNotifications";
      container.setAttribute("role", "status");
      container.setAttribute("aria-live", "polite");
      container.setAttribute("aria-atomic", "true");
      document.body.appendChild(container);
    }

    clearTimeout(timeout);
    const notice = document.createElement("div");
    notice.className = `app-notification app-notification-${type}`;
    const text = document.createElement("span");
    text.textContent = message || "Aktion erfolgreich abgeschlossen";
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "app-notification-dismiss";
    dismiss.textContent = "×";
    dismiss.setAttribute("aria-label", "Meldung schließen");
    dismiss.addEventListener("click", () => {
      clearTimeout(timeout);
      container.replaceChildren();
    });
    notice.append(text, dismiss);
    container.replaceChildren(notice);
    if (type === "success") {
      timeout = setTimeout(() => container.replaceChildren(), 6000);
    }
  }

  function queueAppMessage(message, type = "success") {
    try {
      sessionStorage.setItem(pendingKey, JSON.stringify({ message, type }));
    } catch {
      showAppMessage(message, type);
    }
  }

  function restorePendingMessage() {
    try {
      const pending = sessionStorage.getItem(pendingKey);
      sessionStorage.removeItem(pendingKey);
      if (pending) {
        const { message, type } = JSON.parse(pending);
        showAppMessage(message, type);
      }
    } catch {
      // Notifications must not prevent the page from opening.
    }
  }

  Object.assign(window, { showAppMessage, queueAppMessage });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", restorePendingMessage);
  } else {
    restorePendingMessage();
  }
})();
