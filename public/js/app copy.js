const pages = {

    rentals: {
        title: "Übersicht",
        group: "Verleih",
        scripts: ["js/rental.js"],
        init: "initRentalPage"
    },

    rentaladd: {
        title: "Ausleihen",
        group: "Verleih",
        scripts: ["js/rental.js"],
        init: "initRentalPage"
    },

    rentalback: {
        title: "Zurückgeben",
        group: "Verleih",
        scripts: ["js/rental.js"],
        init: "initRentalPage"
    },

    rentalstorno: {
        title: "Stornieren",
        group: "Verleih",
        scripts: ["js/rental.js"],
        init: "initRentalPage"
    },


    planning: {
        title: "Material",
        group: "Planung",
        scripts: ["js/planning.js"],
        init: "initPlanningPage"
    },

    distributions_plan: {
        title: "Verteiler",
        group: "Planung",
        scripts: [
            "js/distribution_plan.js",
            "js/distribution_images.js"
        ],
        init: "initDistributionPlanPage"
    },


    products: {
        title: "Übersicht",
        group: "Produkte",
        scripts: ["js/product.js"],
        init: "initProductPage"
    },

    productadd: {
        title: "Hinzufügen",
        group: "Produkte",
        scripts: ["js/product.js"],
        init: "initProductPage"
    },

    productcheck: {
        title: "Prüfen",
        group: "Produkte",
        scripts: ["js/productc.js"],
        init: "initProductCheckPage"
    },

    distributions: {
        title: "Verteiler",
        group: "Produkte",
        scripts: [
            "js/distribution.js",
            "js/distribution_images.js"
        ],
        init: "initDistributionPage"
    },

    material: {
        title: "Material",
        group: "Produkte",
        scripts: ["js/material.js"],
        init: "initMaterialPage"
    },


    events: {
        title: "Übersicht",
        group: "Events",
        scripts: ["js/event.js"],
        init: "initEventPage"
    },

    eventadd: {
        title: "Hinzufügen",
        group: "Events",
        scripts: ["js/event.js"],
        init: "initEventPage"
    },


    admin: {
        title: "Benutzer",
        scripts: ["js/user.js"],
        init: "initUserPage"
    },


    home: {
        title: "Start",
        scripts: [],
        init: null
    }
};

function renderMenu() {

    const container = document.querySelector(".sidebar-menu");
    if (!container) return;

    container.innerHTML = "";

    const groups = {};

    Object.entries(pages).forEach(([page, config]) => {

        const group = config.group || "Einzeln";

        if (!groups[group]) {
            groups[group] = [];
        }

        groups[group].push({
            page,
            title: config.title
        });

    });


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
        const group = document.createElement("div");
        group.className = "menu-group";


        const parent = document.createElement("button");
        parent.className = "menu-parent";
        parent.textContent = groupName;


        const submenu = document.createElement("div");
        submenu.className = "submenu";


        items.forEach(item => {

            const button = document.createElement("button");

            button.className = "submenu-item";
            button.textContent = item.title;
            button.dataset.page = item.page;

            submenu.appendChild(button);

        });


        parent.addEventListener("click", () => {

            document.querySelectorAll(".menu-group")
                .forEach(other => {

                    if (other !== group) {
                        other.classList.remove("open");
                    }

                });

            group.classList.toggle("open");

        });


        group.appendChild(parent);
        group.appendChild(submenu);

        container.appendChild(group);

    });


    document.querySelectorAll("[data-page]")
        .forEach(button => {

            button.addEventListener("click", async () => {

                await loadPage(button.dataset.page);

                closeMenu();

            });

        });

}
document.addEventListener("DOMContentLoaded", async () => {
        renderMenu();
            setupMobileMenu();
    await loadPage("home");
});

async function loadPage(page) {
    const content = document.getElementById("content");
    if (!content) return;
    try {
        const response = await fetch(`pages/${page}.html`);
        if (!response.ok) {
            throw new Error(`Seite nicht gefunden: ${page}`);
        }
        const html = await response.text();
        content.innerHTML = html;
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
            await new Promise(resolve => {
                const script = document.createElement("script");
                script.src = src;
                script.onload = resolve;
                document.body.appendChild(script);
            });
        }
    }
    const initFunction = window[config.init];
    if (typeof initFunction === "function") {
       initFunction();
    }

}
function loadScript(src) {
    return new Promise(resolve => {

        const script = document.createElement("script");
        script.src = `${src}?v=${Date.now()}`;
        script.dataset.pageScript = "true";

        script.onload = resolve;

        document.body.appendChild(script);

    });
}

function setActiveMenu(page) {
    document
        .querySelectorAll(".sidebar-menu button")
        .forEach(button => {
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