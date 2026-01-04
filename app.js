// 🔥 BVM Alumni Portal - Complete Firebase Logic
// STEP 1: Replace firebaseConfig with YOUR credentials from Firebase Console


// 🔥 BVM Alumni Portal - Complete Firebase Logic (Compat SDK)
// STEP 1: Replace firebaseConfig with YOUR credentials from Firebase Console

const firebaseConfig = {
   apiKey: "AIzaSyDRPotcu3E1MZ7-PdkwHqqmD0Qr_tMeXFs",
  authDomain: "first-fc9ce.firebaseapp.com",
  databaseURL: "https://first-fc9ce-default-rtdb.firebaseio.com",
  projectId: "first-fc9ce",
  storageBucket: "first-fc9ce.firebasestorage.app",
  messagingSenderId: "647342130562",
  appId: "1:647342130562:web:f348cf055427107596bb9b",
  measurementId: "G-C5EH80M7T1"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const rtdb = firebase.database();

// Global State
let currentUser = null;
let currentRole = null;
let currentChatWith = null;

// ==========================================
// AUTH FUNCTIONS
// ==========================================

function switchTab(tab) {
  document.getElementById('loginForm').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none';
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
}

document.getElementById('regRole').addEventListener('change', function() {
  document.getElementById('alumniRegFields').style.display = this.value === 'alumni' ? 'block' : 'none';
  document.getElementById('studentRegFields').style.display = this.value === 'student' ? 'block' : 'none';
});

async function registerUser() {
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value.trim();
  const role = document.getElementById('regRole').value;

  // VALIDATION: Check all fields
  if (!name || !email || !password) {
    showAlert('registerAlert', 'Fill all fields', 'error');
    return;
  }

  // VALIDATION: Students MUST use college email
  if (role === 'student') {
    if (!isCollegeEmail(email)) {
      showAlert('registerAlert', '❌ Students must register with college email (e.g., yourname@bvmengineering.ac.in)', 'error');
      return;
    }
  }

  // VALIDATION: Password strength
  if (password.length < 6) {
    showAlert('registerAlert', 'Password must be at least 6 characters', 'error');
    return;
  }

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    const uid = cred.user.uid;

    let userData = {
      email, role, name,
      verified: role === 'alumni' ? false : true,
      createdAt: new Date()
    };
   

    if (role === 'alumni') {
      userData.gradYear = document.getElementById('regGradYear').value;
      userData.jobTitle = document.getElementById('regJobTitle').value;
      userData.company = document.getElementById('regCompany').value;
      userData.skills = document.getElementById('regSkills').value.split(',').map(s => s.trim()).filter(Boolean);
      userData.interests = document.getElementById('regInterests').value.split(',').map(i => i.trim()).filter(Boolean);
    } else if (role === 'student') {
      userData.collegeId = document.getElementById('regCollegeId').value;
    }

    await db.collection('users').doc(uid).set(userData);
    showAlert('registerAlert', '✅ Registered! Please login.', 'success');
    setTimeout(() => switchTab('login'), 1500);
  } catch (error) {
    showAlert('registerAlert', error.message, 'error');
  }
}


async function loginUser() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  const role = document.getElementById('loginRole').value;

  if (!email || !password) {
    showAlert('loginAlert', 'Fill all fields', 'error');
    return;
  }

  if (role === 'student' && !isCollegeEmail(email)) {
    showAlert('loginAlert', '❌ Students must login with college email', 'error');
    return;
  }

  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    const uid = cred.user.uid;

    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      await auth.signOut();
      showAlert('loginAlert', 'Account data not found', 'error');
      return;
    }

    const userData = userDoc.data();

    // ❌ ROLE MISMATCH
    if (userData.role !== role) {
      await auth.signOut();
      showAlert('loginAlert', 'Wrong role selected', 'error');
      return;
    }

    // 🚨 BLOCK ALUMNI UNTIL APPROVED
    if (role === 'alumni' && userData.verified === false) {
      await auth.signOut();
      showAlert(
        'loginAlert',
        '⏳ Your account is waiting for admin approval. Please try later.',
        'warning'
      );
      return;
    }

    // ✅ ALLOWED LOGIN
    showAlert('loginAlert', '', 'success');

  } catch (error) {
    showAlert('loginAlert', error.message, 'error');
  }
}



