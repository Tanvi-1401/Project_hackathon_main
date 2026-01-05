// 🔥 BVM Alumni Portal - Complete Firebase Logic
// STEP 1: Replace firebaseConfig with YOUR credentials from Firebase Console


// 🔥 BVM Alumni Portal - Complete Firebase Logic (Compat SDK)
// STEP 1: Replace firebaseConfig with YOUR credentials from Firebase Console
let chatUsersUnsubscribe = null;
let activeChatRef = null;

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

function switchTab(tab, event) {
  document.getElementById('loginForm').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none';
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  if (event && event.target) {
    event.target.classList.add('active');
  } else {
    // Fallback: activate the tab based on the tab parameter
    document.querySelectorAll('.auth-tab').forEach(t => {
      if ((tab === 'login' && t.textContent.trim().toLowerCase() === 'login') ||
          (tab === 'register' && t.textContent.trim().toLowerCase() === 'register')) {
        t.classList.add('active');
      }
    });
  }
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

    // Clean name to remove any role suffixes before storing
    const cleanName = cleanUserName(name);

    let userData = {
      email, 
      role, 
      name: cleanName, // Store cleaned name
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
  if (activeChatRef) {
  activeChatRef.off();
  activeChatRef = null;
}

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

    const userData = userDoc.data();
    // Ensure required fields exist with defaults and clean name
    currentUser = { 
      uid: user.uid, 
      email: userData.email || '',
      role: userData.role || 'student',
      name: cleanUserName(userData.name || ''), // Clean name on load
      verified: userData.verified !== undefined ? userData.verified : (userData.role === 'student'),
      ...userData 
    };
    // Override name with cleaned version
    currentUser.name = cleanUserName(currentUser.name || '');
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

    // Load chat recipients list (students see alumni, alumni see students)
    if (currentRole === 'student' || currentRole === 'alumni') {
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
  addMenuItem('🤖 AI Assistant', 'aiChatView');
  addMenuItem('🎯 Office Hours', 'rouletteView');
}


  if (currentRole === 'admin') {
    addMenuItem('👑 Admin', 'adminView');
  }

  
}

function showView(viewId) {
  document.querySelectorAll('.view-page').forEach(v => v.style.display = 'none');
  document.getElementById(viewId).style.display = 'block';

  if (viewId === 'feedView') loadFeed();
  if (viewId === 'profileView') loadProfile();
  if (viewId === 'rouletteView') initRouletteView();
  if (viewId === 'adminView') loadAdmin();
  
  // Show/hide roulette sections based on role
  if (viewId === 'rouletteView') {
    const alumniRoulette = document.getElementById('alumniRoulette');
    const studentRoulette = document.getElementById('studentRoulette');
    if (alumniRoulette) alumniRoulette.style.display = (currentRole === 'alumni') ? 'block' : 'none';
    if (studentRoulette) studentRoulette.style.display = (currentRole === 'student') ? 'block' : 'none';
  }
  
  // Initialize chat view
  if (viewId === 'chatView') {
    // If in private mode and no recipient selected, show placeholder
    if (currentChatMode === 'private' && !currentChatWith) {
      const messagesEl = document.getElementById('chatMessages');
      const chatInput = document.getElementById('chatInput');
      const btnSendMessage = document.getElementById('btnSendMessage');
      if (messagesEl) {
        messagesEl.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">Select a recipient to start chatting</p>';
      }
      if (chatInput) chatInput.disabled = true;
      if (btnSendMessage) btnSendMessage.disabled = true;
    } else if (currentChatWith) {
      // Reload messages if we have a chat session
      const chatInput = document.getElementById('chatInput');
      const btnSendMessage = document.getElementById('btnSendMessage');
      if (chatInput) chatInput.disabled = false;
      if (btnSendMessage) btnSendMessage.disabled = false;
      loadChatMessages();
    } else if (currentChatMode === 'group') {
      // Auto-load group chat
      currentChatWith = { id: 'global_group', name: 'Global Community' };
      const chatInput = document.getElementById('chatInput');
      const btnSendMessage = document.getElementById('btnSendMessage');
      if (chatInput) chatInput.disabled = false;
      if (btnSendMessage) btnSendMessage.disabled = false;
      loadChatMessages();
    }
  }
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

      // Use Promise.all to properly await all async operations
      const postPromises = snapshot.docs.map(async doc => {
        const post = doc.data();
        const authorDoc = await db.collection('users').doc(post.authorId).get();
        const author = authorDoc.data();

        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
  <h3>${post.title}</h3>
  <p>${post.description}</p>
  ${post.authorId === currentUser.uid 
    ? `<button class="btn btn-danger" onclick="deletePost('${doc.id}')">Delete My Post</button>` 
    : `<button class="btn btn-primary" onclick="startChat('${post.authorId}', '${author.name}')">Chat with Author</button>`
  }
`;
        return card;
      });
      
      const cards = await Promise.all(postPromises);
      cards.forEach(card => container.appendChild(card));
      

         } else if (currentRole === 'alumni') {
      // ALUMNI: See ALL published posts (all auto-approved now)
      const snapshot = await db.collection('posts').orderBy('createdAt', 'desc').get();

      container.innerHTML = '';
      let hasAnyPosts = false;

      // Use Promise.all to properly await all async operations
      const postPromises = snapshot.docs.map(async doc => {
        const post = doc.data();
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
        return card;
      });
      
      const cards = await Promise.all(postPromises);
      if (cards.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#999;">No posts yet. Create one!</p>';
      } else {
        cards.forEach(card => container.appendChild(card));
      }


    } else if (currentRole === 'admin') {
      // ADMIN: See ALL posts (approved + pending)
      const snapshot = await db.collection('posts').orderBy('createdAt', 'desc').get();

      container.innerHTML = '';
      if (snapshot.empty) {
        container.innerHTML = '<p style="text-align:center; color:#999;">No posts yet</p>';
        return;
      }

      // Use Promise.all to properly await all async operations
      const postPromises = snapshot.docs.map(async doc => {
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
        return card;
      });
      
      const cards = await Promise.all(postPromises);
      cards.forEach(card => container.appendChild(card));
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
  // Clean name to remove any role suffixes
  const cleanName = cleanUserName(user.name || '');
  document.getElementById('profName').value = cleanName;
  document.getElementById('profJobTitle').value = user.jobTitle || '';
  document.getElementById('profCompany').value = user.company || '';
  // Filter out empty strings from arrays
  document.getElementById('profSkills').value = (user.skills || []).filter(s => s && s.trim()).join(', ');
  document.getElementById('profInterests').value = (user.interests || []).filter(i => i && i.trim()).join(', ');
}

document.getElementById('btnSaveProfile').addEventListener('click', async () => {
  try {
    const name = document.getElementById('profName').value.trim();
    const jobTitle = document.getElementById('profJobTitle').value.trim();
    const company = document.getElementById('profCompany').value.trim();
    const skills = document.getElementById('profSkills').value.split(',').map(s => s.trim()).filter(Boolean);
    const interests = document.getElementById('profInterests').value.split(',').map(i => i.trim()).filter(Boolean);
    
    // Clean name before saving to ensure no role suffixes
    const cleanName = cleanUserName(name);
    
    await db.collection('users').doc(currentUser.uid).update({
      name: cleanName,
      jobTitle: jobTitle || null, // Store null instead of empty string
      company: company || null,
      skills: skills.length > 0 ? skills : [], // Ensure array, not null
      interests: interests.length > 0 ? interests : []
    });
    showAlert('profileAlert', 'Profile updated!', 'success');
    // Update local state with cleaned name
    currentUser.name = cleanName;
    currentUser.jobTitle = jobTitle;
    currentUser.company = company;
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
  // Disconnect previous listeners BEFORE changing mode
  if (currentChatWith && currentUser) {
    const oldPath = (currentChatMode === 'private') 
      ? `messages/private/${[currentUser.uid, currentChatWith.id].sort().join('_')}`
      : `messages/public/global_group`;
    rtdb.ref(oldPath).off();
  }
  
  currentChatMode = mode;
  
  // UI Toggles
  const btnPrivateTab = document.getElementById('btnPrivateTab');
  const btnGroupTab = document.getElementById('btnGroupTab');
  const privateChatControls = document.getElementById('privateChatControls');
  
  if (btnPrivateTab) btnPrivateTab.classList.toggle('active', mode === 'private');
  if (btnGroupTab) btnGroupTab.classList.toggle('active', mode === 'group');
  if (privateChatControls) privateChatControls.style.display = (mode === 'private') ? 'block' : 'none';
  
  // Reset and Load
  const messagesEl = document.getElementById('chatMessages');
  if (messagesEl) messagesEl.innerHTML = '';
  
  if (mode === 'group') {
    currentChatWith = { id: 'global_group', name: 'Global Community' };
    const chatInput = document.getElementById('chatInput');
    const btnSendMessage = document.getElementById('btnSendMessage');
    if (chatInput) chatInput.disabled = false;
    if (btnSendMessage) btnSendMessage.disabled = false;
    loadChatMessages();
  } else {
    // For private mode, check if there's a selected recipient
    const select = document.getElementById('chatSelect');
    if (select && select.value) {
      const recipientName = select.options[select.selectedIndex].text;
      startChat(select.value, recipientName);
    } else {
      currentChatWith = null;
      const chatInput = document.getElementById('chatInput');
      const btnSendMessage = document.getElementById('btnSendMessage');
      if (chatInput) chatInput.disabled = true;
      if (btnSendMessage) btnSendMessage.disabled = true;
      if (messagesEl) {
        messagesEl.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">Select a recipient to start chatting</p>';
      }
    }
  }
}

async function startChat(recipientId, recipientName) {
  currentChatWith = { id: recipientId, name: recipientName };
  currentChatMode = 'private'; // Ensure we're in private mode
  
  // Update UI
  const btnPrivateTab = document.getElementById('btnPrivateTab');
  const btnGroupTab = document.getElementById('btnGroupTab');
  if (btnPrivateTab) btnPrivateTab.classList.add('active');
  if (btnGroupTab) btnGroupTab.classList.remove('active');
  
  // Enable input and send button
  const chatInput = document.getElementById('chatInput');
  const btnSendMessage = document.getElementById('btnSendMessage');
  if (chatInput) chatInput.disabled = false;
  if (btnSendMessage) btnSendMessage.disabled = false;
  
  showView('chatView');
  loadChatMessages();
}

async function loadChatMessages() {
  if (!currentChatWith || !currentUser) {
    const messagesEl = document.getElementById('chatMessages');
    if (messagesEl) {
      messagesEl.innerHTML =
        '<p style="text-align:center; color:#999; padding:20px;">Select a recipient to start chatting</p>';
    }
    return;
  }

  // Determine chat path
  const chatPath =
    currentChatMode === 'private'
      ? `messages/private/${[currentUser.uid, currentChatWith.id].sort().join('_')}`
      : `messages/public/global_group`;

  const messagesEl = document.getElementById('chatMessages');
  if (!messagesEl) return;

  // 🔥 DETACH PREVIOUS LISTENER (CRITICAL FIX)
  if (activeChatRef) {
    activeChatRef.off();
    activeChatRef = null;
  }

  // 🔥 CREATE NEW REF AND STORE IT
  activeChatRef = rtdb.ref(chatPath);

  // Clear UI and show loading
  messagesEl.innerHTML =
    '<p style="text-align:center; color:#999; padding:20px;">Loading messages...</p>';

  try {
    // 🔹 Load existing messages ONCE
    const snapshot = await activeChatRef.limitToLast(50).once('value');
    messagesEl.innerHTML = '';

    if (snapshot.exists()) {
      const messages = [];

      snapshot.forEach(child => {
        messages.push({ key: child.key, ...child.val() });
      });

      // Sort messages by timestamp
      messages.sort((a, b) => (a.time || 0) - (b.time || 0));

      messages.forEach(msg => {
        renderMessage(msg, messagesEl);
      });

      messagesEl.scrollTop = messagesEl.scrollHeight;
    } else {
      messagesEl.innerHTML =
        '<p style="text-align:center; color:#999; padding:20px;">No messages yet. Start the conversation!</p>';
    }
  } catch (error) {
    console.error('Error loading messages:', error);
    messagesEl.innerHTML =
      `<p style="text-align:center; color:red; padding:20px;">${error.message}</p>`;
  }

  // 🔥 ATTACH REAL-TIME LISTENER (ONLY ONCE)
  activeChatRef.limitToLast(50).on('child_added', snap => {
    const messagesEl = document.getElementById('chatMessages');
    if (!messagesEl) return;

    // Prevent duplicates
    if (messagesEl.querySelector(`[data-msg-key="${snap.key}"]`)) return;

    const msg = { key: snap.key, ...snap.val() };
    renderMessage(msg, messagesEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}
function renderMessage(msg, messagesEl) {
  const div = document.createElement('div');
  div.className =
    msg.senderId === currentUser.uid ? 'msg-sent' : 'msg-received';

  div.setAttribute('data-msg-key', msg.key);

  const cleanSenderName = cleanUserName(msg.senderName || 'Unknown');

  const senderLabel =
    currentChatMode === 'group' && msg.senderId !== currentUser.uid
      ? `<span class="msg-sender-name">${cleanSenderName}</span>`
      : '';

  div.innerHTML = `
    ${senderLabel}
    <p>${msg.text || ''}</p>
    <span class="msg-time">
      ${msg.time
        ? new Date(msg.time).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          })
        : ''}
    </span>
  `;

  messagesEl.appendChild(div);
}


// Send message function
async function sendMessage() {
  if (!currentUser || !currentChatWith) {
    alert('Please select a recipient first');
    return;
  }
  
  const chatInput = document.getElementById('chatInput');
  const text = chatInput.value.trim();
  
  if (!text) return;

  const chatPath = (currentChatMode === 'private') 
    ? `messages/private/${[currentUser.uid, currentChatWith.id].sort().join('_')}`
    : `messages/public/global_group`;

  try {
    await rtdb.ref(chatPath).push({
      senderId: currentUser.uid,
      senderName: cleanUserName(currentUser.name), // Clean name before storing
      text,
      time: Date.now()
    });

    chatInput.value = '';
  } catch (error) {
    console.error('Error sending message:', error);
    alert('Failed to send message: ' + error.message);
  }
}

// Set up send message button
document.getElementById('btnSendMessage').addEventListener('click', sendMessage);

// Add Enter key support for sending messages
document.getElementById('chatInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Helper function to clean name by removing role suffixes
function cleanUserName(name) {
  if (!name) return name;
  // Remove common role suffixes: (student), (alumni), (admin), etc.
  return name.replace(/\s*\(student\)/gi, '')
              .replace(/\s*\(alumni\)/gi, '')
              .replace(/\s*\(admin\)/gi, '')
              .trim();
}

// Load chat recipients list (students see alumni, alumni see students)
async function loadChatAlumni() {
  const select = document.getElementById('chatSelect');
  if (!select) return;

  // 🔥 STOP previous listener
  if (chatUsersUnsubscribe) {
    chatUsersUnsubscribe();
    chatUsersUnsubscribe = null;
  }

  // 🔥 CLEAR dropdown fully
  select.innerHTML = '';

  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent =
    currentRole === 'student'
      ? 'Select Alumni...'
      : 'Select Student...';

  select.appendChild(defaultOption);

  // 🔐 STRICT role-based query
  let query;

  if (currentRole === 'student') {
    query = db.collection('users')
      .where('role', '==', 'alumni')
      .where('verified', '==', true);
  } else if (currentRole === 'alumni') {
    query = db.collection('users')
      .where('role', '==', 'student');
  } else {
    return; // admin shouldn't load chat list
  }

  // 🔥 SINGLE snapshot listener
  chatUsersUnsubscribe = query.onSnapshot(snapshot => {
    select.innerHTML = '';
    select.appendChild(defaultOption);

    snapshot.forEach(doc => {
      if (doc.id === currentUser.uid) return;

      const user = doc.data();

      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = cleanUserName(user.name);

      select.appendChild(option);
    });
  });
}

// ==========================================
// OFFICE HOURS ROULETTE
// ==========================================
// ==========================================
// OFFICE HOURS ROULETTE (NO-API VERSION)
// ==========================================

// ==========================================
// OFFICE HOURS ROULETTE (REAL-TIME LIST VERSION)
// ==========================================

let alumniQueueUnsubscribe = null; // Listener for Alumni to see Students
let liveAlumniUnsubscribe = null;  // Listener for Students to see Alumni
let myRequestUnsubscribe = null;   // Listener for Student to know if admitted

// ------------------------------------------
// 1. SHARED: Initialization (Call this when opening the view)
// ------------------------------------------
function initRouletteView()  {
  if (currentRole === 'alumni') {
    // Check if I am already live
    if (currentUser.isLive) {
      document.getElementById('alumniLiveToggle').checked = true;
      document.getElementById('alumniMeetLink').value = currentUser.meetLink || '';
      
      // SHOW RED BUTTON, HIDE BLUE BUTTON
      document.getElementById('btnStopLive').style.display = 'block';
      document.getElementById('btnUpdateLive').style.display = 'none';
      
      listenToMyQueue();
    } else {
      // Ensure defaults
      document.getElementById('btnStopLive').style.display = 'none';
      document.getElementById('btnUpdateLive').style.display = 'block';
    }
  } 
  // ... rest of student logic ...

   else if (currentRole === 'student') {
    // Start listening for ANY alumni going live
    listenForLiveAlumni();
  }
}

// Hook this into your showView function
// Find the existing showView() in app.js and add:
// if (viewId === 'rouletteView') initRouletteView();


// ------------------------------------------
// 2. ALUMNI FUNCTIONS
// ------------------------------------------

// ------------------------------------------
// 2. ALUMNI FUNCTIONS
// ------------------------------------------

// BLUE BUTTON: GO LIVE
document.getElementById('btnUpdateLive').addEventListener('click', async () => {
  const isLive = document.getElementById('alumniLiveToggle').checked;
  const meetLink = document.getElementById('alumniMeetLink').value.trim();

  // 1. Validation: Must have a link to go live
  if (isLive && !meetLink) {
    alert("❌ Please paste your Google Meet link first!");
    document.getElementById('alumniLiveToggle').checked = false;
    return;
  }

  try {
    // 2. Update Cloud Status
    await db.collection('users').doc(currentUser.uid).update({
      isLive: isLive,
      meetLink: meetLink || ""
    });

    // 3. Update Local State
    currentUser.isLive = isLive;
    currentUser.meetLink = meetLink;

    if (isLive) {
      alert('✅ You are now LIVE! Students can see you.');
      
      // UI: Switch to "Live Mode" (Hide Blue, Show Red)
      document.getElementById('btnUpdateLive').style.display = 'none';
      document.getElementById('btnStopLive').style.display = 'block';
      
      listenToMyQueue();
    } else {
      // If they unchecked the box and clicked Update (Legacy way)
      alert('You are offline.');
      handleOfflineUI();
    }
  } catch (error) {
    console.error(error);
    alert('Error: ' + error.message);
  }
});

// RED BUTTON: STOP LIVE SESSION
document.getElementById('btnStopLive').addEventListener('click', async () => {
  if (!confirm("🔴 End Session?\n\nThis will remove you from the student list and stop new requests.")) {
    return;
  }

  try {
    // 1. Force status to offline in Database
    await db.collection('users').doc(currentUser.uid).update({
      isLive: false
    });

    // 2. Update Local State & UI
    currentUser.isLive = false;
    document.getElementById('alumniLiveToggle').checked = false;
    
    handleOfflineUI();

    alert("🔴 Session Ended. You are now offline.");

  } catch (error) {
    console.error(error);
    alert("Error stopping session: " + error.message);
  }
});

// Helper to reset UI when going offline
function handleOfflineUI() {
  // Toggle Buttons
  document.getElementById('btnStopLive').style.display = 'none';
  document.getElementById('btnUpdateLive').style.display = 'block';
  
  // Clear Queue Display
  document.getElementById('alumniQueueContainer').innerHTML = '<p style="color:#999; text-align:center;">You are offline.</p>';

  // Stop Listening
  if (alumniQueueUnsubscribe) alumniQueueUnsubscribe();
}

// Queue Listener (Shows students waiting)
function listenToMyQueue() {
  const container = document.getElementById('alumniQueueContainer');
  
  // Stop previous listener if exists
  if (alumniQueueUnsubscribe) alumniQueueUnsubscribe();

  // Listen to MY sub-collection 'queue'
  alumniQueueUnsubscribe = db.collection('users').doc(currentUser.uid).collection('queue')
    .where('status', '==', 'waiting')
    .orderBy('timestamp', 'asc')
    .onSnapshot(snapshot => {
      container.innerHTML = '';
      
      if (snapshot.empty) {
        container.innerHTML = '<p style="color:#999; text-align:center;">No students waiting yet.</p>';
        return;
      }

      snapshot.forEach(doc => {
        const req = doc.data();
        const card = document.createElement('div');
        card.className = 'card';
        card.style.background = '#fff';
        card.style.borderLeft = '4px solid #f59e0b'; // Orange strip
        card.style.marginBottom = '10px';
        
        // Clean timestamp
        const timeAgo = req.timestamp ? new Date(req.timestamp.toDate()).toLocaleTimeString() : 'Just now';

        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <h4 style="margin:0; font-size:16px;">${req.studentName}</h4>
              <p style="margin:4px 0 0 0; font-size:13px; color:#555;">Topic: <strong>${req.question}</strong></p>
              <small style="color:#999; font-size:11px;">Joined: ${timeAgo}</small>
            </div>
            <button class="btn btn-primary btn-sm" onclick="admitStudent('${doc.id}')">Accept</button>
          </div>
        `;
        container.appendChild(card);
      });
    });
}

