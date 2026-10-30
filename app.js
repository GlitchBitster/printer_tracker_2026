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

// --- DOM ELEMENTS ---
const accessGate = document.getElementById("access-gate");
const appContainer = document.getElementById("app-container");
const listPage = document.getElementById("list-page");
const detailsPage = document.getElementById("details-page");

// --- HELPER FUNCTIONS ---

// Calculate next serial number: continues from the highest existing recorded serial number (or 1 if none exist).
// When the last record is deleted, the next created record continues from the remaining highest existing record.
function getNextSN() {
    if (!records || records.length === 0) {
        return 1;
    }
    const validSNs = records
        .map(r => parseInt(r.sn, 10))
        .filter(n => !isNaN(n) && n > 0);

    if (validSNs.length === 0) {
        return 1;
    }

    return Math.max(...validSNs) + 1;
}

// Convert YYYY-MM-DD (or Date string) to DD/MM/YYYY for display and export
function formatDateToDisplay(dateStr) {
    if (!dateStr) return "";
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
        return dateStr;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [y, m, d] = dateStr.split("-");
        return `${d}/${m}/${y}`;
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    }
    return dateStr;
}

// Convert DD/MM/YYYY (or Date string) to YYYY-MM-DD for HTML <input type="date">
function formatDateToInput(dateStr) {
    if (!dateStr) return "";
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
        const [d, m, y] = dateStr.split("/");
        return `${y}-${m}-${d}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        return `${year}-${month}-${day}`;
    }
    return dateStr;
}

// Parse date string to timestamp for chronological sorting
function getDateTimestamp(dateStr) {
    if (!dateStr) return 0;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
        const [d, m, y] = dateStr.split("/");
        return new Date(`${y}-${m}-${d}T00:00:00`).getTime() || 0;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return new Date(`${dateStr}T00:00:00`).getTime() || 0;
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 0 : d.getTime();
}

function escapeHtml(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function updateSortHeaders() {
    document.querySelectorAll("th[data-sort]").forEach(h => {
        const col = h.getAttribute("data-sort");
        if (!h.dataset.title) {
            h.dataset.title = h.innerText.replace(/[ ▲▼]/g, "").trim();
        }
        h.innerText = h.dataset.title + (col === sortCol ? (sortAsc ? " ▲" : " ▼") : "");
    });
}

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", async () => {
    // Check auth
    if (sessionStorage.getItem("auth") === "true") {
        showApp();
    }

    updateSortHeaders();

    // Load data from Firestore
    try {
        const querySnapshot = await getDocs(collection(db, "print_jobs"));
        records = [];
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            records.push({
                id: docSnap.id,
                ...data,
                sn: parseInt(data.sn, 10) || 0,
                weightGrams: parseFloat(data.weightGrams) || 0
            });
        });
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
    // Default date to today in local YYYY-MM-DD
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    document.getElementById("field-date").value = `${yyyy}-${mm}-${dd}`;

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
    document.getElementById("field-project").value = record.projectName || "";
    document.getElementById("field-part").value = record.partName || "";
    document.getElementById("field-date").value = formatDateToInput(record.date);
    document.getElementById("field-hours").value = record.timeHours ?? 0;
    document.getElementById("field-minutes").value = record.timeMinutes ?? 0;
    document.getElementById("field-cost").value = record.costUSD ?? "";
    document.getElementById("field-weight").value = record.weightGrams ?? "";
    document.getElementById("field-color-picker").value = record.color || "#ffffff";
    document.getElementById("field-color-text").value = record.color || "#ffffff";
    document.getElementById("field-status").value = record.status || "Waiting";

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

        updateSortHeaders();
        renderTable();
    });
});

function renderTable() {
    let filtered = records.filter(r =>
        (r.projectName || "").toLowerCase().includes(searchQuery) ||
        (r.partName || "").toLowerCase().includes(searchQuery) ||
        formatDateToDisplay(r.date).toLowerCase().includes(searchQuery) ||
        String(r.sn).includes(searchQuery)
    );

    filtered.sort((a, b) => {
        if (sortCol === "sn") {
            const numA = parseInt(a.sn, 10) || 0;
            const numB = parseInt(b.sn, 10) || 0;
            return sortAsc ? numA - numB : numB - numA;
        }

        if (sortCol === "costINR" || sortCol === "costUSD" || sortCol === "weightGrams") {
            const numA = parseFloat(a[sortCol]) || 0;
            const numB = parseFloat(b[sortCol]) || 0;
            return sortAsc ? numA - numB : numB - numA;
        }

        if (sortCol === "date") {
            const timeA = getDateTimestamp(a.date);
            const timeB = getDateTimestamp(b.date);
            return sortAsc ? timeA - timeB : timeB - timeA;
        }

        let valA = a[sortCol] ?? "";
        let valB = b[sortCol] ?? "";
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
            <td>${formatDateToDisplay(r.date)}</td>
            <td>${escapeHtml(r.projectName)}</td>
            <td>${escapeHtml(r.partName)}</td>
            <td>₹${Number(r.costINR || 0).toFixed(2)}</td>
            <td>${escapeHtml(r.status || "")}</td>
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
        const deletedRecord = records.find(r => r.id === id);
        records = records.filter(r => r.id !== id);
        renderTable();
        try {
            await deleteDoc(doc(db, "print_jobs", id));
        } catch (e) {
            console.error("Error deleting document:", e);
            alert("Failed to delete record: " + e.message);
            if (deletedRecord) {
                records.push(deletedRecord);
                renderTable();
            }
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
    const costUSD = parseFloat(document.getElementById("field-cost").value) || 0;
    const rawDate = document.getElementById("field-date").value;
    const formattedDate = formatDateToDisplay(rawDate);
    const weightVal = parseFloat(document.getElementById("field-weight").value) || 0;

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
        projectName: document.getElementById("field-project").value.trim(),
        partName: document.getElementById("field-part").value.trim(),
        date: formattedDate,
        timeHours: parseInt(document.getElementById("field-hours").value, 10) || 0,
        timeMinutes: parseInt(document.getElementById("field-minutes").value, 10) || 0,
        costUSD: costUSD,
        costINR: costINR,
        weightGrams: weightVal,
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
            const sn = getNextSN();
            const newRecord = { sn, ...recordData };
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

    // Always sort export data by SN in proper numeric sequence
    const sortedRecords = [...records].sort((a, b) => ((parseInt(b.sn, 10) || 0) - parseInt(a.sn, 10) || 0));

    // Prepare data for Excel
    const exportData = sortedRecords.map(r => ({
        "SN": parseInt(r.sn, 10) || 0,
        "Date": formatDateToDisplay(r.date),
        "Project Name": r.projectName || "",
        "Part Name": r.partName || "",
        "Time (HH:MM)": `${r.timeHours || 0}:${String(r.timeMinutes || 0).padStart(2, '0')}`,
        "Cost (USD)": r.costUSD ?? 0,
        "Cost (INR)": r.costINR ? Number(Number(r.costINR).toFixed(2)) : 0,
        "Weight (g)": r.weightGrams ?? 0,
        "Color": r.color || "",
        "Status": r.status || ""
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Print Jobs");

    // Generate and download
    XLSX.writeFile(workbook, "PrinterTracker_Export.xlsx");
});
