import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    sendEmailVerification, 
    onAuthStateChanged, 
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    collection, 
    addDoc, 
    onSnapshot, 
    query, 
    orderBy,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// --- Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyCcLrhpoC6LzJ-Lef_kHoP_8oSX8sE_Njk",
    authDomain: "gen-lang-client-0207558444.firebaseapp.com",
    projectId: "gen-lang-client-0207558444",
    storageBucket: "gen-lang-client-0207558444.firebasestorage.app",
    messagingSenderId: "1062539454662",
    appId: "1:1062539454662:web:2aa221cf0a50a461e28fc7",
    firestoreDatabaseId: "ai-studio-106d383e-333c-4c63-8a76-9eec4f92cdfd"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// --- State Management ---
let currentUser = null;
let profileData = null;
let allEntries = [];
let currentTypeFilter = null;
let authMode = 'login';
let unsubscribeEntries = null;

// --- Global Functions ---
window.toggleAuthMode = (mode) => {
    authMode = mode;
    const tabLogin = document.getElementById('tab-login');
    const tabSignup = document.getElementById('tab-signup');
    const signupFields = document.querySelectorAll('.signup-only');
    const submitBtn = document.getElementById('auth-submit-btn');
    const subtitle = document.getElementById('auth-subtitle');

    if (mode === 'signup') {
        tabSignup.classList.add('active');
        tabLogin.classList.remove('active');
        signupFields.forEach(f => f.style.display = 'block');
        submitBtn.innerText = 'Create Account';
        subtitle.innerText = 'Start Your Professional Ledger Today';
    } else {
        tabLogin.classList.add('active');
        tabSignup.classList.remove('active');
        signupFields.forEach(f => f.style.display = 'none');
        submitBtn.innerText = 'Login';
        subtitle.innerText = 'Professional Ledger Solutions';
    }
};

window.togglePasswordVisibility = (id) => {
    const pwdInput = document.getElementById(id);
    const eyeIcon = document.getElementById('eye-icon');
    if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
        eyeIcon.setAttribute('data-lucide', 'eye-off');
    } else {
        pwdInput.type = 'password';
        eyeIcon.setAttribute('data-lucide', 'eye');
    }
    lucide.createIcons();
};

window.showScreen = (screenId) => {
    // Check if it's a content pane or a full screen
    const panes = document.querySelectorAll('.content-pane');
    const isPane = Array.from(panes).some(p => p.id === screenId);

    if (isPane) {
        panes.forEach(p => p.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
        
        // Update nav active state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('onclick').includes(screenId)) {
                item.classList.add('active');
            }
        });
        
        // Auto-close sidebar on mobile
        if (window.innerWidth < 1024) toggleSidebar(false);
    } else {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
    }
};

window.toggleSidebar = (force) => {
    const sidebar = document.getElementById('sidebar');
    if (force !== undefined) {
        if (force) sidebar.classList.add('active');
        else sidebar.classList.remove('active');
    } else {
        sidebar.classList.toggle('active');
    }
};

window.signOutUser = async () => {
    try {
        if (unsubscribeEntries) unsubscribeEntries();
        await signOut(auth);
        showScreen('auth-screen');
    } catch (error) {
        console.error("Sign out error", error);
    }
};

// --- Authentication Logic ---
const authForm = document.getElementById('auth-form');
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const errorDiv = document.getElementById('auth-error');
    errorDiv.innerText = '';

    try {
        if (authMode === 'signup') {
            const name = document.getElementById('reg-name').value;
            const mobile = document.getElementById('reg-mobile').value;

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Save user profile
            await setDoc(doc(db, "users", user.uid), {
                fullName: name,
                email: email,
                mobile: mobile,
                plan: 'Free',
                entryCount: 0
            });

            await updateProfile(user, { displayName: name });
            await sendEmailVerification(user);
            showScreen('verify-screen');
        } else {
            await signInWithEmailAndPassword(auth, email, password);
        }
    } catch (error) {
        errorDiv.innerText = error.message;
    }
});

window.checkVerificationStatus = async () => {
    await auth.currentUser.reload();
    if (auth.currentUser.emailVerified) {
        initializeDashboard(auth.currentUser);
    } else {
        alert("Email not yet verified. Please check your inbox.");
    }
};

// --- Dashboard Logic ---
onAuthStateChanged(auth, async (user) => {
    lucide.createIcons();
    if (user) {
        currentUser = user;
        if (!user.emailVerified) {
            showScreen('verify-screen');
        } else {
            initializeDashboard(user);
        }
    } else {
        currentUser = null;
        showScreen('auth-screen');
    }
});

async function initializeDashboard(user) {
    // Get profile data
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        profileData = docSnap.data();
        document.getElementById('user-name-display').innerText = profileData.fullName;
        document.getElementById('p-name').innerText = profileData.fullName;
        document.getElementById('p-email').innerText = profileData.email;
        document.getElementById('p-mobile').innerText = profileData.mobile;
    }

    showScreen('main-dashboard');
    syncFromCloud();
}

function syncFromCloud() {
    if (unsubscribeEntries) unsubscribeEntries();
    
    const entriesRef = collection(db, "users", currentUser.uid, "entries");
    const q = query(entriesRef, orderBy("year", "desc"));

    unsubscribeEntries = onSnapshot(q, (snapshot) => {
        allEntries = [];
        snapshot.forEach((doc) => {
            allEntries.push({ id: doc.id, ...doc.data() });
        });
        
        // Update entry count in profile if needed
        if (allEntries.length !== (profileData.entryCount || 0)) {
            updateDoc(doc(db, "users", currentUser.uid), { entryCount: allEntries.length });
        }

        updateFilters();
        renderEntries();
        calculateTotals();
    });
}