async function logoutUser() {
  await auth.signOut();
  currentUser = null;
  currentRole = null;
  document.getElementById('authSection').classList.remove('hidden');
  document.getElementById('mainContent').classList.add('hidden');
}

// Auth State Listener
// Around Line 140 in app.js
auth.onAuthStateChanged(async (user) => {
  document.getElementById('loadingScreen').style.display = 'none';

  if (!user) {
    document.getElementById('authSection').classList.remove('hidden');
    document.getElementById('mainContent').classList.add('hidden');
    return;
  }

  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (!userDoc.exists) {
      await auth.signOut();
      return;
    }

    currentUser = { uid: user.uid, ...userDoc.data() };
    currentRole = currentUser.role;

    // 🚨 SAFETY CHECK — BLOCK UNVERIFIED ALUMNI
    if (currentRole === 'alumni' && currentUser.verified === false) {
      await auth.signOut();

      document.getElementById('authSection').classList.remove('hidden');
      document.getElementById('mainContent').classList.add('hidden');

      showAlert(
        'loginAlert',
        '⏳ Your account is waiting for admin approval.',
        'warning'
      );
      return;
    }

    // ✅ ONLY APPROVED USERS REACH HERE
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('mainContent').classList.remove('hidden');

    updateUI();
    loadFeed();

    if (currentRole === 'student') {
      loadChatAlumni();
    }

    setupPresence();

  } catch (error) {
    console.error('Permission error during initial load:', error);
  }
});


// ==========================================
// UI FUNCTIONS
// ==========================================

function updateUI() {
  document.getElementById('userDisplay').textContent = `${currentUser.name} (${currentRole})`;
  updateSidebar();
}

// Replace the updateSidebar function in app.js
function updateSidebar() {
  const menu = document.getElementById('sidebarMenu');
  menu.innerHTML = '';

  const addMenuItem = (label, view) => {
    const btn = document.createElement('button');
    btn.className = 'sidebar-item';
    btn.textContent = label;
    btn.onclick = () => showView(view);
    menu.appendChild(btn);
  };

  addMenuItem('📋 Feed', 'feedView');
  addMenuItem('💬 Chat', 'chatView'); // Now visible to Student, Alumni, and Admin

  if (currentRole === 'alumni') {
    addMenuItem('✍️ Create Post', 'createPostView');
    addMenuItem('👤 My Profile', 'profileView');
    addMenuItem('🎯 Office Hours', 'rouletteView');
  }

  if (currentRole === 'student') {
    addMenuItem('🎯 Office Hours', 'rouletteView');
  }

  if (currentRole === 'admin') {
    addMenuItem('👑 Admin', 'adminView');
  }

  // Ensure chat list loads for everyone when they enter the portal
  loadChatAlumni();
}

function showView(viewId) {
  document.querySelectorAll('.view-page').forEach(v => v.style.display = 'none');
  document.getElementById(viewId).style.display = 'block';

  if (viewId === 'feedView') loadFeed();
  if (viewId === 'profileView') loadProfile();
  if (viewId === 'adminView') loadAdmin();
}

function showAlert(elementId, message, type) {
  const el = document.getElementById(elementId);
  if (message) {
    el.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
  } else {
    el.innerHTML = '';
  }
}

