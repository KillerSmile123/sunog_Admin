// Use centralized auth helper if available
// Use centralized auth helper if available
if (typeof AdminAuth !== 'undefined') {
  AdminAuth.requireAuth();
} else {
  if (!localStorage.getItem('adminToken')) {
    window.location.href = 'adminLogin.html';
  }
}

document.addEventListener("DOMContentLoaded", async function () {
  const container = document.getElementById("alerts-container");
  const fireStation = { lat: 8.476776975907958, lng: 123.7968330650085 };

  // Load active alerts (client-side localStorage fallback)
  let alerts = [];
  try {
    const res = await fetch(`${API_BASE}/get_alerts`, { method: 'GET', credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      alerts = data.alerts || [];
    } else {
      alerts = JSON.parse(localStorage.getItem('alerts') || '[]');
    }
  } catch (err) {
    alerts = JSON.parse(localStorage.getItem('alerts') || '[]');
  }

  if (!alerts || alerts.length === 0) {
    container.innerHTML = "No active alerts.";
    return;
  }

  alerts.forEach((alert, i) => {
    const card = document.createElement("div");
    card.className = "alert-card";
    card.innerHTML = `
      <div class="info"><strong>Reported:</strong> ${new Date(alert.timestamp).toLocaleString()}</div>
      <div class="info"><strong>Location:</strong> ${alert.latitude}, ${alert.longitude}</div>
      <div class="info"><strong>Description:</strong> ${alert.description || "No description"}</div>
      <div class="info"><strong>Reporter:</strong> ${alert.user?.name || "Unknown"}</div>
      <div class="info"><strong>Contact:</strong> ${alert.user?.contact || "N/A"}</div>
      <div class="media-preview">
        ${alert.mediaType === "image" ? `<img src="${alert.media}" alt="Fire Image" />` : ""}
        ${alert.mediaType === "video" ? `<video controls src="${alert.media}"></video>` : ""}
      </div>
      <div id="map${i}" class="map-container"></div>
      <button class="resolve-btn" data-id="${alert.id}">Resolve</button>
    `;
    container.appendChild(card);

    // Map
    const map = L.map(`map${i}`).setView([alert.latitude, alert.longitude], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
    L.marker([fireStation.lat, fireStation.lng]).addTo(map).bindPopup("Fire Station");
    L.marker([alert.latitude, alert.longitude]).addTo(map).bindPopup("Incident Location");
  });

  // Handle resolve click
  container.addEventListener("click", async function (e) {
    if (e.target.classList.contains("resolve-btn")) {
      const alertId = e.target.dataset.id;

      if (confirm('Mark this alert as resolved?')) {
        try {
          // Try resolving via backend
          const res = await fetch(`${API_BASE}/resolve_alert/${encodeURIComponent(alertId)}`, {
            method: 'POST',
            credentials: 'include'
          });

          if (res.ok) {
            e.target.closest('.alert-card').remove();
            alert('Alert resolved successfully!');
            return;
          }
          throw new Error('server');
        } catch (err) {
          // Fallback to localStorage handling
          let alerts = JSON.parse(localStorage.getItem('alerts') || '[]');
          const alertToResolve = alerts.find(a => a.id == alertId);

          if (alertToResolve) {
            alerts = alerts.filter(a => a.id != alertId);
            localStorage.setItem('alerts', JSON.stringify(alerts));

            let resolved = JSON.parse(localStorage.getItem('resolvedAlerts') || '[]');
            resolved.push({ ...alertToResolve, resolvedAt: new Date().toISOString() });
            localStorage.setItem('resolvedAlerts', JSON.stringify(resolved));

            e.target.closest('.alert-card').remove();
            alert('Alert resolved locally (fallback).');
          } else {
            alert('Failed to resolve alert.');
          }
        }
      }
    }
  });
});