function updateFilters() {
    const villages = [...new Set(allEntries.map(e => e.village))].sort();
    const castes = [...new Set(allEntries.map(e => e.caste).filter(Boolean))].sort();

    const villageSelect = document.getElementById('filter-village');
    const casteSelect = document.getElementById('filter-caste');

    const currentV = villageSelect.value;
    const currentC = casteSelect.value;

    villageSelect.innerHTML = '<option value="">All Villages</option>' + 
        villages.map(v => `<option value="${v}" ${v === currentV ? 'selected' : ''}>${v}</option>`).join('');
    
    casteSelect.innerHTML = '<option value="">All Castes</option>' + 
        castes.map(c => `<option value="${c}" ${c === currentC ? 'selected' : ''}>${c}</option>`).join('');
}

window.applyFilters = () => {
    renderEntries();
};

window.resetFilters = () => {
    document.getElementById('filter-village').value = '';
    document.getElementById('filter-caste').value = '';
    currentTypeFilter = null;
    renderEntries();
};

window.filterByType = (type) => {
    currentTypeFilter = type;
    showScreen('dashboard-content');
    renderEntries();
};

function renderEntries() {
    const body = document.getElementById('entries-body');
    const villageFilter = document.getElementById('filter-village').value;
    const casteFilter = document.getElementById('filter-caste').value;

    let filtered = allEntries;
    if (villageFilter) filtered = filtered.filter(e => e.village === villageFilter);
    if (casteFilter) filtered = filtered.filter(e => e.caste === casteFilter);
    if (currentTypeFilter) filtered = filtered.filter(e => e.type === currentTypeFilter);

    body.innerHTML = filtered.map(e => `
        <tr>
            <td>
                <div class="name-cell">
                    <div class="main-name">${e.name}</div>
                    <div class="sub-name text-muted">s/o ${e.fatherName}</div>
                </div>
            </td>
            <td>${e.village}</td>
            <td>${e.caste || '-'}</td>
            <td>${e.year}</td>
            <td class="text-right font-bold">${e.amount.toLocaleString()} PKR</td>
            <td>
                <span class="badge badge-${e.type}">${e.type.charAt(0).toUpperCase() + e.type.slice(1)}</span>
            </td>
            <td>
                <button class="btn btn-link" onclick="openEntryModal('${e.id}')">Edit</button>
            </td>
        </tr>
    `).join('');
    
    if (filtered.length === 0) {
        body.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No entries found</td></tr>';
    }
}

function calculateTotals() {
    const sent = allEntries.filter(e => e.type === 'sent').reduce((acc, curr) => acc + curr.amount, 0);
    const received = allEntries.filter(e => e.type === 'received').reduce((acc, curr) => acc + curr.amount, 0);

    document.getElementById('total-sent').innerText = `${sent.toLocaleString()} PKR`;
    document.getElementById('total-received').innerText = `${received.toLocaleString()} PKR`;
}

// --- Entry Modal Logic ---
const entryForm = document.getElementById('entry-form');
const entryModal = document.getElementById('entry-modal');

window.openEntryModal = (id = null) => {
    entryForm.reset();
    document.getElementById('entry-id').value = id || '';
    document.getElementById('modal-title').innerText = id ? 'Edit Entry' : 'New Entry';
    document.getElementById('suggested-box').style.display = 'none';

    if (id) {
        const entry = allEntries.find(e => e.id === id);
        if (entry) {
            document.getElementById('e-name').value = entry.name;
            document.getElementById('e-father').value = entry.fatherName;
            document.getElementById('e-amount').value = entry.amount;
            document.getElementById('e-year').value = entry.year;
            document.getElementById('e-village').value = entry.village;
            document.getElementById('e-caste').value = entry.caste || '';
            document.querySelector(`input[name="entry-type"][value="${entry.type}"]`).checked = true;
            updateSuggested(entry.amount);
        }
    } else {
        document.getElementById('e-year').value = new Date().getFullYear();
    }
    
    entryModal.classList.add('active');
};

window.closeModal = () => {
    entryModal.classList.remove('active');
};

document.getElementById('e-amount').addEventListener('input', (e) => {
    updateSuggested(e.target.value);
});

function updateSuggested(amount) {
    const box = document.getElementById('suggested-box');
    const display = document.getElementById('suggested-amount');
    if (amount > 0) {
        box.style.display = 'block';
        display.innerText = (amount * 2).toLocaleString();
    } else {
        box.style.display = 'none';
    }
}

entryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Check limit for free plan
    if (!document.getElementById('entry-id').value && profileData.plan === 'Free' && allEntries.length >= 20) {
        alert("Free plan limit reached (20 entries). Please upgrade to Pro.");
        return;
    }

    const data = {
        name: document.getElementById('e-name').value,
        fatherName: document.getElementById('e-father').value,
        amount: parseFloat(document.getElementById('e-amount').value),
        year: parseInt(document.getElementById('e-year').value),
        village: document.getElementById('e-village').value,
        caste: document.getElementById('e-caste').value || null,
        type: document.querySelector('input[name="entry-type"]:checked').value,
        updatedAt: new Date().toISOString()
    };

    const id = document.getElementById('entry-id').value;
    try {
        if (id) {
            await updateDoc(doc(db, "users", currentUser.uid, "entries", id), data);
        } else {
            data.createdAt = new Date().toISOString();
            await addDoc(collection(db, "users", currentUser.uid, "entries"), data);
        }
        closeModal();
    } catch (err) {
        alert("Error saving entry: " + err.message);
    }
});

// Initialize icons on load
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
});