// ==========================================
// FEED FUNCTIONS
// ==========================================
async function loadFeed() {
  const container = document.getElementById('feedContainer');
  container.innerHTML = '<p style="text-align:center;">Loading...</p>';

  try {
    if (currentRole === 'student') {
      // STUDENTS: Show approved posts only
      const snapshot = await db.collection('posts')
        .where('approved', '==', true)
        .orderBy('createdAt', 'desc')
        .get();

      container.innerHTML = '';
      if (snapshot.empty) {
        container.innerHTML = '<p style="text-align:center; color:#999;">No approved posts yet</p>';
        return;
      }

      snapshot.forEach(async doc => {
        const post = doc.data();
        const authorDoc = await db.collection('users').doc(post.authorId).get();
        const author = authorDoc.data();

        const card = document.createElement('div');
        card.className = 'card';
        // Update the button logic inside the loadFeed loops in app.js
// Find where post cards are created and use this button logic:
card.innerHTML = `
  <h3>${post.title}</h3>
  <p>${post.description}</p>
  ${post.authorId === currentUser.uid 
    ? `<button class="btn btn-danger" onclick="deletePost('${doc.id}')">Delete My Post</button>` 
    : `<button class="btn btn-primary" onclick="startChat('${post.authorId}', '${author.name}')">Chat with Author</button>`
  }
`;
        container.appendChild(card);
      });
      

         } else if (currentRole === 'alumni') {
      // ALUMNI: See ALL published posts (all auto-approved now)
      const snapshot = await db.collection('posts').orderBy('createdAt', 'desc').get();

      container.innerHTML = '';
      let hasAnyPosts = false;

      snapshot.forEach(async doc => {
        const post = doc.data();
        hasAnyPosts = true;
        
        const authorDoc = await db.collection('users').doc(post.authorId).get();
        const author = authorDoc.data();
        
        const card = document.createElement('div');
        card.className = 'card';
        
        card.innerHTML = `
          <h3>${post.title}</h3>
          <p style="color:#666; font-size:12px;">
            ${post.type.toUpperCase()} | By <strong>${author.name}</strong>
          </p>
          <p>${post.description}</p>
          ${post.authorId === currentUser.uid ? `<button class="btn btn-danger" onclick="deletePost('${doc.id}')">Delete My Post</button>` : `<button class="btn btn-primary" onclick="startChat('${post.authorId}', '${author.name}')">Chat with ${author.name}</button>`}
        `;
        container.appendChild(card);
      });

      if (!hasAnyPosts) {
        container.innerHTML = '<p style="text-align:center; color:#999;">No posts yet. Create one!</p>';
      }


    } else if (currentRole === 'admin') {
      // ADMIN: See ALL posts (approved + pending)
      const snapshot = await db.collection('posts').orderBy('createdAt', 'desc').get();

      container.innerHTML = '';
      if (snapshot.empty) {
        container.innerHTML = '<p style="text-align:center; color:#999;">No posts yet</p>';
        return;
      }

      snapshot.forEach(async doc => {
        const post = doc.data();
        const authorDoc = await db.collection('users').doc(post.authorId).get();
        const author = authorDoc.data();

        const card = document.createElement('div');
        card.className = 'card';
        const statusBadge = post.approved ? '✓ Approved' : '⏳ Pending Review';
        const statusColor = post.approved ? '#10b981' : '#f59e0b';

        card.innerHTML = `
          <h3>${post.title}</h3>
          <p style="color:#666; font-size:12px;">
            By <strong>${author.name}</strong> | ${post.type.toUpperCase()} | 
            <span style="color:${statusColor}; font-weight:bold;">${statusBadge}</span>
          </p>
          <p>${post.description}</p>
          ${!post.approved ? `<button class="btn btn-primary" onclick="approvePost('${doc.id}')">Approve</button>` : ''}
          <button class="btn btn-danger" onclick="rejectPost('${doc.id}')">Reject</button>
        `;
        container.appendChild(card);
      });
    }
  } catch (error) {
    container.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
  }
}


// ==========================================
// POST FUNCTIONS
// ==========================================

