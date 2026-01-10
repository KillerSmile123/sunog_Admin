//notificationAdmin.js
// ✅ Use the correct API base from config
const NOTIFICATION_API_BASE = API_BASE;


// ========================================
// NOTIFICATION SENDER
// ========================================

// Send notification to specific user
async function sendNotificationToUser(userId, title, message, type = 'info') {
  try {
    const response = await fetch(`${API_BASE}/api/admin/notifications`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        title: title,
        message: message,
        type: type
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Notification sent successfully:', data);
    return data;
  } catch (error) {
    console.error('❌ Error sending notification:', error);
    throw error;
  }
}

// Broadcast to all users
async function broadcastNotification(title, message, type = 'info') {
  try {
    const usersResponse = await fetch(`${API_BASE}/get_all_users`, {
      method: 'GET',
      credentials: 'include'
    });

    if (!usersResponse.ok) {
      throw new Error('Failed to fetch users');
    }

    const users = await usersResponse.json();
    
    const promises = users.map(user => 
      sendNotificationToUser(user.id, title, message, type)
    );

    await Promise.all(promises);
    console.log(`✅ Broadcast sent to ${users.length} users`);
    return { success: true, count: users.length };
  } catch (error) {
    console.error('❌ Error broadcasting notification:', error);
    throw error;
  }
}

// Helper for alert-specific notifications
async function notifyUserAboutAlert(userId, alertId, notificationType, extraData = {}) {
  const notifications = {
    'responded': {
      title: 'Fire Station Response',
      message: `The fire station has responded to your alert #${alertId}. ${extraData.message || 'Help is on the way!'}`,
      type: 'info'
    },
    'resolved': {
      title: '✅ Alert Resolved',
      message: `Your fire alert #${alertId} has been resolved. Fire was put out at ${extraData.resolveTime || 'N/A'}.`,
      type: 'success'
    },
    'deleted': {
      title: '🗑️ Alert Removed',
      message: `Your alert #${alertId} has been removed from the system.`,
      type: 'warning'
    }
  };

  const notif = notifications[notificationType];
  if (!notif) {
    console.error('Unknown notification type:', notificationType);
    return;
  }

  return sendNotificationToUser(userId, notif.title, notif.message, notif.type);
}

console.log('✅ Notification system loaded - connected to backend:', API_BASE);