// Accept Student
async function admitStudent(studentId) {
  try {
    await db.collection('users').doc(currentUser.uid).collection('queue').doc(studentId).update({
      status: 'admitted'
    });
    // Visual feedback is handled by the snapshot listener removing the item from 'waiting' list
  } catch (error) {
    alert("Error admitting student: " + error.message);
  }
}

// ------------------------------------------
// 3. STUDENT FUNCTIONS
// ------------------------------------------

function listenForLiveAlumni() {
  const container = document.getElementById('liveAlumniContainer');
  
  if (liveAlumniUnsubscribe) liveAlumniUnsubscribe();

  // Query ALL users who are Alumni AND Live
  liveAlumniUnsubscribe = db.collection('users')
    .where('role', '==', 'alumni')
    .where('isLive', '==', true)
    .onSnapshot(snapshot => {
      container.innerHTML = '';

      // 🛑 CASE 1: NO ALUMNI ARE LIVE (The "Empty State")
      if (snapshot.empty) {
        container.innerHTML = `
          <div style="text-align:center; padding:40px 20px; background:#f8f9fa; border-radius:12px; border:2px dashed #e5e7eb;">
            <div style="font-size:40px; margin-bottom:10px;">☕</div>
            <h3 style="color:#374151; margin-bottom:5px;">No Alumni are live right now</h3>
            <p style="color:#6b7280; font-size:14px; margin-bottom:20px;">
              Most alumni go live during evenings or weekends.<br>
              While you wait, you can prepare your questions!
            </p>
            <button onclick="showView('feedView')" class="btn btn-secondary btn-sm">
              📰 Read the News Feed
            </button>
          </div>`;
        return;
      }

      // ✅ CASE 2: SHOW LIVE ALUMNI
      snapshot.forEach(doc => {
        const alumni = doc.data();
        const card = document.createElement('div');
        card.className = 'card';
        card.style.display = 'flex';
        card.style.justifyContent = 'space-between';
        card.style.alignItems = 'center';
        card.style.marginBottom = '10px';
        card.style.borderLeft = '4px solid #10b981'; // Green "Live" strip
        
        card.innerHTML = `
          <div>
            <h4 style="margin:0; font-size:16px;">${alumni.name}</h4>
            <p style="margin:4px 0 0 0; font-size:12px; color:#666;">
              ${alumni.jobTitle || 'Alumni'} @ ${alumni.company || 'Unknown'}
            </p>
            <div style="display:flex; align-items:center; gap:6px; margin-top:6px;">
              <span class="status-dot" style="width:8px; height:8px; background:red; border-radius:50%; display:inline-block; animation: pulse 1.5s infinite;"></span>
              <span style="font-size:11px; color:red; font-weight:bold; letter-spacing:0.5px;">LIVE NOW</span>
            </div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="joinSpecificQueue('${doc.id}', '${alumni.name}')">
            Join Queue
          </button>
        `;
        container.appendChild(card);
      });
    });
}

