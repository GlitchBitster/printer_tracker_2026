import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDNuzbAYRLrlI2RmN2lwlQjHqFiopb-weU",
  authDomain: "printer-tracker-646bd.firebaseapp.com",
  projectId: "printer-tracker-646bd",
  storageBucket: "printer-tracker-646bd.firebasestorage.app",
  messagingSenderId: "511877966353",
  appId: "1:511877966353:web:ea0d58294d527001a81fb0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- CONFIG & STATE ---
const PASSCODE = "PRINT2026";
const RECORDS_PER_PAGE = 10;
let records = [];
let currentPage = 1;
let sortCol = "sn";
let sortAsc = false;
let searchQuery = "";
let nextSN = 1;

// --- DOM ELEMENTS ---
const accessGate = document.getElementById("access-gate");
const appContainer = document.getElementById("app-container");
const listPage = document.getElementById("list-page");
const detailsPage = document.getElementById("details-page");

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", async () => {
    // Check auth
    if (sessionStorage.getItem("auth") === "true") {
        showApp();
    }

    // Load data from Firestore
    try {
        const querySnapshot = await getDocs(collection(db, "print_jobs"));
        records = [];
        querySnapshot.forEach((docSnap) => {
            records.push({ id: docSnap.id, ...docSnap.data() });
        });
        if (records.length > 0) {
            nextSN = Math.max(...records.map(r => r.sn)) + 1;
        }
    } catch (e) {
        console.error("Error loading from Firebase:", e);
    }

    renderTable();
});

// --- AUTH LOGIC ---
document.getElementById("btn-login").addEventListener("click", () => {
    const input = document.getElementById("passcode-input").value;
    if (input === PASSCODE) {
        sessionStorage.setItem("auth", "true");
        showApp();
    } else {
        document.getElementById("login-error").classList.remove("hidden");
    }
});
document.getElementById("passcode-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter") document.getElementById("btn-login").click();
});

function showApp() {
    accessGate.classList.add("hidden");
    appContainer.classList.remove("hidden");
}

// --- NAVIGATION ---
document.getElementById("btn-new").addEventListener("click", () => {
    document.getElementById("details-form").reset();
    document.getElementById("field-id").value = "";
    document.getElementById("field-color-picker").value = "#ffffff";
    document.getElementById("field-color-text").value = "#ffffff";
    // Default date to today
    document.getElementById("field-date").value = new Date().toISOString().split("T")[0];

    listPage.classList.add("hidden");
    detailsPage.classList.remove("hidden");
});

document.getElementById("btn-cancel").addEventListener("click", () => {
    detailsPage.classList.add("hidden");
    listPage.classList.remove("hidden");
});

window.openDetails = (id) => {
    const record = records.find(r => r.id === id);
    if (!record) return;

    document.getElementById("field-id").value = record.id;
    document.getElementById("field-project").value = record.projectName;
    document.getElementById("field-part").value = record.partName;
    document.getElementById("field-date").value = record.date;
    document.getElementById("field-hours").value = record.timeHours;
    document.getElementById("field-minutes").value = record.timeMinutes;
    document.getElementById("field-cost").value = record.costUSD;
    document.getElementById("field-weight").value = record.weightGrams;
    document.getElementById("field-color-picker").value = record.color;
    document.getElementById("field-color-text").value = record.color;
    document.getElementById("field-status").value = record.status;

    listPage.classList.add("hidden");
    detailsPage.classList.remove("hidden");
};

// Sync color picker and text
document.getElementById("field-color-picker").addEventListener("input", (e) => {
    document.getElementById("field-color-text").value = e.target.value;
});
document.getElementById("field-color-text").addEventListener("input", (e) => {
    document.getElementById("field-color-picker").value = e.target.value;
});

// --- LIST LOGIC ---
document.getElementById("search-input").addEventListener("input", (e) => {
    searchQuery = e.target.value.toLowerCase();
    currentPage = 1;
    renderTable();
});

document.querySelectorAll("th[data-sort]").forEach(th => {
    th.addEventListener("click", () => {
        const col = th.getAttribute("data-sort");
        if (sortCol === col) {
            sortAsc = !sortAsc;
        } else {
            sortCol = col;
            sortAsc = true;
        }

        // Update header arrows
        document.querySelectorAll("th[data-sort]").forEach(h => {
            const t = h.innerText.replace(" ▲", "").replace(" ▼", "");
            h.innerText = t + (h.getAttribute("data-sort") === sortCol ? (sortAsc ? " ▲" : " ▼") : "");
        });

        renderTable();
    });
});

