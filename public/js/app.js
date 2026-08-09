const pages = {
  // =====================================================
  // VERLEIH
  // =====================================================

  rentals: {
    title: "Übersicht",
    group: "Verleih",
    roles: ["admin", "user"],
    scripts: ["js/rental.js"],
    init: "initRentalPage",
  },

  rentaladd: {
    title: "Ausleihen",
    group: "Verleih",
    roles: ["admin", "user"],
    scripts: ["js/rental.js"],
    init: "initRentalPage",
  },

  rentalback: {
    title: "Zurückgeben",
    group: "Verleih",
    roles: ["admin", "user"],
    scripts: ["js/rental.js"],
    init: "initRentalPage",
  },

  rentalstorno: {
    title: "Stornieren",
    group: "Verleih",
    roles: ["admin", "user"],
    scripts: ["js/rental.js"],
    init: "initRentalPage",
  },

  // =====================================================
  // PLANUNG
  // =====================================================

  planning: {
    title: "Material",
    group: "Planung",
    roles: ["admin", "lese", "user"],
    scripts: ["js/planning.js"],
    init: "initPlanningPage",
  },

  distributions_plan: {
    title: "Verteiler",
    group: "Planung",
    roles: ["admin", "lese", "user"],
    scripts: ["js/distribution_plan.js", "js/distribution_image.js"],
    init: "initDistributionPlanPage",
  },

  // =====================================================
  // PRODUKTE
  // =====================================================

  products: {
    title: "Übersicht",
    group: "Produkte",
    roles: ["admin", "user", "lese"],
    scripts: ["js/product.js"],
    init: "initProductPage",
  },

  productadd: {
    title: "Hinzufügen",
    group: "Produkte",
    roles: ["admin"],
    scripts: ["js/product.js"],
    init: "initProductPage",
  },

  distributions: {
    title: "Verteiler",
    group: "Produkte",
    roles: ["admin"],
    scripts: ["js/distributions.js", "js/distribution_image.js"],
    init: "initDistributionPage",
  },

  material: {
    title: "Material",
    group: "Produkte",
    roles: ["admin"],
    scripts: ["js/material.js"],
    init: "initMaterialPage",
  },

  // =====================================================
  // EVENTS
  // =====================================================

  events: {
    title: "Übersicht",
    group: "Events",
    roles: ["admin", "user"],
    scripts: ["js/event.js"],
    init: "initEventPage",
  },

  eventadd: {
    title: "Hinzufügen",
    group: "Events",
    roles: ["admin", "user"],
    scripts: ["js/event.js"],
    init: "initEventPage",
  },

  // =====================================================
  // ADMIN
  // =====================================================

  admin: {
    title: "Benutzer",
    roles: ["admin"],
    scripts: ["js/user.js"],
    init: "initUserPage",
  },

  // =====================================================
  // START
  // =====================================================

  home: {
    title: "Start",
    roles: ["admin", "user", "lese"],
    scripts: [],
    init: null,
  },
};

let currentUser = null;
function renderMenu() {

    const container = document.querySelector(".sidebar-menu");
    if (!container) return;

    container.innerHTML = "";

    const groups = {};

    // =====================================================
    // Nur Seiten sammeln, für die der User berechtigt ist
    // =====================================================

    Object.entries(pages).forEach(([page, config]) => {

        const allowedRoles = config.roles || ["admin"];

        if (!currentUser || !allowedRoles.includes(currentUser.role)) {
            return;
        }

        const groupName = config.group || "Einzeln";

        if (!groups[groupName]) {
            groups[groupName] = [];
        }

        groups[groupName].push({
            page,
            title: config.title
        });
    });


    // =====================================================
    // Menü aufbauen
    // =====================================================

    Object.entries(groups).forEach(([groupName, items]) => {

        // Einzelner Menüpunkt
        if (groupName === "Einzeln") {

            items.forEach(item => {

                const button = document.createElement("button");

                button.textContent = item.title;
                button.dataset.page = item.page;

                container.appendChild(button);
            });

            return;
        }


        // Menügruppe
        const menuGroup = document.createElement("div");
        menuGroup.className = "menu-group";

        const parent = document.createElement("button");
        parent.className = "menu-parent";
        parent.textContent = groupName;

        const submenu = document.createElement("div");
        submenu.className = "submenu";


        // Unterpunkte
        items.forEach(item => {

            const button = document.createElement("button");

            button.className = "submenu-item";
            button.textContent = item.title;
            button.dataset.page = item.page;

            submenu.appendChild(button);
        });


        // Gruppe öffnen/schließen
        parent.addEventListener("click", () => {

            document.querySelectorAll(".menu-group")
                .forEach(other => {

                    if (other !== menuGroup) {
                        other.classList.remove("open");
                    }

                });

            menuGroup.classList.toggle("open");
        });


        menuGroup.appendChild(parent);
        menuGroup.appendChild(submenu);

        container.appendChild(menuGroup);
    });


    // =====================================================
    // Navigation
    // =====================================================

    document.querySelectorAll("[data-page]")
        .forEach(button => {

            button.addEventListener("click", async () => {

                await loadPage(button.dataset.page);

                closeMenu();
            });

        });
}
document.addEventListener("DOMContentLoaded", async () => {

    const user = await checkLogin();

    if (!user) return;

    renderMenu();
    setupMobileMenu();

    await loadPage("home");
});