async function joinSpecificQueue(alumniId, alumniName) {
  const inputField = document.getElementById('studentQuestion');
  const question = inputField.value.trim();
  
  // 🛑 VALIDATION: Must write a question first
  if (!question) {
    // Visual Feedback: Shake the input box & turn border red
    inputField.style.border = "2px solid red";
    inputField.style.transition = "0.1s";
    
    // Simple "Shake" animation using margin
    setTimeout(() => inputField.style.transform = "translateX(5px)", 50);
    setTimeout(() => inputField.style.transform = "translateX(-5px)", 100);
    setTimeout(() => inputField.style.transform = "translateX(5px)", 150);
    setTimeout(() => {
      inputField.style.transform = "translateX(0)";
      inputField.focus(); // Move cursor to the box
    }, 200);

    alert("⚠️ Please write your topic/question in the box above first!");
    return;
  }

  // Reset border style if it was red
  inputField.style.border = "1px solid #ddd";

  // UI: Show Waiting Room
  document.getElementById('studentSearchArea').style.display = 'none';
  document.getElementById('studentWaitingRoom').style.display = 'block';
  document.getElementById('waitingText').innerHTML = `Waiting for <strong>${alumniName}</strong> to accept you...`;

  try {
    // 1. Write to specific Alumni's queue
    await db.collection('users').doc(alumniId).collection('queue').doc(currentUser.uid).set({
      studentName: currentUser.name,
      studentId: currentUser.uid,
      question: question, // <--- THIS SAVES THE QUESTION
      status: 'waiting',
      timestamp: new Date()
    });

    // 2. Listen specifically to THIS request for acceptance
    myRequestUnsubscribe = db.collection('users').doc(alumniId).collection('queue').doc(currentUser.uid)
      .onSnapshot(async (doc) => {
        if (!doc.exists) return;
        const data = doc.data();

        if (data.status === 'admitted') {
          const alumniUser = await db.collection('users').doc(alumniId).get();
          const meetLink = alumniUser.data().meetLink;

          const ticketDiv = document.getElementById('admissionTicket');
          ticketDiv.innerHTML = `
            <div class="alert alert-success" style="animation: popIn 0.5s;">
              <strong>🎉 Accepted!</strong><br>
              Topic: ${data.question}
            </div>
            <a href="${meetLink}" target="_blank" class="btn btn-primary full-width" 
               style="text-decoration:none; display:block; text-align:center; padding:15px; font-weight:bold; font-size:18px;">
               📹 JOIN GOOGLE MEET
            </a>
          `;
          
          document.querySelector('#studentWaitingRoom .spinner').style.display = 'none';
          document.getElementById('waitingText').style.display = 'none';
        }
      });

  } catch (error) {
    console.error(error);
    alert("Error joining queue: " + error.message);
    cancelRequest();
  }
}

