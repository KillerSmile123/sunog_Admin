// ../js/alertsView.js
document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("alerts-container");
  const badgeEl = document.querySelector(".badge");
  const fireStation = { lat: 8.476776975907958, lng: 123.7968330650085 };

  // ---------- storage helpers ----------
  const LS_ACTIVE = "alertList";
  const LS_RESOLVED = "resolvedAlerts";

  const load = (key) => JSON.parse(localStorage.getItem(key) || "[]");

  function save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      if (e.name === "QuotaExceededError") {
        alert("Storage full! Keeping only the latest resolved alert.");
        localStorage.removeItem(key); // clear old
        localStorage.setItem(key, JSON.stringify([data[data.length - 1]])); // keep last
      }
    }
  }

  function updateBadge() {
    badgeEl && (badgeEl.textContent = load(LS_ACTIVE).length);
  }

  // Ensure each alert has a stable unique id
  function ensureIds(alerts) {
    let changed = false;
    alerts.forEach((a) => {
      if (!a._id) {
        a._id = "a_" + Math.random().toString(36).slice(2) + Date.now();
        changed = true;
      }
    });
    if (changed) save(LS_ACTIVE, alerts);
    return alerts;
  }

  // ---------- UI ----------
  function mediaHTML(alert) {
    if (alert.mediaType === "image" && alert.media) {
      return `<img src="${alert.media}" alt="Fire Image" class="media" style="max-width:100%;max-height:250px;border-radius:6px;">`;
    }
    if (alert.mediaType === "video" && alert.media) {
      return `<video controls src="${alert.media}" style="max-width:100%;max-height:250px;border-radius:6px;"></video>`;
    }
    return "";
  }

  function haversineDistance(coord1, coord2) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(coord2.lat - coord1.lat);
    const dLon = toRad(coord2.lng - coord1.lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(coord1.lat)) *
        Math.cos(toRad(coord2.lat)) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(2);
  }

  function render() {
    const alerts = ensureIds(load(LS_ACTIVE));
    container.innerHTML = "";

    if (alerts.length === 0) {
      container.innerHTML = `<div class="info">No alerts found.</div>`;
      updateBadge();
      return;
    }

    alerts.forEach((alert) => {
      const lat = parseFloat(alert.latitude);
      const lng = parseFloat(alert.longitude);
      const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
      const dist = hasCoords
        ? haversineDistance(fireStation, { lat, lng }) + " km"
        : "N/A";

      const card = document.createElement("div");
      card.className = "alert-card";
      card.dataset.id = alert._id;

      const mapId = "map-" + alert._id;

      card.innerHTML = `
        <div class="info"><strong>Reported:</strong> ${new Date(alert.timestamp || Date.now()).toLocaleString()}</div>
        <div class="info"><strong>Location:</strong> ${alert.latitude || "?"}, ${alert.longitude || "?"}</div>
        <div class="info"><strong>Distance:</strong> <span class="distance">${dist}</span></div>
        <div class="info"><strong>Description:</strong> ${alert.description || "No description"}</div>
        <div class="info"><strong>Reporter:</strong> ${alert.user?.name || "Unknown"}</div>
        <div class="info"><strong>Contact:</strong> ${alert.user?.contact || "N/A"}</div>
        <div class="media-preview">${mediaHTML(alert)}</div>
        <div id="${mapId}" style="width:100%;height:200px;border-radius:8px;margin-top:10px;"></div>
        <div style="margin-top:10px;">
          <button type="button" class="resolve-btn" style="background:#e74c3c;color:#fff;border:none;padding:8px 12px;border-radius:6px;cursor:pointer;">
            Resolve
          </button>
        </div>
      `;
      container.appendChild(card);

      if (hasCoords && window.L) {
        const map = L.map(mapId).setView([lat, lng], 14);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
        }).addTo(map);
        L.marker([fireStation.lat, fireStation.lng])
          .addTo(map)
          .bindPopup("Fire Station");
        L.marker([lat, lng]).addTo(map).bindPopup("Incident Location");
      }
    });

    updateBadge();
  }

  // ---------- event delegation for Resolve ----------
  container.addEventListener("click", (e) => {
    const btn = e.target.closest(".resolve-btn");
    if (!btn) return;

    const card = btn.closest(".alert-card");
    if (!card) return;

    const alertId = card.dataset.id;
    let alerts = load(LS_ACTIVE);
    const idx = alerts.findIndex((a) => a._id === alertId);
    if (idx === -1) return;

    // Move to resolved
    const resolved = load(LS_RESOLVED);
    resolved.push({ ...alerts[idx], resolvedAt: new Date().toISOString() });
    save(LS_RESOLVED, resolved);

    // Remove from active
    alerts.splice(idx, 1);
    save(LS_ACTIVE, alerts);

    // Update UI
    card.remove();
    updateBadge();
  });

  // initial render
  render();
});
