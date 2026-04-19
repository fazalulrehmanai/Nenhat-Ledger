// Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, sendEmailVerification, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Configuration from your config file
const firebaseConfig = {
  apiKey: "AIzaSyCcLrhpoC6LzJ-Lef_kHoP_8oSX8sE_Njk",
  authDomain: "gen-lang-client-0207558444.firebaseapp.com",
  databaseURL: "https://gen-lang-client-0207558444-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "gen-lang-client-0207558444",
  storageBucket: "gen-lang-client-0207558444.firebasestorage.app",
  messagingSenderId: "1062539454662",
  appId: "1:1062539454662:web:2aa221cf0a50a461e28fc7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// State
let currentUser = null;
let profileData = null;
let ledgerEntries = [];
let isSignUp = false;

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const verifyScreen = document.getElementById('verify-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const authForm = document.getElementById('auth-form');
const authError = document.getElementById('auth-error');
const signupFields = document.getElementById('signup-fields');
const authSubmit = document.getElementById('auth-submit');
const entryBody = document.getElementById('ledger-body');
const entryCountEl = document.getElementById('entry-count');

// Initialize
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        if (!user.emailVerified) {
            showScreen('verify');
        } else {
            await initializeDashboard();
            showScreen('dashboard');
        }
    } else {
        currentUser = null;
        showScreen('auth');
    }
});

// UI helpers
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId + '-screen').classList.add('active');
}

window.showAuthMode = (mode) => {
    isSignUp = (mode === 'signup');
    document.getElementById('tab-login').classList.toggle('active', !isSignUp);
    document.getElementById('tab-signup').classList.toggle('active', isSignUp);
    signupFields.classList.toggle('hidden', !isSignUp);
    authSubmit.innerText = isSignUp ? 'Create Account' : 'Login';
    authError.innerText = '';
};

// Auth Actions
window.handleAuth = async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    authError.innerText = '';

    try {
        if (isSignUp) {
            const fullName = document.getElementById('full-name').value;
            const mobile = document.getElementById('mobile').value;
            
            const userCred = await createUserWithEmailAndPassword(auth, email, password);
            await sendEmailVerification(userCred.user);
            
            // Initial Profile (Free Plan)
            await setDoc(doc(db, "users", userCred.user.uid), {
                fullName,
                mobileNumber: mobile,
                email,
                plan: 'free',
                entryCount: 0,
                createdAt: serverTimestamp()
            });
            
            alert("Verification email sent! Please check your inbox.");
        } else {
            await signInWithEmailAndPassword(auth, email, password);
        }
    } catch (err) {
        authError.innerText = err.message;
    }
};

window.resendVerification = async () => {
    if (currentUser) {
        await sendEmailVerification(currentUser);
        alert("Verification email resent!");
    }
};

window.signOutUser = () => {
    signOut(auth);
    localStorage.removeItem('nenhat_entries');
};

// Dashboard Logic
async function initializeDashboard() {
    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
    if (userDoc.exists()) {
        profileData = userDoc.data();
        document.getElementById('current-plan').innerText = profileData.plan.charAt(0).toUpperCase() + profileData.plan.slice(1);
        
        // Update user display
        document.getElementById('user-display-name').innerText = profileData.fullName || 'User';
        document.getElementById('welcome-msg').innerText = `Welcome back, ${profileData.fullName.split(' ')[0]}`;
        const initials = profileData.fullName.split(' ').map(n => n[0]).join('').toUpperCase();
        document.getElementById('user-avatar').innerText = initials || '?';
    }

    // Load from LocalStorage first
    const cached = localStorage.getItem('nenhat_entries');
    if (cached) {
        ledgerEntries = JSON.parse(cached);
        renderEntries();
    }

    // Sync from Cloud
    syncFromCloud();
}

async function syncFromCloud() {
    const q = query(collection(db, `users/${currentUser.uid}/entries`));
    try {
        const querySnapshot = await getDocs(q);
        const cloudEntries = [];
        querySnapshot.forEach(doc => {
            cloudEntries.push({ id: doc.id, ...doc.data() });
        });
        
        ledgerEntries = cloudEntries;
        localStorage.setItem('nenhat_entries', JSON.stringify(ledgerEntries));
        renderEntries();
        document.getElementById('sync-status').innerText = "Synced";
        
        // Sync entry count to profile if needed
        if (ledgerEntries.length !== profileData.entryCount) {
            await updateDoc(doc(db, "users", currentUser.uid), {
                entryCount: ledgerEntries.length
            });
        }
    } catch (err) {
        console.error("Cloud sync failed", err);
        document.getElementById('sync-status').innerText = "Offline";
    }
}

