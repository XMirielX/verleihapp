let allMaterials = [];
let currentPlan = [];
let selectedEvent = null;


// Start
document.addEventListener("DOMContentLoaded", async () => {
    loadEvents();
    await loadMaterials();
    renderCategories();
    renderMaterialsSelect();
    renderTable();

    document
        .getElementById("eventSelect")
        .addEventListener("change", eventChanged);
    document
        .getElementById("materialSelect")
        .addEventListener("change", renderTable);
    document
        .getElementById("categorySelect")
        .addEventListener("change", renderTable);
    document
        .getElementById("onlyPlanned")
        .addEventListener("change", renderTable);
    document
        .getElementById("savePlanningButton")
        .addEventListener("click", savePlanning);
});



// Veranstaltungen laden
async function loadEvents() {
    try {
        const response = await fetch("/api/events");
        const events = await response.json();
        const select = document.getElementById("eventSelect");
        events.forEach(event => {
            const option = document.createElement("option");
            option.value = event.id;
            option.textContent = event.name;
            select.appendChild(option);
        });
    } catch(error) {
        console.error("EVENT LOAD ERROR:", error);
    }

}



// Event geändert
async function eventChanged() {
    selectedEvent = document.getElementById("eventSelect").value;
    await loadMaterials();
    renderCategories();
    renderMaterialsSelect();

    if(!selectedEvent) {
        renderTable();
        return;
    }

    await loadPlan();
    renderTable();
}



// Material laden
async function loadMaterials() {
    try {
        const [materialResponse, productResponse] = await Promise.all([
            fetch("/api/material"),
            fetch("/api/products")
        ]);

        const materials = await materialResponse.json();
        const products = await productResponse.json();

        if (!Array.isArray(materials)) {
            console.error("Ungueltige Material-Antwort:", materials);
            allMaterials = [];
            return;
        }

        if (!Array.isArray(products)) {
            console.error("Ungueltige Produkt-Antwort:", products);
            allMaterials = [];
            return;
        }

        allMaterials = materials.map(material => {
            const available = products.filter(product =>
                isProductForMaterial(product, material) &&
                Number(product.stat) === 10
            ).length;

            return {
                ...material,
                category: material.category_name || "-",
                available,
                quantity: 0
            };
        });
    }
    catch(error){
        console.error(
            "MATERIAL LOAD ERROR:",
            error
        );
    }
}

function isProductForMaterial(product, material) {
    if (product.material_typ_id) {
        return String(product.material_typ_id) === String(material.id);
    }

    return product.name === material.name &&
        String(product.category_id) === String(material.category_id) &&
        (product.spezification || "") === (material.specification || "");
}



// bestehende Planung laden
async function loadPlan() {
    try {
        const response =
            await fetch(
                `/api/event_plan/${selectedEvent}`
            );
        currentPlan = await response.json();
        if (!Array.isArray(currentPlan)) {
            console.error("Ungueltige Plan-Antwort:", currentPlan);
            currentPlan = [];
        }

        allMaterials.forEach(material => {
            const planned =
                currentPlan.find(
                    p =>
                    Number(p.material_id) === Number(material.id)
                );
            if(planned){
                material.quantity =
                    planned.quantity;
            }
            else {
                material.quantity = 0;
            }
        });
    }
    catch(error){
        console.error(
            "PLAN LOAD ERROR:",
            error
        );
    }
}

function renderMaterialsSelect(){
    const select =
        document.getElementById(
            "materialSelect"
        );
    select.innerHTML =
        `
        <option value="">
            Alle
        </option>
        `;
    allMaterials
    .sort(
        (a,b)=>
        getMaterialLabel(a).localeCompare(getMaterialLabel(b))
    )
    .forEach(material=>{
        const option =
            document.createElement(
                "option"
            );
        option.value =
            material.id;
        option.textContent =
            getMaterialLabel(material);
        select.appendChild(option);
    });

}

function getMaterialLabel(material) {
    const parts = [
        material.category || "-",
        material.name || "Ohne Name"
    ];

    if (material.specification) {
        parts.push(material.specification);
    }

    return parts.join(" - ");
}

