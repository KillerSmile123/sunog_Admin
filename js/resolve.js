//resolve.js - Admin Resolved Alerts View Logic
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

  // ✅ Show loading state
  container.innerHTML = `
    <div style="text-align: center; padding: 40px; color: #6c757d;">
      <i class="fas fa-spinner fa-spin" style="font-size: 48px; margin-bottom: 15px;"></i>
      <h3>Loading resolved alerts...</h3>
    </div>
  `;

  try {
    // ✅ Fetch from backend only
    const res = await fetch(`${API_BASE}/get_resolved_alerts`, { 
      method: 'GET', 
      credentials: 'include' 
    });
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();
    const resolvedList = data.resolved || [];

    console.log(`✅ Loaded ${resolvedList.length} resolved alerts from backend`);

    if (resolvedList.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #6c757d;">
          <i class="fas fa-check-circle" style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;"></i>
          <h3>No Resolved Alerts</h3>
          <p>All resolved incidents will appear here.</p>
        </div>
      `;
      return;
    }

    // Clear loading state
    container.innerHTML = "";

    resolvedList.forEach((alert, i) => {
      const card = document.createElement("div");
      card.className = "alert-card";
      
      // ✅ Use backend data structure
      const photoUrl = alert.photo_url || alert.photo_filename;
      const videoUrl = alert.video_url || alert.video_filename;
      
      card.innerHTML = `
        <div class="info"><strong>Alert ID:</strong> #${alert.id}</div>
        <div class="info"><strong>Reporter:</strong> ${alert.reporter_name || "Unknown"}</div>
        <div class="info"><strong>Barangay:</strong> ${alert.barangay || "Unknown"}</div>
        <div class="info"><strong>Reported:</strong> ${new Date(alert.timestamp).toLocaleString()}</div>
        <div class="info"><strong>Resolved:</strong> ${alert.resolvedAt ? new Date(alert.resolvedAt).toLocaleString() : "N/A"}</div>
        <div class="info"><strong>Resolve Time:</strong> ${alert.resolve_time || "N/A"}</div>
        <div class="info"><strong>Location:</strong> ${alert.latitude}, ${alert.longitude}</div>
        <div class="info"><strong>Description:</strong> ${alert.description || "No description"}</div>
        ${photoUrl ? `
          <div class="media-preview">
            <img src="${photoUrl}" alt="Fire Image" loading="lazy" 
                 onerror="this.parentElement.innerHTML='<div style=\\'padding:20px;text-align:center;color:#999;\\'>Image not available</div>'"/>
          </div>
        ` : ''}
        ${videoUrl ? `
          <div class="media-preview">
            <video controls src="${videoUrl}" preload="metadata"
                   onerror="this.parentElement.innerHTML='<div style=\\'padding:20px;text-align:center;color:#999;\\'>Video not available</div>'"></video>
          </div>
        ` : ''}
        <div id="map${i}" class="map-container" style="height: 300px; margin-top: 15px; border-radius: 8px;"></div>
      `;
      container.appendChild(card);

      // Initialize map
      setTimeout(() => {
        try {
          const map = L.map(`map${i}`).setView([alert.latitude, alert.longitude], 14);
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "© OpenStreetMap contributors"
          }).addTo(map);
          L.marker([fireStation.lat, fireStation.lng])
            .addTo(map)
            .bindPopup("Fire Station");
          L.marker([alert.latitude, alert.longitude])
            .addTo(map)
            .bindPopup("Incident Location");
        } catch (mapError) {
          console.error('Map initialization error:', mapError);
          document.getElementById(`map${i}`).innerHTML = '<div style="padding:20px;text-align:center;color:#999;">Map unavailable</div>';
        }
      }, 100 * i); // Stagger map initialization
    });
  } catch (err) {
    console.error('❌ Failed to load resolved alerts:', err);
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #dc3545;">
        <i class="fas fa-exclamation-circle" style="font-size: 48px; margin-bottom: 15px;"></i>
        <h3>Failed to Load Resolved Alerts</h3>
        <p>${err.message}</p>
        <button onclick="location.reload()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; margin-top: 15px;">
          <i class="fas fa-sync"></i> Retry
        </button>
      </div>
    `;
  }
});