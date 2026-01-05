// Use centralized auth helper if available
if (typeof AdminAuth !== 'undefined') {
  AdminAuth.requireAuth();
} else {
  fetch(`${API_BASE}/auth/verify`, { credentials: 'include' })
    .then(res => { if (!res.ok) window.location.href = 'adminLogin.html'; })
    .catch(() => { window.location.href = 'adminLogin.html'; });
}

document.addEventListener("DOMContentLoaded", async function () {
  const container = document.getElementById("resolved-container");
  const fireStation = { lat: 8.476776975907958, lng: 123.7968330650085 };

  try {
    const res = await fetch(`${API_BASE}/get_resolved_alerts`, { method: 'GET', credentials: 'include' });
    if (!res.ok) {
      container.innerHTML = "No resolved alerts found.";
      return;
    }
    const data = await res.json();
    const resolvedList = data.resolved || [];

    if (resolvedList.length === 0) {
      container.innerHTML = "No resolved alerts found.";
      return;
    }

    resolvedList.forEach((alert, i) => {
      const card = document.createElement("div");
      card.className = "alert-card";
      card.innerHTML = `
      <div class="info"><strong>Reported:</strong> ${new Date(alert.timestamp).toLocaleString()}</div>
      <div class="info"><strong>Resolved:</strong> ${alert.resolvedAt ? new Date(alert.resolvedAt).toLocaleString() : "N/A"}</div>
      <div class="info"><strong>Location:</strong> ${alert.latitude}, ${alert.longitude}</div>
      <div class="info"><strong>Description:</strong> ${alert.description || "No description"}</div>
      <div class="info"><strong>Reporter:</strong> ${alert.user?.name || "Unknown"}</div>
      <div class="info"><strong>Contact:</strong> ${alert.user?.contact || "N/A"}</div>
      <div class="media-preview">
        ${alert.mediaType === "image" ? `<img src="${alert.media}" alt="Fire Image" />` : ""}
        ${alert.mediaType === "video" ? `<video controls src="${alert.media}"></video>` : ""}
      </div>
      <div id="map${i}" class="map-container"></div>
    `;
      container.appendChild(card);

      // Map for resolved alert
      const map = L.map(`map${i}`).setView([alert.latitude, alert.longitude], 14);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
      L.marker([fireStation.lat, fireStation.lng]).addTo(map).bindPopup("Fire Station");
      L.marker([alert.latitude, alert.longitude]).addTo(map).bindPopup("Incident Location");
    });
  } catch (err) {
    console.error('Failed to load resolved alerts:', err);
    document.getElementById('resolved-container').innerHTML = 'Failed to load resolved alerts.';
  }
});
