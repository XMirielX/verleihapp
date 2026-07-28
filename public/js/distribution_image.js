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
async function loadDistributionImages() {
    const res = await fetch(
        `/api/distributions_images/${currentDistributionId}/images`
    );
    distributionImages = await res.json();
    currentImageIndex = 0;
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
    const formData =
        new FormData();
    formData.append(
        "image",
        input.files[0]
    );
    await fetch(
        `/api/distributions_images/${currentDistributionId}/images`,
        {
            method: "POST",
            body: formData
        }
    );
    input.value = "";
    await loadDistributionImages();
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