function renderTable() {
    let filtered = records.filter(r =>
        r.projectName.toLowerCase().includes(searchQuery) ||
        r.partName.toLowerCase().includes(searchQuery)
    );

    filtered.sort((a, b) => {
        let valA = a[sortCol];
        let valB = b[sortCol];
        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();

        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
    });

    const totalPages = Math.ceil(filtered.length / RECORDS_PER_PAGE) || 1;
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * RECORDS_PER_PAGE;
    const paginated = filtered.slice(start, start + RECORDS_PER_PAGE);

    const tbody = document.getElementById("table-body");
    tbody.innerHTML = "";

    paginated.forEach(r => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${r.sn}</td>
            <td>${r.date}</td>
            <td>${r.projectName}</td>
            <td>${r.partName}</td>
            <td>₹${r.costINR.toFixed(2)}</td>
            <td>${r.status}</td>
            <td>
                <button onclick="openDetails('${r.id}')">View</button>
                <button class="btn-delete" onclick="deleteRecord('${r.id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Pagination visibility
    const pagDiv = document.getElementById("pagination");
    if (filtered.length > RECORDS_PER_PAGE) {
        pagDiv.classList.remove("hidden");
        document.getElementById("page-info").innerText = `Page ${currentPage} of ${totalPages}`;
        document.getElementById("btn-prev").disabled = currentPage === 1;
        document.getElementById("btn-next").disabled = currentPage === totalPages;
    } else {
        pagDiv.classList.add("hidden");
    }
}

document.getElementById("btn-prev").addEventListener("click", () => {
    if (currentPage > 1) { currentPage--; renderTable(); }
});
document.getElementById("btn-next").addEventListener("click", () => {
    currentPage++; renderTable();
});

window.deleteRecord = async (id) => {
    if (confirm("Are you sure you want to delete this record?")) {
        records = records.filter(r => r.id !== id);
        renderTable();
        try {
            await deleteDoc(doc(db, "print_jobs", id));
        } catch (e) {
            console.error("Error deleting document:", e);
        }
    }
};

// --- SAVE LOGIC & CURRENCY API ---
document.getElementById("details-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const btnSave = document.getElementById("btn-save");
    btnSave.disabled = true;
    btnSave.innerText = "SAVING...";

    const id = document.getElementById("field-id").value;
    const costUSD = parseFloat(document.getElementById("field-cost").value);

    // Fetch live exchange rate
    let exchangeRate = 83.5; // Fallback
    try {
        const res = await fetch("https://open.er-api.com/v6/latest/USD");
        if (res.ok) {
            const data = await res.json();
            if (data.rates && data.rates.INR) {
                exchangeRate = data.rates.INR;
            }
        }
    } catch (err) {
        console.warn("Could not fetch live exchange rate, using fallback.", err);
    }

    const costINR = costUSD * exchangeRate;

    const recordData = {
        projectName: document.getElementById("field-project").value,
        partName: document.getElementById("field-part").value,
        date: document.getElementById("field-date").value,
        timeHours: parseInt(document.getElementById("field-hours").value),
        timeMinutes: parseInt(document.getElementById("field-minutes").value),
        costUSD: costUSD,
        costINR: costINR,
        weightGrams: parseFloat(document.getElementById("field-weight").value),
        color: document.getElementById("field-color-text").value,
        status: document.getElementById("field-status").value
    };

    try {
        if (id) {
            // Update
            const index = records.findIndex(r => r.id === id);
            if (index > -1) {
                records[index] = { ...records[index], ...recordData };
            }
            await updateDoc(doc(db, "print_jobs", id), recordData);
        } else {
            // Create
            const newRecord = { sn: nextSN++, ...recordData };
            const docRef = await addDoc(collection(db, "print_jobs"), newRecord);
            records.push({ id: docRef.id, ...newRecord });
        }

        detailsPage.classList.add("hidden");
        listPage.classList.remove("hidden");
        renderTable();
    } catch (error) {
        console.error("Firebase Save Error:", error);
        alert("Failed to save to Firebase! If you just created the project, make sure your Firestore Database Rules are set to 'Test Mode' (allow read, write: if true). Check the browser console for more details.");
    } finally {
        btnSave.disabled = false;
        btnSave.innerText = "SAVE";
    }
});

// --- EXPORT LOGIC ---
document.getElementById("btn-export").addEventListener("click", () => {
    if (records.length === 0) {
        alert("No records to export!");
        return;
    }

    // Prepare data for Excel
    const exportData = records.map(r => ({
        "SN": r.sn,
        "Date": r.date,
        "Project Name": r.projectName,
        "Part Name": r.partName,
        "Time (HH:MM)": `${r.timeHours}:${r.timeMinutes.toString().padStart(2, '0')}`,
        "Cost (USD)": r.costUSD,
        "Cost (INR)": r.costINR,
        "Weight (g)": r.weightGrams,
        "Color": r.color,
        "Status": r.status
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Print Jobs");

    // Generate and download
    XLSX.writeFile(workbook, "PrinterTracker_Export.xlsx");
});
