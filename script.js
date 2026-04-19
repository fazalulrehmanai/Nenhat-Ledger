// --- script.js (LIVE ONLY VERSION) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, getDocs, query } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCcLrhpoC6LzJ-Lef_kHoP_8oSX8sE_Njk",
    authDomain: "gen-lang-client-0207558444.firebaseapp.com",
    projectId: "gen-lang-client-0207558444",
    storageBucket: "gen-lang-client-0207558444.firebasestorage.app",
    messagingSenderId: "1062539454662",
    appId: "1:1062539454662:web:2aa221cf0a50a461e28fc7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); // Yahan koi database ID nahi di, matlab ye (default) use karega

onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("User detected, loading live data...");
        // Direct dashboard par bhejeyn, email verification bad mein dekh lenge
        showScreen('dashboard');
        await initializeDashboard(user.uid);
    } else {
        showScreen('auth');
    }
});

async function initializeDashboard(uid) {
    try {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            document.getElementById('user-display-name').innerText = data.fullName || "User";
        }
        // LIVE SYNC ONLY
        const q = query(collection(db, `users/${uid}/entries`));
        const snap = await getDocs(q);
        console.log("Cloud data fetched!");
    } catch (e) {
        console.error("Connection failed: ", e);
    }
}