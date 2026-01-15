// ============ CONFIGURATION ============
// CHANGE THIS TO YOUR ACTUAL BACKEND URL
const API_BASE_URL = 'https://backend-3-hqil.onrender.com'; // e.g., 'http://example.com' or 'https://api.yoursite.com'

// ============ ELEMENTS ============
const form = document.getElementById("profileForm");
const uploadBtn = document.getElementById("upload-btn");
const fileInput = document.getElementById("fileInput");
const profilePic = document.getElementById("profile-pic");
const adminNameDisplay = document.getElementById("admin-name");
const messageContainer = document.getElementById("messageContainer");
const loadingContainer = document.getElementById("loadingContainer");

let currentAdminId = null;

// ============ HELPER FUNCTIONS ============
function showLoading(show = true) {
  if (show) {
    loadingContainer.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  } else {
    loadingContainer.innerHTML = '';
  }
}

function showMessage(message, type) {
  messageContainer.innerHTML = `<div class="${type}-message">${message}</div>`;
  setTimeout(() => {
    messageContainer.innerHTML = '';
  }, 4000);
}

function getAuthToken() {
  return sessionStorage.getItem('authToken') || localStorage.getItem('authToken') || localStorage.getItem('adminToken');
}

function getAdminId() {
  const adminId = sessionStorage.getItem('adminId') || localStorage.getItem('adminId');
  return adminId;
}

function getAdminInfo() {
  const adminInfo = sessionStorage.getItem('adminInfo') || localStorage.getItem('adminInfo');
  if (adminInfo) {
    try {
      return JSON.parse(adminInfo);
    } catch (e) {
      console.error('Error parsing admin info:', e);
      return null;
    }
  }
  return null;
}

function checkAuthentication() {
  const token = getAuthToken();
  const adminId = getAdminId();
  
  if (!token || !adminId) {
    showMessage('Please login first', 'error');
    setTimeout(() => {
      window.location.href = 'adminLogin.html';
    }, 2000);
    return false;
  }
  return true;
}

// ============ POPULATE FROM SESSION STORAGE ============
function populateFromSession() {
  const adminInfo = getAdminInfo();
  
  if (adminInfo) {
    console.log('Admin info from session:', adminInfo);
    
    // Populate form fields with stored admin info
    const fullname = adminInfo.fullname || adminInfo.name || adminInfo.full_name || '';
    const email = adminInfo.email || '';
    const contact = adminInfo.contact || adminInfo.phone || adminInfo.contact_number || '';
    const role = adminInfo.role || 'Administrator';
    const profilePicture = adminInfo.profile_picture || adminInfo.profilePicture || adminInfo.avatar || adminInfo.image || '';

    document.getElementById('fullname').value = fullname;
    document.getElementById('email').value = email;
    document.getElementById('contact').value = contact;
    document.getElementById('role').value = role;
    
    adminNameDisplay.textContent = fullname || 'Admin User';

    // Set profile picture if exists
    if (profilePicture) {
      profilePic.src = profilePicture.startsWith('http') 
        ? profilePicture 
        : `${API_BASE_URL}${profilePicture}`;
    }
  }
}