async function loadPage(page) {
  await checkLogin();
  window.currentPage = page;
  const content = document.getElementById("content");
  if (!content) return;
  try {
    const response = await fetch(`pages/${page}.html`);
    if (!response.ok) {
      throw new Error(`Seite nicht gefunden: ${page}`);
    }
    const html = await response.text();
    content.innerHTML = html;
    if (page === "home") {
    updateHomeQuickActions();
}
    // Seitentitel aktualisieren
    const title = document.getElementById("pageTitle");
    if (title) {
      const pageConfig = pages[page];
      title.textContent = pageConfig?.title || page;
    }
    // Seitenspezifisches JavaScript laden
    await loadPageScript(page);
    // aktive Menümarkierung
    setActiveMenu(page);
  } catch (error) {
    console.error(error);
    content.innerHTML = `
            <h2>Fehler</h2>
            <p>Die Seite konnte nicht geladen werden.</p>
        `;
  }
}
async function loadPageScript(page) {
  const config = pages[page];
  if (!config) {
    console.log("Keine Konfiguration für:", page);
    return;
  }
  for (const src of config.scripts) {
    if (!document.querySelector(`script[src^="${src}"]`)) {
      await new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = src;
        script.onload = resolve;
        document.body.appendChild(script);
      });
    }
  }
  const initFunction = window[config.init];
  if (typeof initFunction === "function") {
    initFunction(page);
  }
}
function loadScript(src) {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = `${src}?v=${Date.now()}`;
    script.dataset.pageScript = "true";

    script.onload = resolve;

    document.body.appendChild(script);
  });
}

function setActiveMenu(page) {
  document.querySelectorAll(".sidebar-menu button").forEach((button) => {
    button.classList.remove("active");
    if (button.dataset.page === page) {
      button.classList.add("active");
    }
  });
}
// =====================================================
// Mobile Navigation
// =====================================================

function setupMobileMenu() {
  const menuButton = document.getElementById("menuButton");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");

  if (!menuButton || !sidebar || !overlay) {
    console.log("Mobile Menü Elemente fehlen");
    return;
  }

  menuButton.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    overlay.classList.toggle("show");
  });

  overlay.addEventListener("click", () => {
    closeMenu();
  });
}

function closeMenu() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");

  if (sidebar) {
    sidebar.classList.remove("open");
  }

  if (overlay) {
    overlay.classList.remove("show");
  }
}

async function checkLogin() {
  try {
    const res = await fetch("/api/users/me", {
      credentials: "include",
    });

    if (!res.ok) {
      if (!window.location.pathname.includes("login.html")) {
        localStorage.setItem("lastPage", window.location.pathname);

        window.location.href = "login.html";
      }

      return null;
    }

    const user = await res.json();

    currentUser = user;

    const el = document.getElementById("userInfo");

    if (el) {
      el.innerText = `Eingeloggt als: ${user.username} (${user.role})`;
    }

    return user;
  } catch (err) {
    console.error("Fehler beim Laden des Users:", err);

    if (!window.location.pathname.includes("login.html")) {
      localStorage.setItem("lastPage", window.location.pathname);

      window.location.href = "login.html";
    }

    return null;
  }
}
function updateHomeQuickActions() {

    if (!currentUser) return;

    document
        .querySelectorAll(".quick-actions .card")
        .forEach(card => {

            const roles = card.dataset.roles
                ? card.dataset.roles.split(",")
                : [];

            if (!roles.includes(currentUser.role)) {
                card.style.display = "none";
            } else {
                card.style.display = "";
            }

        });
}
async function logout() {

    try {

        await fetch("/api/users/logout", {
            method: "POST",
            credentials: "include"
        });

    } catch (err) {
        console.error("Logout-Fehler:", err);
    }

    currentUser = null;

    window.location.href = "login.html";
}
