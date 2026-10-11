// ==========================
// Distribution Bilder
// ==========================

let currentDistributionId = null;
let distributionImages = [];
let currentImageIndex = 0;


// Bilder öffnen
async function openDistributionImages(distributionId) {

    currentDistributionId = distributionId;
    await loadDistributionImages();
    document
        .getElementById("imageModal")
        .classList.remove("hidden");
}


// Bilder laden
async function loadDistributionImages(selectedFilename = null) {
    const res = await fetch(
        `/api/distributions_images/${currentDistributionId}/images`,
        { cache: "no-store" }
    );
    const result = await res.json();
    if (!res.ok) {
        throw new Error(result.error || "Bilder konnten nicht geladen werden");
    }
    distributionImages = result;
    currentImageIndex = Math.max(0, distributionImages.findIndex(
        image => image.filename === selectedFilename
    ));
    renderImageGallery();
}


// Galerie anzeigen
function renderImageGallery() {
    const container = document.getElementById("imageGallery");
    container.innerHTML = "";
    if (distributionImages.length === 0) {
        container.innerHTML =
            "<p>Keine Bilder vorhanden</p>";
        document.getElementById("imageCounter").innerText = "";
        return;
    }
    const image =
        distributionImages[currentImageIndex];
    const img =
        document.createElement("img");
    img.src =
        `/uploads/distributions/${image.filename}`;
    img.className =
        "distribution-image";
    img.onerror = () => {
        container.textContent = "Das gespeicherte Bild konnte nicht geladen werden.";
    };
    // Desktop / Mobil unterschiedliche Klassen
    if (window.innerWidth <= 768) {
        img.classList.add("mobile-image");
    } else {
        img.classList.add("desktop-image");
    }
    container.appendChild(img);
    document.getElementById("imageCounter").innerText =
        `${currentImageIndex + 1} / ${distributionImages.length}`;
        

}

// nächstes Bild
function nextImage() {

    if (!distributionImages.length)
        return;
    currentImageIndex++;
    if (
        currentImageIndex >= distributionImages.length
    ) {
        currentImageIndex = 0;
    }
    renderImageGallery();
}
// vorheriges Bild
function previousImage() {
    if (!distributionImages.length)
        return;
    currentImageIndex--;
    if (
        currentImageIndex < 0
    ) {
        currentImageIndex =
            distributionImages.length - 1;
    }
    renderImageGallery();
}


// Upload
async function prepareDistributionImage(file) {
    // Keep the request below common 1 MB proxy limits, including multipart headers.
    const maxBytes = 800 * 1024;
    if (file.size <= maxBytes) return file;
    if (file.type && !file.type.startsWith("image/")) {
        throw new Error("Bitte eine Bilddatei auswählen");
    }
    if (file.type === "image/gif") {
        throw new Error("Dieses GIF ist zu groß. Bitte ein JPG- oder PNG-Bild auswählen.");
    }

    const image = new Image();
    const source = URL.createObjectURL(file);
    try {
        image.src = source;
        try {
            await image.decode();
        } catch {
            throw new Error("Das Bildformat konnte nicht gelesen werden. Bitte JPG, PNG oder WebP verwenden.");
        }
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Das Bild konnte nicht für den Upload vorbereitet werden");
        const format = file.type === "image/jpeg" ? "image/jpeg" : "image/webp";
        let edge = Math.min(1600, Math.max(image.naturalWidth, image.naturalHeight));
        const minEdge = Math.min(300, edge);

        while (edge >= minEdge) {
            const scale = Math.min(1, edge / Math.max(image.naturalWidth, image.naturalHeight));
            canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            for (const quality of [0.85, 0.7, 0.55]) {
                const blob = await new Promise(resolve => canvas.toBlob(resolve, format, quality));
                if (blob && blob.size <= maxBytes) {
                    const extension = blob.type === "image/jpeg" ? "jpg" : blob.type === "image/webp" ? "webp" : "png";
                    const name = file.name.replace(/\.[^.]+$/, "");
                    return new File([blob], `${name}.${extension}`, { type: blob.type });
                }
            }
            edge = Math.floor(edge * 0.75);
        }
        throw new Error("Das Bild ist zu groß. Bitte ein kleineres Bild auswählen.");
    } finally {
        URL.revokeObjectURL(source);
    }
}

async function uploadDistributionImage(valid) {
    if (valid) {
        return;
    }
    const input =
        document.getElementById("distributionImageInput");
    if (!input.files.length) {
        alert("Bitte Bild auswählen");
        return;
    }
    try {
        const image = await prepareDistributionImage(input.files[0]);
        const formData = new FormData();
        formData.append("image", image);
        const res = await fetch(
            `/api/distributions_images/${currentDistributionId}/images`,
            {
                method: "POST",
                body: formData
            }
        );
        const result = await res.json().catch(() => null);
        if (!res.ok) {
            if (res.status === 413) {
                throw new Error("Der Server lehnt die Bildgröße ab (HTTP 413). Bitte ein kleineres Bild wählen oder das Upload-Limit des Servers erhöhen.");
            }
            throw new Error(result?.error || `Bild konnte nicht gespeichert werden (HTTP ${res.status})`);
        }
        if (!result?.success || !result.filename) {
            throw new Error("Der Server hat das Speichern des Bildes nicht bestätigt");
        }
        await loadDistributionImages(result.filename);
        if (!distributionImages.some(image => image.filename === result.filename)) {
            throw new Error("Das hochgeladene Bild wurde nicht in der Galerie gefunden");
        }
        input.value = "";
    } catch (err) {
        console.error("Bild-Upload fehlgeschlagen:", err);
        alert(err.message);
    }
}


// aktuelles Bild löschen
async function deleteCurrentDistributionImage(valid) {
    if (valid) {
        return;
    }
    if (!distributionImages.length)
        return;
    const image =
        distributionImages[currentImageIndex];
    if (!confirm("Bild löschen?"))
        return;
    await fetch(
        `/api/distributions_images/images/${image.id}`,
        {
            method: "DELETE"
        }
    );
    await loadDistributionImages();
}


// Modal schließen
function closeImageModal() {
    document
        .getElementById("imageModal")
        .classList.add("hidden");
}