document.getElementById('btnCreatePost').addEventListener('click', async () => {
  const title = document.getElementById('postTitle').value.trim();
  const desc = document.getElementById('postDesc').value.trim();
  const type = document.getElementById('postType').value;

  if (!title || !desc) {
    showAlert('createPostAlert', 'Fill all fields', 'error');
    return;
  }

  try {
    await db.collection('posts').add({
      title, 
      description: desc, 
      type,
      authorId: currentUser.uid,
      approved: true,
      createdAt: new Date()
    });
    showAlert('createPostAlert', 'Post submitted for review!', 'success');
    document.getElementById('postTitle').value = '';
    document.getElementById('postDesc').value = '';
    setTimeout(() => loadFeed(), 1000);
  } catch (error) {
    showAlert('createPostAlert', error.message, 'error');
  }
});

async function deletePost(postId) {
  if (confirm('Delete this post?')) {
    await db.collection('posts').doc(postId).delete();
    loadFeed();
  }
}

// ==========================================
// PROFILE FUNCTIONS
// ==========================================

async function loadProfile() {
  if (currentRole !== 'alumni') return;

  const user = currentUser;
  document.getElementById('profName').value = user.name || '';
  document.getElementById('profJobTitle').value = user.jobTitle || '';
  document.getElementById('profCompany').value = user.company || '';
  document.getElementById('profSkills').value = (user.skills || []).join(', ');
  document.getElementById('profInterests').value = (user.interests || []).join(', ');
}

document.getElementById('btnSaveProfile').addEventListener('click', async () => {
  try {
    await db.collection('users').doc(currentUser.uid).update({
      name: document.getElementById('profName').value,
      jobTitle: document.getElementById('profJobTitle').value,
      company: document.getElementById('profCompany').value,
      skills: document.getElementById('profSkills').value.split(',').map(s => s.trim()).filter(Boolean),
      interests: document.getElementById('profInterests').value.split(',').map(i => i.trim()).filter(Boolean)
    });
    showAlert('profileAlert', 'Profile updated!', 'success');
    // Update local state
    currentUser.name = document.getElementById('profName').value;
    currentUser.jobTitle = document.getElementById('profJobTitle').value;
    currentUser.company = document.getElementById('profCompany').value;
  } catch (error) {
    showAlert('profileAlert', error.message, 'error');
  }
});

// ==========================================
// CHAT FUNCTIONS
// ==========================================

// ==========================================
// CHAT FUNCTIONS
// ==========================================


let currentChatMode = 'private'; // 'private' or 'group'

function switchChatMode(mode) {
  currentChatMode = mode;
  
  // UI Toggles
  document.getElementById('btnPrivateTab').classList.toggle('active', mode === 'private');
  document.getElementById('btnGroupTab').classList.toggle('active', mode === 'group');
  document.getElementById('privateChatControls').style.display = (mode === 'private') ? 'block' : 'none';
  
  // Reset and Load
  const messagesEl = document.getElementById('chatMessages');
  messagesEl.innerHTML = '';
  
  if (mode === 'group') {
    currentChatWith = { id: 'global_group', name: 'Global Community' };
    loadChatMessages();
  } else {
    currentChatWith = null;
    const select = document.getElementById('chatSelect');
    if (select.value) {
      const alumniName = select.options[select.selectedIndex].text;
      startChat(select.value, alumniName);
    }
  }
}

async function startChat(alumniId, alumniName) {
  currentChatWith = { id: alumniId, name: alumniName };
  showView('chatView');
  loadChatMessages();
}