// ============ FETCH ADMIN PROFILE FROM BACKEND ============
async function fetchAdminProfile() {
  if (!checkAuthentication()) return;

  // First, populate from session storage for instant display
  populateFromSession();

  try {
    showLoading(true);
    
    const token = getAuthToken();
    const adminId = getAdminId();
    currentAdminId = adminId;

    const response = await fetch(`${API_BASE_URL}/admin/profile/${adminId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    showLoading(false);

    if (!response.ok) {
      if (response.status === 401) {
        showMessage('Session expired. Please login again.', 'error');
        setTimeout(() => {
          // Clear session data
          sessionStorage.clear();
          localStorage.removeItem('authToken');
          localStorage.removeItem('adminToken');
          localStorage.removeItem('adminId');
          localStorage.removeItem('adminInfo');
          window.location.href = 'adminLogin.html';
        }, 2000);
        return;
      }
      throw new Error('Failed to fetch profile data');
    }

    const data = await response.json();
    
    // Update session storage with latest data
    sessionStorage.setItem('adminInfo', JSON.stringify(data));
    
    // Populate profile with fresh data from backend
    populateProfile(data);

  } catch (error) {
    showLoading(false);
    console.error('Error fetching profile:', error);
    // If backend fails, we still have session data displayed
    console.log('Using cached session data due to fetch error');
  }
}

function populateProfile(data) {
  // Handle different possible field names from backend
  const fullname = data.fullname || data.name || data.full_name || '';
  const email = data.email || '';
  const contact = data.contact || data.phone || data.contact_number || '';
  const role = data.role || 'Administrator';
  const profilePicture = data.profile_picture || data.profilePicture || data.avatar || data.image || '';

  document.getElementById('fullname').value = fullname;
  document.getElementById('email').value = email;
  document.getElementById('contact').value = contact;
  document.getElementById('role').value = role;
  
  adminNameDisplay.textContent = fullname || 'Admin User';

  // Set profile picture if exists
  if (profilePicture) {
    profilePic.src = profilePicture.startsWith('http') 
      ? profilePicture 
      : `${API_BASE_URL}${profilePicture}`;
  }
}

// ============ UPDATE ADMIN PROFILE ============
async function updateAdminProfile(profileData) {
  try {
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
    
    const token = getAuthToken();

    const response = await fetch(`${API_BASE_URL}/admin/profile/${currentAdminId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(profileData)
    });

    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Changes';

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to update profile');
    }

    showMessage(data.message || 'Profile updated successfully!', 'success');
    
    // Update display name
    adminNameDisplay.textContent = profileData.fullname;
    
    // Update session storage with new data
    const adminInfo = getAdminInfo() || {};
    const updatedInfo = {
      ...adminInfo,
      ...profileData
    };
    sessionStorage.setItem('adminInfo', JSON.stringify(updatedInfo));

  } catch (error) {
    console.error('Error updating profile:', error);
    showMessage('Error updating profile: ' + error.message, 'error');
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Changes';
  }
}

// ============ UPLOAD PROFILE PICTURE ============
async function uploadProfilePicture(file) {
  try {
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Uploading...';

    const formData = new FormData();
    formData.append('profile_picture', file);
    formData.append('admin_id', currentAdminId);

    const token = getAuthToken();

    const response = await fetch(`${API_BASE_URL}/admin/upload_picture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    uploadBtn.disabled = false;
    uploadBtn.textContent = 'Change Picture';

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to upload picture');
    }

    // Update profile picture with new URL from backend
    const picUrl = data.profile_picture || data.imageUrl || data.url;
    if (picUrl) {
      profilePic.src = picUrl.startsWith('http') ? picUrl : `${API_BASE_URL}${picUrl}`;
      
      // Update session storage with new profile picture
      const adminInfo = getAdminInfo() || {};
      adminInfo.profile_picture = picUrl;
      sessionStorage.setItem('adminInfo', JSON.stringify(adminInfo));
    }

    showMessage(data.message || 'Profile picture updated successfully!', 'success');

  } catch (error) {
    console.error('Error uploading picture:', error);
    showMessage('Error uploading picture: ' + error.message, 'error');
    uploadBtn.disabled = false;
    uploadBtn.textContent = 'Change Picture';
  }
}

// ============ EVENT LISTENERS ============
window.addEventListener("DOMContentLoaded", () => {
  fetchAdminProfile();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const profileData = {
    fullname: document.getElementById('fullname').value,
    email: document.getElementById('email').value,
    contact: document.getElementById('contact').value
  };
  
  await updateAdminProfile(profileData);
});

uploadBtn.addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  // Validate file type
  if (!file.type.startsWith('image/')) {
    showMessage('Please select an image file', 'error');
    return;
  }

  // Validate file size (2MB)
  if (file.size > 2 * 1024 * 1024) {
    showMessage('Image size should be less than 2MB', 'error');
    return;
  }

  // Preview image immediately
  const reader = new FileReader();
  reader.onload = (e) => {
    profilePic.src = e.target.result;
  };
  reader.readAsDataURL(file);

  // Upload to backend
  await uploadProfilePicture(file);
  
  // Clear file input
  fileInput.value = '';
});

function goBack() {
  window.history.back();
}