async function cancelRequest() {
  // 1. Reset UI: Switch back to the Search Area
  const searchArea = document.getElementById('studentSearchArea');
  const waitingRoom = document.getElementById('studentWaitingRoom');
  
  if (searchArea) searchArea.style.display = 'block';
  if (waitingRoom) waitingRoom.style.display = 'none';

  // 2. Clear the "Success Ticket" if it was there
  const ticketDiv = document.getElementById('admissionTicket');
  if (ticketDiv) ticketDiv.innerHTML = '';
  
  // 3. Reset the Waiting Text & Spinner
  const spinner = document.querySelector('#studentWaitingRoom .spinner');
  const waitingText = document.getElementById('waitingText');
  if (spinner) spinner.style.display = 'block';
  if (waitingText) waitingText.style.display = 'block';
  
  // 4. Stop listening to the database (Save data/battery)
  if (myRequestUnsubscribe) {
    myRequestUnsubscribe();
    myRequestUnsubscribe = null;
  }
}
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
      // Use Promise.all to properly await all async operations
      const postPromises = postsSnapshot.docs.map(async doc => {
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
        return div;
      });
      
      const divs = await Promise.all(postPromises);
      divs.forEach(div => allPostsDiv.appendChild(div));
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

// Note: setupPresence() and loadChatAlumni() are now called in auth.onAuthStateChanged
// after user authentication is confirmed, so we don't need to call them here
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
// ==========================================
// PRESENCE SYSTEM (Fixes ReferenceError)
// ==========================================
function setupPresence() {
  if (!currentUser) return;

  // 1. Reference to Realtime Database (not Firestore)
  // We store status at /status/USER_UID
  const userStatusRef = rtdb.ref('/status/' + currentUser.uid);

  // 2. Define what "offline" and "online" look like
  const isOfflineForDatabase = {
    state: 'offline',
    last_changed: firebase.database.ServerValue.TIMESTAMP,
  };

  const isOnlineForDatabase = {
    state: 'online',
    last_changed: firebase.database.ServerValue.TIMESTAMP,
  };

  // 3. Hook into Firebase's native connection monitor
  rtdb.ref('.info/connected').on('value', (snapshot) => {
    // If we are not connected to Firebase network, do nothing
    if (snapshot.val() == false) {
      return;
    }

    // 4. When we disconnect (close tab), set status to offline automatically
    userStatusRef.onDisconnect().set(isOfflineForDatabase).then(() => {
      // 5. While we are here, set status to online
      userStatusRef.set(isOnlineForDatabase);
    });
  });
}
// ==========================================
// AI CHATBOT (GEMINI - STUDENT ONLY)
// ==========================================