// Kategorien erzeugen
function renderCategories(){
    const select =
        document.getElementById(
            "categorySelect"
        );
    const categories =
        [
            ...new Set(
                allMaterials.map(
                    m => m.category || "-"
                )
            )
        ].sort();
    select.innerHTML =
        `<option value="">Alle</option>`;
    categories.forEach(category => {
        const option =
            document.createElement("option");
        option.value = category;
        option.textContent = category;
        select.appendChild(option);
    });

}



// Tabelle erzeugen
function renderTable(){
    const tbody =
        document.getElementById(
            "planningBody"
        );
    tbody.innerHTML = "";
    const selectedMaterial =
        document
        .getElementById("materialSelect")
        .value;
    const category =
        document
        .getElementById("categorySelect")
        .value;
    const onlyPlanned =
        document
        .getElementById("onlyPlanned")
        .checked;
    let filtered =
        allMaterials.filter(material => {
            let matchesMaterial =
                !selectedMaterial ||
                material.id == selectedMaterial;
            let matchesCategory =
                !category ||
                material.category === category;
            let matchesPlan =
                !onlyPlanned ||
                material.quantity > 0;
            return matchesMaterial
                && matchesCategory
                && matchesPlan;
        });
    // Gruppierung nach Kategorie

    const groups = {};
    filtered.forEach(material => {
        const categoryName = material.category || "-";

        if(!groups[categoryName])
            groups[categoryName] = [];
        groups[categoryName]
            .push(material);
    });
    Object.keys(groups)
    .sort()
    .forEach(category => {
        const header =
            document.createElement("tr");
        header.innerHTML =
            `
            <td colspan="4">
                <b>${category.toUpperCase()}</b>
            </td>
            `;
        tbody.appendChild(header);
        groups[category].forEach(material => {
            const tr =
                document.createElement("tr");
            if(material.quantity > material.available){
                tr.style.backgroundColor =
                    "#ffcccc";
            }
            tr.innerHTML =
            `
            <td>
                ${material.name}
                ${material.specification ? " (" + material.specification + ")" : ""}
            </td>
            <td>
                ${material.category || "-"}
            </td>
            <td>
                ${material.available ?? 0}
            </td>
            <td>
                <input 
                    type="number"
                    min="0"
                    value="${material.quantity}"
                    data-id="${material.id}"
                    class="quantityInput"
                >
            </td>
            `;
            tbody.appendChild(tr);
        });
    });
    document
    .querySelectorAll(".quantityInput")
    .forEach(input => {
        input.addEventListener(
            "change",
            e => {
                const id =
                    Number(
                        e.target.dataset.id
                    );
                const material =
                    allMaterials.find(
                        m => m.id === id
                    );
                material.quantity =
                    Number(
                        e.target.value
                    );
                updateSummary();
                renderTable();
            }
        );
    });
    updateSummary();

}
// Zusammenfassung
function updateSummary(){
    const planned =
        allMaterials.filter(
            m => m.quantity > 0
        );
    document
    .getElementById(
        "plannedPositions"
    )
    .textContent =
        planned.length;
    document
    .getElementById(
        "plannedQuantity"
    )
    .textContent =
        planned.reduce(
            (sum,m)=>
                sum + m.quantity,
            0
        );
}



// Speichern
async function savePlanning(){
    if(!selectedEvent){
        alert(
            "Bitte Veranstaltung auswählen"
        );
        return;
    }
    const items =
        allMaterials
        .filter(
            m => m.quantity > 0
        )
        .map(
            m => ({
                material_id:m.id,
                quantity:m.quantity
            })
        );
    try {
        const response =
            await fetch(
                "/api/event_plan",
                {

                    method:"POST",

                    headers:{
                        "Content-Type":
                        "application/json"
                    },
                    body:
                    JSON.stringify({
                        event_id:
                            selectedEvent,
                        items:
                            items

                    })
                }
            );
        const result =
            await response.json();
        document
        .getElementById("result")
        .textContent =
            "Planung gespeichert";
    }
    catch(error){
        console.error(
            "SAVE ERROR:",
            error
        );
        document
        .getElementById("result")
        .textContent =
            "Fehler beim Speichern";
    }
}