async function loadChatMessages() {
  if (!currentChatWith) return;

  // Pathing based on mode
  const chatPath = (currentChatMode === 'private') 
    ? `messages/private/${[currentUser.uid, currentChatWith.id].sort().join('_')}`
    : `messages/public/global_group`;

  const messagesEl = document.getElementById('chatMessages');
  rtdb.ref(chatPath).off(); // Prevent duplicate listeners

  rtdb.ref(chatPath).limitToLast(50).on('child_added', (snap) => {
    const msg = snap.val();
    const div = document.createElement('div');
    div.className = msg.senderId === currentUser.uid ? 'msg-sent' : 'msg-received';
    
    // Group mode adds a sender name label
    const senderLabel = (currentChatMode === 'group' && msg.senderId !== currentUser.uid) 
      ? `<span class="msg-sender-name">${msg.senderName}</span>` 
      : '';

    div.innerHTML = `
      ${senderLabel}
      <p>${msg.text}</p>
      <span class="msg-time">${new Date(msg.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
    `;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}

document.getElementById('btnSendMessage').addEventListener('click', async () => {
  const text = document.getElementById('chatInput').value.trim();
  if (!text || !currentChatWith) return;

  const chatPath = (currentChatMode === 'private') 
    ? `messages/private/${[currentUser.uid, currentChatWith.id].sort().join('_')}`
    : `messages/public/global_group`;

  await rtdb.ref(chatPath).push({
    senderId: currentUser.uid,
    senderName: currentUser.name,
    text,
    time: Date.now()
  });

  document.getElementById('chatInput').value = '';
});

// Load alumni list for chat
async function loadChatAlumni() {
  const select = document.getElementById('chatSelect');
  select.innerHTML = '<option value="">Select Alumni...</option>';
  
  const snapshot = await db.collection('users')
    .where('role', '==', 'alumni')
    .where('verified', '==', true)
    .get();

  snapshot.forEach(doc => {
    const opt = document.createElement('option');
    opt.value = doc.id;
    opt.textContent = doc.data().name;
    select.appendChild(opt);
  });

  select.addEventListener('change', () => {
    if (select.value) {
      const alumni = snapshot.docs.find(d => d.id === select.value).data();
      startChat(select.value, alumni.name);
    }
  });
}

// ==========================================
// OFFICE HOURS ROULETTE
// ==========================================

function setupPresence() {
  if (currentRole !== 'alumni') return;

  const presenceRef = rtdb.ref(`presence/${currentUser.uid}`);
  presenceRef.onDisconnect().set({ state: 'offline', time: Date.now() });
  presenceRef.set({ state: 'online', time: Date.now() });
}

document.getElementById('btnUpdateLive').addEventListener('click', async () => {
  const isLive = document.getElementById('alumniLiveToggle').checked;
  const question = document.getElementById('alumniDefaultQuestion').value.trim();

  try {
    await db.collection('users').doc(currentUser.uid).update({
      isLive,
      defaultQuestion: question
    });

    await rtdb.ref(`liveAlumni/${currentUser.uid}`).set({
      isLive,
      name: currentUser.name,
      updatedAt: Date.now()
    });

    alert(isLive ? '✅ You are now LIVE!' : '❌ You are offline');
  } catch (error) {
    alert('Error: ' + error.message);
  }
});

document.getElementById('btnFindAlumni').addEventListener('click', async () => {
  const question = document.getElementById('studentQuestion').value.trim();
  const statusDiv = document.getElementById('rouletteStatus');
  statusDiv.innerHTML = '<p>Finding live alumni...</p>';

  try {
    const snapshot = await db.collection('users')
      .where('role', '==', 'alumni')
      .where('verified', '==', true)
      .where('isLive', '==', true)
      .get();

    if (snapshot.empty) {
      statusDiv.innerHTML = '<p style="color:#666;">No alumni live right now. Try again later!</p>';
      return;
    }

    const alumni = snapshot.docs[Math.floor(Math.random() * snapshot.docs.length)];
    const alumniData = alumni.data();

    statusDiv.innerHTML = `
      <p><strong>Matched with ${alumniData.name}</strong></p>
      <p>Your question: ${question}</p>
      <a href="https://meet.google.com/" target="_blank" class="btn btn-primary">Join 5-min Call</a>
    `;

    await db.collection('roulette_sessions').add({
      studentId: currentUser.uid,
      alumniId: alumni.id,
      question,
      timestamp: new Date()
    });
  } catch (error) {
    statusDiv.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
  }
});

// ==========================================
// ADMIN FUNCTIONS
// ==========================================

async function loadAdmin() {
  const pendingAlumniDiv = document.getElementById('pendingAlumniList');
  const allPostsDiv = document.getElementById('pendingPostsList');

  try {
    const alumniSnapshot = await db.collection('users')
      .where('role', '==', 'alumni')
      .where('verified', '==', false)
      .get();

    pendingAlumniDiv.innerHTML = '';
    if (alumniSnapshot.empty) {
      pendingAlumniDiv.innerHTML = '<p style="color:#999;">No pending alumni</p>';
    } else {
      alumniSnapshot.forEach(doc => {
        const alumni = doc.data();
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
          <h4>${alumni.name}</h4>
          <p>${alumni.jobTitle} @ ${alumni.company}</p>
          <button class="btn btn-primary" onclick="approveAlumni('${doc.id}')">Verify Alumni</button>
          <button class="btn btn-danger" onclick="rejectAlumni('${doc.id}')">Reject</button>
        `;
        pendingAlumniDiv.appendChild(div);
      });
    }

    // NOW SHOWING ALL POSTS (for admin to reject irrelevant ones)
    const postsSnapshot = await db.collection('posts')
      .orderBy('createdAt', 'desc')
      .get();

    allPostsDiv.innerHTML = '';
    if (postsSnapshot.empty) {
      allPostsDiv.innerHTML = '<p style="color:#999;">No posts</p>';
    } else {
      postsSnapshot.forEach(async doc => {
        const post = doc.data();
        const authorDoc = await db.collection('users').doc(post.authorId).get();
        const author = authorDoc.data();
        
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
          <h4>${post.title}</h4>
          <p style="color:#666; font-size:12px;">By <strong>${author.name}</strong> | ${post.type.toUpperCase()}</p>
          <p>${post.description}</p>
          <button class="btn btn-danger" onclick="rejectPost('${doc.id}')">❌ Delete (Irrelevant)</button>
        `;
        allPostsDiv.appendChild(div);
      });
    }

  } catch (error) {
    console.error('Admin load error:', error);
  }
}

async function approveAlumni(uid) {
  await db.collection('users').doc(uid).update({ verified: true });
  loadAdmin();
}

async function rejectAlumni(uid) {
  await db.collection('users').doc(uid).delete();
  loadAdmin();
}

async function approvePost(postId) {
  await db.collection('posts').doc(postId).update({ approved: true });
  loadAdmin();
  loadFeed();
}

async function rejectPost(postId) {
  await db.collection('posts').doc(postId).delete();
  loadAdmin();
  loadFeed();
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function applyAlumniFilters() {
  loadFeed();
}

// Event Listeners
document.getElementById('btnRegister').addEventListener('click', registerUser);
document.getElementById('btnLogin').addEventListener('click', loginUser);
document.getElementById('btnLogout').addEventListener('click', logoutUser);
document.getElementById('btnLogoutSidebar').addEventListener('click', logoutUser);

// Initialize on load
window.addEventListener('load', () => {
  setupPresence();
  if (currentRole === 'student') {
    loadChatAlumni();
  }
});
// ==========================================
// EMAIL VALIDATION FUNCTION
// ==========================================

function isCollegeEmail(email) {
  // List of accepted college email domains
  const collegeEmailDomains = [
    '@bvmengineering.ac.in',
    '@bvm.ac.in',
    '@bvmieu.ac.in',
    '@bvmhs.ac.in'
    // Add more college domains as needed
  ];

  // Check if email ends with any of the college domains
  return collegeEmailDomains.some(domain => email.toLowerCase().endsWith(domain));
}