function renderEntries(data = ledgerEntries) {
    entryBody.innerHTML = '';
    let totalReceived = 0;
    let totalLiability = 0;

    data.forEach(entry => {
        totalReceived += Number(entry.amount);
        totalLiability += Number(entry.suggestedReturn);
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div style="font-weight: 600;">${entry.giverName}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">S/o ${entry.fatherName}</div>
            </td>
            <td>${entry.cityVillage}</td>
            <td>${entry.caste ? `<span class="tag">${entry.caste}</span>` : '-'}</td>
            <td class="text-right" style="font-family: monospace; font-weight: 600;">${Number(entry.amount).toLocaleString()}</td>
            <td class="text-right gold-text">${Number(entry.suggestedReturn).toLocaleString()}</td>
            <td>
                <span class="emerald-text" style="font-weight: 600; cursor: pointer;" onclick="editEntry('${entry.id}')">Edit</span>
            </td>
        `;
        entryBody.appendChild(row);
    });

    document.getElementById('total-received').innerText = `PKR ${totalReceived.toLocaleString()}`;
    document.getElementById('total-reciprocal').innerText = `PKR ${totalLiability.toLocaleString()}`;
    document.getElementById('total-sent').innerText = `PKR 0`; // Placeholder for actual sent tracking if implemented
    entryCountEl.innerText = data.length;
}

window.filterEntries = () => {
    const val = document.getElementById('search-input').value.toLowerCase();
    const filtered = ledgerEntries.filter(e => 
        e.giverName.toLowerCase().includes(val) || 
        e.cityVillage.toLowerCase().includes(val) ||
        e.fatherName.toLowerCase().includes(val)
    );
    renderEntries(filtered);
};

// Entry Modal Actions
window.openEntryModal = () => {
    // Check Free Plan Limit
    if (profileData.plan === 'free' && ledgerEntries.length >= 20) {
        alert("Free Plan limit reached (20 entries). Please upgrade to Pro for unlimited access.");
        return;
    }
    
    document.getElementById('modal-title').innerText = "New Entry";
    document.getElementById('entry-form').reset();
    document.getElementById('entry-id').value = '';
    document.getElementById('entry-modal').classList.add('active');
};

window.closeModal = (id) => {
    document.getElementById(id).classList.remove('active');
};

window.calculateSuggested = () => {
    const amt = document.getElementById('entry-amount').value;
    document.getElementById('suggested-return').value = amt ? amt * 2 : 0;
};

window.saveEntry = async (e) => {
    e.preventDefault();
    const id = document.getElementById('entry-id').value;
    const entryData = {
        userId: currentUser.uid,
        giverName: document.getElementById('giver-name').value,
        fatherName: document.getElementById('father-name').value,
        cityVillage: document.getElementById('city-village').value,
        caste: document.getElementById('caste').value,
        amount: Number(document.getElementById('entry-amount').value),
        suggestedReturn: Number(document.getElementById('suggested-return').value),
        updatedAt: serverTimestamp()
    };

    try {
        if (id) {
            // Update
            await updateDoc(doc(db, `users/${currentUser.uid}/entries`, id), entryData);
        } else {
            // Create
            entryData.createdAt = serverTimestamp();
            await addDoc(collection(db, `users/${currentUser.uid}/entries`), entryData);
            
            // Increment Count
            await updateDoc(doc(db, "users", currentUser.uid), {
                entryCount: ledgerEntries.length + 1
            });
        }
        closeModal('entry-modal');
        syncFromCloud();
    } catch (err) {
        console.error("Save failed", err);
        alert("Error saving entry: " + err.message);
    }
};

window.editEntry = (id) => {
    const entry = ledgerEntries.find(e => e.id === id);
    if (!entry) return;

    document.getElementById('modal-title').innerText = "Edit Entry";
    document.getElementById('entry-id').value = id;
    document.getElementById('giver-name').value = entry.giverName;
    document.getElementById('father-name').value = entry.fatherName;
    document.getElementById('city-village').value = entry.cityVillage;
    document.getElementById('caste').value = entry.caste || '';
    document.getElementById('entry-amount').value = entry.amount;
    document.getElementById('suggested-return').value = entry.suggestedReturn;
    
    document.getElementById('entry-modal').classList.add('active');
};


