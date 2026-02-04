// sidebarBadges.js - Shared sidebar badge updater for ALL admin pages
// Include this file on: adminDashboard.html, alerts.html, resolved.html, spam.html

// ========================================
// FETCH COUNTS FROM BACKEND
// ========================================

async function fetchAlertCounts() {
  try {
    console.log('📊 Fetching alert counts for sidebar badges...');
    
    // Fetch all three counts in parallel
    const [activeData, resolvedData, spamData] = await Promise.all([
      fetch(`${API_BASE}/get_alerts`, { 
        method: 'GET', 
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      }).then(res => res.ok ? res.json() : { alerts: [] }),
      
      fetch(`${API_BASE}/get_resolved_alerts`, { 
        method: 'GET', 
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      }).then(res => res.ok ? res.json() : { resolved: [] }),
      
      fetch(`${API_BASE}/get_spam_alerts`, { 
        method: 'GET', 
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      }).then(res => res.ok ? res.json() : { alerts: [] })
    ]);

    const counts = {
      active: activeData.alerts?.length || 0,
      resolved: resolvedData.resolved?.length || 0,
      spam: spamData.alerts?.length || 0
    };

    console.log('✅ Alert counts fetched:', counts);
    return counts;
    
  } catch (error) {
    console.error('❌ Error fetching alert counts:', error);
    return { active: 0, resolved: 0, spam: 0 };
  }
}

// ========================================
// UPDATE SIDEBAR BADGES
// ========================================

function updateSidebarBadges(counts) {
  console.log('🏷️ Updating sidebar badges:', counts);
  
  // Find all badge elements in the sidebar
  // Using multiple selectors to support different HTML structures
  
  // Update Alerts badge (active alerts)
  const alertsBadges = document.querySelectorAll(
    'a[href="alerts.html"] .badge, ' +
    'a[href*="alerts"] .badge, ' +
    '.nav-item.alerts .badge, ' +
    '.sidebar .alerts .badge'
  );
  
  alertsBadges.forEach(badge => {
    badge.textContent = counts.active;
    badge.style.display = counts.active > 0 ? 'inline-block' : 'inline-block'; // Always show
    // Change background color if needed
    badge.style.backgroundColor = '#e74c3c'; // Red
  });
  
  if (alertsBadges.length > 0) {
    console.log('✅ Updated Alerts badges:', counts.active);
  }
  
  // Update Resolved badge
  const resolvedBadges = document.querySelectorAll(
    'a[href="resolved.html"] .badge, ' +
    'a[href*="resolved"] .badge, ' +
    '.nav-item.resolved .badge, ' +
    '.sidebar .resolved .badge'
  );
  
  resolvedBadges.forEach(badge => {
    badge.textContent = counts.resolved;
    badge.style.display = counts.resolved > 0 ? 'inline-block' : 'inline-block'; // Always show
    badge.style.backgroundColor = '#27ae60'; // Green
  });
  
  if (resolvedBadges.length > 0) {
    console.log('✅ Updated Resolved badges:', counts.resolved);
  }
  
  // Update Spam badge
  const spamBadges = document.querySelectorAll(
    'a[href="spam.html"] .badge, ' +
    'a[href*="spam"] .badge, ' +
    '.nav-item.spam .badge, ' +
    '.sidebar .spam .badge'
  );
  
  spamBadges.forEach(badge => {
    badge.textContent = counts.spam;
    badge.style.display = counts.spam > 0 ? 'inline-block' : 'inline-block'; // Always show
    badge.style.backgroundColor = '#95a5a6'; // Gray
  });
  
  if (spamBadges.length > 0) {
    console.log('✅ Updated Spam badges:', counts.spam);
  }
  
  // If no badges found, warn in console
  if (alertsBadges.length === 0 && resolvedBadges.length === 0 && spamBadges.length === 0) {
    console.warn('⚠️ No sidebar badges found! Make sure your HTML has .badge elements');
  }
}

// ========================================
// REFRESH BADGES
// ========================================

async function refreshSidebarBadges() {
  const counts = await fetchAlertCounts();
  updateSidebarBadges(counts);
}

// ========================================
// AUTO-INITIALIZE
// ========================================

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', refreshSidebarBadges);
} else {
  refreshSidebarBadges();
}

// Auto-refresh badges every 30 seconds
setInterval(refreshSidebarBadges, 30000);

console.log('✅ Sidebar badges script loaded and will auto-update every 30 seconds');