const GEMINI_API_KEY = "AIzaSyDyV5ItA23lqOVNISKz-9AvTQv3xA1abqE";

async function sendAIMessage() {
  if (currentRole !== "student") return;

  const input = document.getElementById("aiUserInput");
  const chatBox = document.getElementById("aiChatMessages");
  const userText = input.value.trim();
  if (!userText) return;

  // show user message
  chatBox.innerHTML += `<div class="msg-sent"><p>${userText}</p></div>`;
  input.value = "";

  // typing indicator
  const typing = document.createElement("div");
  typing.className = "msg-received";
  typing.innerHTML = "<p>AI is thinking...</p>";
  chatBox.appendChild(typing);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: userText }]
            }
          ]
        })
      }
    );

    const data = await res.json();
    console.log("Gemini response:", data); // 👈 debug

    typing.remove();

    const aiReply =
      data?.candidates?.[0]?.content?.parts
        ?.map(p => p.text)
        .join(" ")
      || "No response from AI.";

    chatBox.innerHTML += `<div class="msg-received"><p>${aiReply}</p></div>`;
    chatBox.scrollTop = chatBox.scrollHeight;

  } catch (err) {
    console.error("Gemini error:", err);
    typing.innerHTML = "<p style='color:red;'>AI failed</p>";
  }
}