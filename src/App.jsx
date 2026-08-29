import React, { useState, useEffect, useMemo } from "react";
import {
  Wallet, TrendingDown, TrendingUp, LogOut, Plus, Trash2, X, Users, ShieldCheck,
  ClipboardList, Receipt, PiggyBank, CircleDot, ImagePlus, Loader2, Leaf,
  LayoutDashboard, Lightbulb, CalendarDays, IndianRupee, Pencil, Save
} from "lucide-react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, Legend } from "recharts";

// ---------------------------------------------------------------------------
// Firebase — same project as the Serengeti staff app, separate collection
// so this data never mixes with restaurant orders/menu.
// ---------------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyAHvVQeolYC0ymNVA9f2FVq-CPZYaOCX9E",
  authDomain: "serengeticafe-75756.firebaseapp.com",
  projectId: "serengeticafe-75756",
  storageBucket: "serengeticafe-75756.firebasestorage.app",
  messagingSenderId: "472969509801",
  appId: "1:472969509801:web:b2b66a2eb58b744b6422b8",
  measurementId: "G-F539H66P1C",
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// Same Cloudinary account as the staff app — used here only for optional
// receipt photos attached to an expense entry.
const CLOUDINARY_CLOUD_NAME = "YOUR_CLOUD_NAME";
const CLOUDINARY_UPLOAD_PRESET = "YOUR_UPLOAD_PRESET";

const BRAND = {
  logo: "https://www.serengeti.in/logo.png",
  hero: "https://www.serengeti.in/media/real/hero.jpg",
};

const KEYS = { profiles: "profiles", expenses: "expenses", income: "income" };
const COLLECTION = "expense_ledger";

function docRef(key) { return doc(db, COLLECTION, key); }

function subscribe(key, onChange) {
  return onSnapshot(docRef(key), (snap) => {
    const data = snap.exists() ? snap.data().data : [];
    onChange(Array.isArray(data) ? data : []);
  }, (err) => console.error("Firestore subscribe failed for", key, err));
}

async function persistToFirestore(key, val) {
  try { await setDoc(docRef(key), { data: val }); }
  catch (e) { console.error("Firestore write failed for", key, e); }
}

function optimizeCloudinaryUrl(url) {
  return url.replace("/upload/", "/upload/w_1000,c_limit,q_auto,f_auto/");
}

async function uploadReceiptImage(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: "POST", body: formData,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Cloudinary upload failed: ${res.status} ${errText}`);
  }
  const data = await res.json();
  return optimizeCloudinaryUrl(data.secure_url);
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const ROLES = ["owner", "manager"];
const ROLE_LABEL = { owner: "Owner", manager: "Manager" };
const todayStr = () => new Date().toISOString().slice(0, 10);

// Financial year (India) starts April 1 — resolves to the FY currently in progress.
function fiscalYearStart() {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(year, 3, 1); // April = month index 3
}
function monthKey(dateStr) { return dateStr.slice(0, 7); } // "2026-06"
function monthLabel(key) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}
function monthsFromFYStart() {
  const start = fiscalYearStart();
  const now = new Date();
  const months = [];
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= now) {
    months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return months;
}

// ---------------------------------------------------------------------------
// Root App
// ---------------------------------------------------------------------------
export default function App() {
  const [profiles, setProfiles] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [income, setIncome] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState({ profiles: false, expenses: false, income: false });
  const [currentUser, setCurrentUser] = useState(null);
  const [syncedAt, setSyncedAt] = useState(null);

  useEffect(() => {
    const markLoaded = (k) => setLoaded((p) => ({ ...p, [k]: true }));
    const unsubs = [
      subscribe(KEYS.profiles, (v) => { setProfiles(v); markLoaded("profiles"); setSyncedAt(new Date()); }),
      subscribe(KEYS.expenses, (v) => { setExpenses(v); markLoaded("expenses"); setSyncedAt(new Date()); }),
      subscribe(KEYS.income, (v) => { setIncome(v); markLoaded("income"); setSyncedAt(new Date()); }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  useEffect(() => { if (Object.values(loaded).every(Boolean)) setLoading(false); }, [loaded]);

  useEffect(() => {
    const handler = (e) => setCurrentUser(e.detail);
    window.addEventListener("el-login", handler);
    return () => window.removeEventListener("el-login", handler);
  }, []);

  const persist = {
    profiles: (n) => { setProfiles(n); persistToFirestore(KEYS.profiles, n); },
    expenses: (n) => { setExpenses(n); persistToFirestore(KEYS.expenses, n); },
    income: (n) => { setIncome(n); persistToFirestore(KEYS.income, n); },
  };

  return (
    <div className="relative min-h-screen">
      <AmbientBackground />
      <FontStyles />
      {loading ? (
        <div className="relative z-10 min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Leaf className="text-[#C9A66B] animate-pulse" size={28} />
            <div className="text-[#F3EFE3] font-ticket text-xs tracking-[0.25em] uppercase">Opening the ledger…</div>
          </div>
        </div>
      ) : !currentUser ? (
        <LoginScreen profiles={profiles} setProfiles={persist.profiles} />
      ) : (
        <Shell currentUser={currentUser} onLogout={() => setCurrentUser(null)} syncedAt={syncedAt}>
          <MainApp currentUser={currentUser} profiles={profiles} setProfiles={persist.profiles}
            expenses={expenses} setExpenses={persist.expenses} income={income} setIncome={persist.income} />
        </Shell>
      )}
    </div>
  );
}

function MainApp({ currentUser, profiles, setProfiles, expenses, setExpenses, income, setIncome }) {
  const isOwner = currentUser.role === "owner";
  const tabsBase = [["dashboard", "Dashboard", LayoutDashboard], ["add", "Add Expense", Plus], ["ledger", "Ledger", ClipboardList]];
  const tabs = isOwner ? [...tabsBase, ["income", "Income", PiggyBank], ["staff", "Staff", Users]] : tabsBase;
  const [tab, setTab] = useState("dashboard");

  return (
    <div>
      <NavTabs tabs={tabs} current={tab} onChange={setTab} />
      <div>
        {tab === "dashboard" && <Dashboard expenses={expenses} income={income} isOwner={isOwner} />}
        {tab === "add" && <AddExpense expenses={expenses} setExpenses={setExpenses} currentUser={currentUser} />}
        {tab === "ledger" && <Ledger expenses={expenses} setExpenses={setExpenses} />}
        {tab === "income" && isOwner && <IncomeManager income={income} setIncome={setIncome} currentUser={currentUser} />}
        {tab === "staff" && isOwner && <StaffManager profiles={profiles} setProfiles={setProfiles} currentUser={currentUser} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ambient background + fonts (same visual language as the staff app)
// ---------------------------------------------------------------------------
function AmbientBackground() {
  return (
    <div className="fixed inset-0 -z-10">
      <img src={BRAND.hero} alt="" className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0F1C15]/93 via-[#16261F]/88 to-[#0F1C15]/95" />
    </div>
  );
}

function FontStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Jost:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
      .font-display { font-family: 'Cormorant Garamond', ui-serif, Georgia, serif; letter-spacing: 0.01em; }
      .font-ui { font-family: 'Jost', ui-sans-serif, sans-serif; }
      .font-ticket { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
      body { font-family: 'Jost', ui-sans-serif, sans-serif; }
      .scrollbar-none::-webkit-scrollbar { display: none; }
      .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
    `}</style>
  );
}

function roleColor(role) { return { owner: "#C9A66B", manager: "#5B8FA3" }[role] || "#9C9686"; }

// ---------------------------------------------------------------------------
// Login (same pattern as staff app — PIN profiles, owner sets up first)
// ---------------------------------------------------------------------------
function LoginScreen({ profiles, setProfiles }) {
  const [pendingLogin, setPendingLogin] = useState(null);
  const [pinInput, setPinInput] = useState("");
  const [err, setErr] = useState("");
  const [showSetup, setShowSetup] = useState(profiles.length === 0);
  const [form, setForm] = useState({ name: "", role: "manager", pin: "" });

  const attemptLogin = (profile, pin) => {
    if (String(profile.pin) === String(pin)) window.dispatchEvent(new CustomEvent("el-login", { detail: profile }));
    else setErr("Incorrect PIN. Try again.");
  };

  const createProfile = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.pin.trim()) return;
    const p = { id: uid(), name: form.name.trim(), role: form.role, pin: form.pin.trim() };
    const next = [...profiles, p];
    setProfiles(next);
    if (profiles.length === 0) window.dispatchEvent(new CustomEvent("el-login", { detail: p }));
    setForm({ name: "", role: "manager", pin: "" });
    setShowSetup(false);
  };

  return (
    <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <div className="flex flex-col items-center mb-8 text-center">
        <img src={BRAND.logo} alt="Serengeti" className="h-14 sm:h-16 w-auto mb-3 drop-shadow-lg" />
        <h1 className="font-display text-4xl sm:text-5xl font-600 text-white tracking-tight drop-shadow">Serengeti Ledger</h1>
        <p className="font-ui text-[10px] sm:text-xs text-[#C9A66B] uppercase tracking-[0.35em] mt-1.5 font-medium">Expense &amp; Income Book</p>
      </div>

      {profiles.length === 0 ? (
        <div className="w-full max-w-sm bg-white/97 backdrop-blur-xl rounded-3xl p-6 shadow-2xl">
          <p className="font-ui text-xs text-[#9C9686] uppercase mb-4 tracking-widest font-medium">Set up the owner account</p>
          <form onSubmit={createProfile} className="space-y-3">
            <input autoFocus placeholder="Owner's name" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value, role: "owner" })}
              className="w-full border border-[#EAE4D3] bg-[#FAF8F2] px-4 py-3 text-sm rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#C9A66B]" />
            <input placeholder="Choose a 4+ digit PIN" value={form.pin} inputMode="numeric" pattern="[0-9]*" autoComplete="off"
              onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })}
              className="w-full border border-[#EAE4D3] bg-[#FAF8F2] px-4 py-3 text-sm rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#C9A66B]" />
            <button type="submit" className="w-full bg-[#16261F] text-white py-3 rounded-2xl text-sm font-ui font-semibold uppercase tracking-wide shadow-lg">
              Create Owner Account
            </button>
          </form>
        </div>
      ) : (
        <div className="w-full max-w-md">
          <p className="font-ui text-xs text-[#EAE4D3] uppercase mb-3 tracking-widest text-center font-medium">Who's signing in?</p>
          <div className="grid grid-cols-2 gap-3">
            {profiles.map((p) => (
              <button key={p.id} onClick={() => { setPendingLogin(p); setPinInput(""); setErr(""); }}
                className="bg-white/95 hover:bg-white rounded-2xl px-4 py-4 text-left shadow-xl transition backdrop-blur-sm hover:-translate-y-0.5">
                <div className="w-8 h-8 rounded-full flex items-center justify-center mb-2 text-white text-xs font-ui font-semibold" style={{ backgroundColor: roleColor(p.role) }}>
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="font-display text-lg font-600 text-[#16261F] leading-tight">{p.name}</div>
                <div className="font-ui text-[10px] uppercase tracking-widest font-medium" style={{ color: roleColor(p.role) }}>{ROLE_LABEL[p.role]}</div>
              </button>
            ))}
          </div>
          <button onClick={() => setShowSetup(true)} className="mt-5 text-[#EAE4D3] text-xs font-ui underline mx-auto block">+ add a profile</button>
        </div>
      )}

      {showSetup && profiles.length > 0 && (
        <div className="fixed inset-0 z-20 bg-black/60 flex items-center justify-center px-4" onClick={() => setShowSetup(false)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <p className="font-display text-xl font-600 text-[#16261F]">New Profile</p>
              <button onClick={() => setShowSetup(false)} className="p-1 hover:bg-[#F3EFE3] rounded-full"><X size={18} /></button>
            </div>
            <form onSubmit={createProfile} className="space-y-3">
              <input autoFocus placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-[#EAE4D3] bg-[#FAF8F2] px-4 py-3 text-sm rounded-2xl" />
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full border border-[#EAE4D3] bg-[#FAF8F2] px-4 py-3 text-sm rounded-2xl">
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
              <input placeholder="PIN" value={form.pin} inputMode="numeric" pattern="[0-9]*" autoComplete="off"
                onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })}
                className="w-full border border-[#EAE4D3] bg-[#FAF8F2] px-4 py-3 text-sm rounded-2xl" />
              <button type="submit" className="w-full bg-[#16261F] text-white py-3 rounded-2xl text-sm font-ui font-semibold uppercase tracking-wide">Create Profile</button>
            </form>
          </div>
        </div>
      )}

      {pendingLogin && (
        <div className="fixed inset-0 z-20 bg-black/60 flex items-center justify-center px-4" onClick={() => setPendingLogin(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3 text-white text-sm font-ui font-semibold" style={{ backgroundColor: roleColor(pendingLogin.role) }}>
              {pendingLogin.name.charAt(0).toUpperCase()}
            </div>
            <p className="font-display text-2xl font-600 text-[#16261F] mb-1 leading-tight">{pendingLogin.name}</p>
            <p className="font-ui text-[10px] uppercase tracking-widest mb-4 font-medium" style={{ color: roleColor(pendingLogin.role) }}>{ROLE_LABEL[pendingLogin.role]}</p>
            <form onSubmit={(e) => { e.preventDefault(); attemptLogin(pendingLogin, pinInput); }}>
              <input autoFocus type="password" placeholder="PIN" value={pinInput} inputMode="numeric" pattern="[0-9]*" autoComplete="off"
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                className="w-full border border-[#EAE4D3] bg-[#FAF8F2] px-4 py-3 text-sm rounded-2xl mb-2 text-center tracking-[0.3em] font-ticket" />
              {err && <p className="text-[#C1694F] text-xs mb-2">{err}</p>}
              <button type="submit" className="w-full bg-[#16261F] text-white py-3 rounded-2xl text-sm font-ui font-semibold uppercase tracking-wide">Log In</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shell + nav
// ---------------------------------------------------------------------------
function Shell({ currentUser, onLogout, syncedAt, children }) {
  return (
    <div className="relative z-10 min-h-screen flex flex-col">
      <header className="bg-[#16261F] text-white sticky top-0 z-30 shadow-lg">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <img src={BRAND.logo} alt="Serengeti" className="h-7 sm:h-8 w-auto shrink-0" />
            <div className="min-w-0">
              <div className="font-display text-base sm:text-lg font-600 leading-none truncate">Serengeti Ledger</div>
              <div className="font-ui text-[8px] sm:text-[9px] text-[#C9A66B] uppercase tracking-[0.2em] hidden xs:block font-medium">Expense Book</div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <div className="hidden md:flex items-center gap-1 text-[10px] font-ticket text-[#B8B2A0] uppercase tracking-widest">
              <CircleDot size={9} className="text-[#7C8F5E]" /> synced {syncedAt ? syncedAt.toLocaleTimeString() : "…"}
            </div>
            <div className="text-right leading-tight hidden sm:block">
              <div className="text-sm font-medium">{currentUser.name}</div>
              <div className="text-[10px] font-ui uppercase tracking-widest font-medium" style={{ color: roleColor(currentUser.role) }}>{ROLE_LABEL[currentUser.role]}</div>
            </div>
            <button onClick={onLogout} className="p-2 hover:bg-white/10 rounded-full" title="Log out"><LogOut size={18} /></button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 pt-4 sm:pt-6 pb-4">
          <div className="bg-[#FAF8F2] rounded-3xl shadow-2xl p-4 sm:p-6 pb-24 sm:pb-6 min-h-[72vh]">{children}</div>
        </div>
      </main>
    </div>
  );
}

function NavTabs({ tabs, current, onChange }) {
  return (
    <>
      <div className="hidden sm:flex gap-1 mb-5 bg-[#F0EBDD] rounded-full p-1 w-fit">
        {tabs.map(([key, label, Icon]) => (
          <button key={key} onClick={() => onChange(key)}
            className={`px-4 py-2 rounded-full text-sm font-ui font-medium flex items-center gap-2 transition ${current === key ? "bg-[#16261F] text-white shadow-md" : "text-[#5c5648] hover:text-[#16261F]"}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#F0EBDD] shadow-[0_-4px_24px_rgba(0,0,0,0.1)] flex justify-around py-1.5" style={{ paddingBottom: "max(0.4rem, env(safe-area-inset-bottom))" }}>
        {tabs.map(([key, label, Icon]) => (
          <button key={key} onClick={() => onChange(key)} className="flex flex-col items-center gap-0.5 px-2.5 py-1.5">
            <Icon size={20} className={current === key ? "text-[#C9A66B]" : "text-[#9C9686]"} />
            <span className={`text-[8.5px] font-ui uppercase tracking-wide ${current === key ? "text-[#16261F] font-semibold" : "text-[#9C9686]"}`}>{label}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function Tag({ children, tone = "default" }) {
  const tones = { default: "bg-[#F0EBDD] text-[#5c5648]", warn: "bg-[#C1694F] text-white", good: "bg-[#7C8F5E] text-white" };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-ui font-medium uppercase tracking-widest whitespace-nowrap ${tones[tone]}`}>{children}</span>;
}

// ---------------------------------------------------------------------------
// ADD EXPENSE
// ---------------------------------------------------------------------------
function AddExpense({ expenses, setExpenses, currentUser }) {
  const [form, setForm] = useState({ date: todayStr(), particulars: "", folio: "", amount: "", receipt: "" });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [justAdded, setJustAdded] = useState(false);

  const knownParticulars = [...new Set(expenses.map((e) => e.particulars))].sort();

  const handleReceipt = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadReceiptImage(file);
      setForm((f) => ({ ...f, receipt: url }));
    } catch (e) {
      console.error(e);
      setError("Receipt upload failed — check the Cloudinary setup.");
    } finally {
      setUploading(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.particulars.trim() || !form.amount) { setError("Particulars and amount are required."); return; }
    setError("");
    const entry = {
      id: uid(), date: form.date, particulars: form.particulars.trim(), folio: form.folio.trim(),
      amount: parseFloat(form.amount), receipt: form.receipt || "", addedBy: currentUser.name, createdAt: new Date().toISOString(),
    };
    setExpenses([entry, ...expenses]);
    setForm({ date: todayStr(), particulars: "", folio: "", amount: "", receipt: "" });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="font-display text-2xl font-600 text-[#16261F] mb-4 flex items-center gap-2"><Plus size={20} /> Add Expense</div>
      <div className="bg-white rounded-2xl shadow-md p-5">
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-[10px] font-ui uppercase tracking-widest text-[#9C9686] font-medium">Date</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full border border-[#EAE4D3] rounded-xl px-3 py-2.5 text-sm mt-1 font-ticket" />
          </div>
          <div>
            <label className="text-[10px] font-ui uppercase tracking-widest text-[#9C9686] font-medium">Particulars</label>
            <input list="particulars-list" value={form.particulars} onChange={(e) => setForm({ ...form, particulars: e.target.value })}
              placeholder="e.g. Feed, Vegetable, Labour, Guest…" className="w-full border border-[#EAE4D3] rounded-xl px-3 py-2.5 text-sm mt-1" />
            <datalist id="particulars-list">
              {knownParticulars.map((p) => <option key={p} value={p} />)}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-ui uppercase tracking-widest text-[#9C9686] font-medium">Folio (optional)</label>
              <input value={form.folio} onChange={(e) => setForm({ ...form, folio: e.target.value })}
                className="w-full border border-[#EAE4D3] rounded-xl px-3 py-2.5 text-sm mt-1 font-ticket" />
            </div>
            <div>
              <label className="text-[10px] font-ui uppercase tracking-widest text-[#9C9686] font-medium">Amount</label>
              <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} inputMode="decimal"
                className="w-full border border-[#EAE4D3] rounded-xl px-3 py-2.5 text-sm mt-1 font-ticket" placeholder="₹" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-ui uppercase tracking-widest text-[#9C9686] font-medium block mb-1">Receipt photo (optional)</label>
            {form.receipt ? (
              <div className="flex items-center gap-3">
                <img src={form.receipt} alt="" className="w-16 h-16 rounded-xl object-cover" />
                <button type="button" onClick={() => setForm((f) => ({ ...f, receipt: "" }))} className="text-xs text-[#C1694F] font-ui underline">remove</button>
              </div>
            ) : (
              <label className="flex items-center gap-2 text-xs font-ui text-[#8a6f42] underline cursor-pointer w-fit">
                {uploading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
                {uploading ? "uploading…" : "attach a photo"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleReceipt(e.target.files?.[0])} />
              </label>
            )}
          </div>
          {error && <p className="text-[#C1694F] text-xs font-ui">{error}</p>}
          {justAdded && <p className="text-[#7C8F5E] text-xs font-ui">Entry added.</p>}
          <button type="submit" disabled={uploading} className="w-full bg-[#16261F] disabled:opacity-40 text-white py-3 rounded-full text-sm font-ui font-semibold uppercase tracking-wide shadow-lg flex items-center justify-center gap-2">
            <Plus size={16} /> Add to Ledger
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LEDGER — day-book style, filterable by month
// ---------------------------------------------------------------------------
function Ledger({ expenses, setExpenses }) {
  const months = monthsFromFYStart().reverse();
  const [month, setMonth] = useState(months[0] || monthKey(todayStr()));
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ particulars: "", folio: "", amount: "" });

  const filtered = expenses
    .filter((e) => monthKey(e.date) === month)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  const total = filtered.reduce((s, e) => s + e.amount, 0);

  const removeEntry = (id) => setExpenses(expenses.filter((e) => e.id !== id));

  const startEdit = (e) => {
    setEditingId(e.id);
    setEditForm({ particulars: e.particulars, folio: e.folio || "", amount: e.amount.toString() });
  };
  const cancelEdit = () => setEditingId(null);
  const saveEdit = (id) => {
    if (!editForm.particulars.trim() || !editForm.amount) return;
    setExpenses(expenses.map((e) => e.id === id
      ? { ...e, particulars: editForm.particulars.trim(), folio: editForm.folio.trim(), amount: parseFloat(editForm.amount) }
      : e
    ));
    setEditingId(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="font-display text-2xl font-600 text-[#16261F] flex items-center gap-2"><ClipboardList size={20} /> Ledger</div>
        <select value={month} onChange={(e) => setMonth(e.target.value)} className="border border-[#EAE4D3] bg-white rounded-full px-4 py-2 text-sm shadow-sm font-ui">
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>
      <div className="bg-white rounded-2xl shadow-md overflow-hidden">
        <div className="grid grid-cols-[70px_1fr_70px_90px_60px] gap-2 px-4 py-2.5 bg-[#F0EBDD] text-[9px] font-ui uppercase tracking-widest text-[#5c5648] font-medium">
          <span>Date</span><span>Particulars</span><span>Folio</span><span className="text-right">Amount</span><span></span>
        </div>
        <div className="divide-y divide-[#F0EBDD] max-h-[55vh] overflow-y-auto">
          {filtered.length === 0 && <div className="px-4 py-6 text-sm text-[#9C9686] font-ui text-center">No entries for {monthLabel(month)}.</div>}
          {filtered.map((e) => (
            editingId === e.id ? (
              <div key={e.id} className="px-4 py-3 space-y-2 bg-[#FAF8F2]">
                <div className="grid grid-cols-2 gap-2">
                  <input value={editForm.particulars} onChange={(ev) => setEditForm({ ...editForm, particulars: ev.target.value })}
                    placeholder="Particulars" className="border border-[#EAE4D3] rounded-lg px-2.5 py-1.5 text-sm" />
                  <input value={editForm.folio} onChange={(ev) => setEditForm({ ...editForm, folio: ev.target.value })}
                    placeholder="Folio" className="border border-[#EAE4D3] rounded-lg px-2.5 py-1.5 text-sm font-ticket" />
                </div>
                <div className="flex items-center gap-2">
                  <input value={editForm.amount} onChange={(ev) => setEditForm({ ...editForm, amount: ev.target.value })} inputMode="decimal"
                    placeholder="Amount" className="border border-[#EAE4D3] rounded-lg px-2.5 py-1.5 text-sm font-ticket flex-1" />
                  <button onClick={() => saveEdit(e.id)} className="p-1.5 bg-[#7C8F5E] text-white rounded-full shrink-0"><Save size={14} /></button>
                  <button onClick={cancelEdit} className="p-1.5 bg-[#9C9686] text-white rounded-full shrink-0"><X size={14} /></button>
                </div>
              </div>
            ) : (
              <div key={e.id} className="grid grid-cols-[70px_1fr_70px_90px_60px] gap-2 px-4 py-2.5 items-center text-sm">
                <span className="font-ticket text-xs text-[#9C9686]">{e.date.slice(8, 10)}/{e.date.slice(5, 7)}</span>
                <span className="text-[#16261F] truncate flex items-center gap-1.5">
                  {e.particulars}
                  {e.receipt && <a href={e.receipt} target="_blank" rel="noreferrer" className="text-[#8a6f42]"><ImagePlus size={12} /></a>}
                </span>
                <span className="font-ticket text-xs text-[#9C9686]">{e.folio || "—"}</span>
                <span className="font-ticket text-sm text-right text-[#16261F]">{money(e.amount)}</span>
                <span className="flex items-center gap-2 justify-self-end">
                  <button onClick={() => startEdit(e)} className="text-[#5c5648] hover:text-[#16261F]"><Pencil size={14} /></button>
                  <button onClick={() => removeEntry(e.id)} className="text-[#C1694F]"><Trash2 size={14} /></button>
                </span>
              </div>
            )
          ))}
        </div>
        <div className="grid grid-cols-[70px_1fr_70px_90px_60px] gap-2 px-4 py-3 bg-[#FAF8F2] border-t border-[#F0EBDD]">
          <span></span><span className="font-ui font-semibold text-sm text-[#16261F]">Total</span><span></span>
          <span className="font-display font-600 text-lg text-right text-[#8a6f42]">{money(total)}</span><span></span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DASHBOARD — KPIs, monthly trend, top categories, recommendations
// ---------------------------------------------------------------------------
const CHART_COLORS = ["#C9A66B", "#7C8F5E", "#5B8FA3", "#C1694F", "#9C9686", "#8a6f42", "#a8b98f", "#d9b98a"];

function generateRecommendations(expenses) {
  const recs = [];
  if (expenses.length === 0) return recs;
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const byCat = {};
  expenses.forEach((e) => {
    const key = e.particulars.trim().toLowerCase();
    byCat[key] = byCat[key] || { label: e.particulars.trim(), total: 0, count: 0 };
    byCat[key].total += e.amount;
    byCat[key].count += 1;
  });
  const cats = Object.values(byCat).sort((a, b) => b.total - a.total);

  const top = cats[0];
  if (top && total > 0) {
    const pct = Math.round((top.total / total) * 100);
    if (pct >= 25) {
      recs.push(`"${top.label}" is your single biggest expense at ${pct}% of total spend (${money(top.total)}) — worth negotiating supplier rates or reviewing frequency.`);
    }
  }

  cats.forEach((c) => {
    const avg = c.total / c.count;
    if (c.count >= 5 && avg > 0 && avg < total * 0.02) {
      recs.push(`${c.count} separate "${c.label}" entries averaging ${money(avg)} each — consolidating into fewer bulk purchases could cut repeat trip and delivery overheads.`);
    }
  });

  const months = monthsFromFYStart();
  if (months.length >= 2) {
    const thisMonth = months[months.length - 1];
    const lastMonth = months[months.length - 2];
    const byCatMonth = (m) => {
      const acc = {};
      expenses.filter((e) => monthKey(e.date) === m).forEach((e) => {
        const key = e.particulars.trim().toLowerCase();
        acc[key] = (acc[key] || 0) + e.amount;
      });
      return acc;
    };
    const thisData = byCatMonth(thisMonth);
    const lastData = byCatMonth(lastMonth);
    Object.entries(thisData).forEach(([key, val]) => {
      const prev = lastData[key];
      if (prev && prev > 0 && val > prev * 1.25 && val - prev > total * 0.03) {
        const label = expenses.find((e) => e.particulars.trim().toLowerCase() === key)?.particulars || key;
        const pctUp = Math.round(((val - prev) / prev) * 100);
        recs.push(`"${label}" jumped ${pctUp}% from ${monthLabel(lastMonth)} to ${monthLabel(thisMonth)} (${money(prev)} → ${money(val)}) — worth checking what changed.`);
      }
    });
  }

  if (recs.length === 0) recs.push("Spending looks steady across categories — no single area stands out yet. Keep logging entries for sharper insights over time.");
  return recs.slice(0, 5);
}

function KpiCard({ label, value, icon: Icon, tint }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${tint}22` }}>
        <Icon size={18} style={{ color: tint }} />
      </div>
      <div className="min-w-0">
        <div className="font-display text-xl sm:text-2xl font-600 text-[#16261F] leading-none truncate">{value}</div>
        <div className="text-[10px] font-ui uppercase tracking-widest text-[#9C9686] mt-1 font-medium">{label}</div>
      </div>
    </div>
  );
}

function Dashboard({ expenses, income, isOwner }) {
  const fyStart = fiscalYearStart();
  const fyExpenses = expenses.filter((e) => new Date(e.date) >= fyStart);
  const totalFY = fyExpenses.reduce((s, e) => s + e.amount, 0);
  const thisMonthKey = monthKey(todayStr());
  const thisMonthTotal = expenses.filter((e) => monthKey(e.date) === thisMonthKey).reduce((s, e) => s + e.amount, 0);

  const byCat = {};
  fyExpenses.forEach((e) => {
    const key = e.particulars.trim();
    byCat[key] = (byCat[key] || 0) + e.amount;
  });
  const topCategories = Object.entries(byCat).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 8);
  const highestCategory = topCategories[0];

  const months = monthsFromFYStart();
  const monthlyTotals = months.map((m) => ({
    month: monthLabel(m).split(" ")[0],
    expense: expenses.filter((e) => monthKey(e.date) === m).reduce((s, e) => s + e.amount, 0),
  }));

  const recommendations = useMemo(() => generateRecommendations(fyExpenses), [expenses]);

  const fyIncome = income.filter((i) => new Date(i.date) >= fyStart).reduce((s, i) => s + i.amount, 0);
  const net = fyIncome - totalFY;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label={`Expenses since ${fyStart.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`} value={money(totalFY)} icon={TrendingDown} tint="#C1694F" />
        <KpiCard label="This Month" value={money(thisMonthTotal)} icon={CalendarDays} tint="#C9A66B" />
        <KpiCard label="Highest Expense Item" value={highestCategory ? highestCategory.name : "—"} icon={Receipt} tint="#5B8FA3" />
        <KpiCard label="Total Entries (FY)" value={fyExpenses.length} icon={ClipboardList} tint="#7C8F5E" />
      </div>

      {isOwner && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Income (FY)" value={money(fyIncome)} icon={TrendingUp} tint="#7C8F5E" />
          <div className={`bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3 col-span-1 lg:col-span-3`}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: net >= 0 ? "#7C8F5E22" : "#C1694F22" }}>
              <Wallet size={18} style={{ color: net >= 0 ? "#7C8F5E" : "#C1694F" }} />
            </div>
            <div>
              <div className="font-display text-xl sm:text-2xl font-600 leading-none" style={{ color: net >= 0 ? "#16261F" : "#C1694F" }}>{money(net)}</div>
              <div className="text-[10px] font-ui uppercase tracking-widest text-[#9C9686] mt-1 font-medium">Net {net >= 0 ? "Surplus" : "Deficit"} (Income − Expenses, FY to date)</div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="font-display text-lg font-600 text-[#16261F] mb-3">Monthly Expense Trend — FY {fyStart.getFullYear()}</div>
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer>
            <BarChart data={monthlyTotals} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0EBDD" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9C9686" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9C9686" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #F0EBDD", fontSize: 12 }} formatter={(v) => money(v)} />
              <Bar dataKey="expense" name="Expense" fill="#C1694F" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm p-4">
          <div className="font-display text-lg font-600 text-[#16261F] mb-3">Highest Expense Items (FY to date)</div>
          {topCategories.length === 0 ? (
            <p className="text-sm text-[#9C9686] font-ui">No expenses logged yet this financial year.</p>
          ) : (
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={topCategories} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0EBDD" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#9C9686" }} axisLine={false} tickLine={false} tickFormatter={(v) => money(v)} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: "#16261F" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #F0EBDD", fontSize: 12 }} formatter={(v) => money(v)} />
                  <Bar dataKey="total" fill="#C9A66B" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="font-display text-lg font-600 text-[#16261F] mb-3">Spend Share</div>
          {topCategories.length === 0 ? (
            <p className="text-sm text-[#9C9686] font-ui">Nothing to show yet.</p>
          ) : (
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={topCategories} dataKey="total" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={3}>
                    {topCategories.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #F0EBDD", fontSize: 12 }} formatter={(v) => money(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="font-display text-lg font-600 text-[#16261F] mb-3 flex items-center gap-2"><Lightbulb size={16} className="text-[#C9A66B]" /> Recommendations to Reduce Expenses</div>
        <ul className="space-y-2">
          {recommendations.map((r, i) => (
            <li key={i} className="text-sm font-ui text-[#5c5648] flex gap-2">
              <span className="text-[#C9A66B] shrink-0">•</span><span>{r}</span>
            </li>
          ))}
        </ul>
        <p className="text-[10px] text-[#9C9686] font-ui mt-3 italic">Auto-generated from spending patterns in your logged entries — a starting point for review, not financial advice.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// INCOME — owner only
// ---------------------------------------------------------------------------
function IncomeManager({ income, setIncome, currentUser }) {
  const [form, setForm] = useState({ date: todayStr(), source: "", amount: "" });
  const [error, setError] = useState("");
  const months = monthsFromFYStart().reverse();
  const [month, setMonth] = useState(months[0] || monthKey(todayStr()));

  const submit = (e) => {
    e.preventDefault();
    if (!form.source.trim() || !form.amount) { setError("Source and amount are required."); return; }
    setError("");
    const entry = { id: uid(), date: form.date, source: form.source.trim(), amount: parseFloat(form.amount), addedBy: currentUser.name, createdAt: new Date().toISOString() };
    setIncome([entry, ...income]);
    setForm({ date: todayStr(), source: "", amount: "" });
  };
  const removeEntry = (id) => setIncome(income.filter((i) => i.id !== id));

  const filtered = income.filter((i) => monthKey(i.date) === month).sort((a, b) => a.date.localeCompare(b.date));
  const total = filtered.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="font-display text-2xl font-600 text-[#16261F] flex items-center gap-2"><PiggyBank size={20} /> Income</div>
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="border border-[#EAE4D3] bg-white rounded-full px-4 py-2 text-sm shadow-sm font-ui">
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </div>
        <div className="bg-white rounded-2xl shadow-md overflow-hidden">
          <div className="grid grid-cols-[70px_1fr_90px_36px] gap-2 px-4 py-2.5 bg-[#F0EBDD] text-[9px] font-ui uppercase tracking-widest text-[#5c5648] font-medium">
            <span>Date</span><span>Source</span><span className="text-right">Amount</span><span></span>
          </div>
          <div className="divide-y divide-[#F0EBDD] max-h-[50vh] overflow-y-auto">
            {filtered.length === 0 && <div className="px-4 py-6 text-sm text-[#9C9686] font-ui text-center">No income logged for {monthLabel(month)}.</div>}
            {filtered.map((i) => (
              <div key={i.id} className="grid grid-cols-[70px_1fr_90px_36px] gap-2 px-4 py-2.5 items-center text-sm">
                <span className="font-ticket text-xs text-[#9C9686]">{i.date.slice(8, 10)}/{i.date.slice(5, 7)}</span>
                <span className="text-[#16261F] truncate">{i.source}</span>
                <span className="font-ticket text-sm text-right text-[#7C8F5E]">{money(i.amount)}</span>
                <button onClick={() => removeEntry(i.id)} className="text-[#C1694F] justify-self-end"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[70px_1fr_90px_36px] gap-2 px-4 py-3 bg-[#FAF8F2] border-t border-[#F0EBDD]">
            <span></span><span className="font-ui font-semibold text-sm text-[#16261F]">Total</span>
            <span className="font-display font-600 text-lg text-right text-[#7C8F5E]">{money(total)}</span><span></span>
          </div>
        </div>
      </div>
      <div>
        <div className="bg-white rounded-2xl shadow-md p-4 sm:sticky sm:top-4">
          <div className="font-display text-lg font-600 text-[#16261F] mb-3">Add Income</div>
          <form onSubmit={submit} className="space-y-2">
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full border border-[#EAE4D3] rounded-xl px-3 py-2.5 text-sm font-ticket" />
            <input placeholder="Source (e.g. Entry tickets, Café sales)" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}
              className="w-full border border-[#EAE4D3] rounded-xl px-3 py-2.5 text-sm" />
            <input placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} inputMode="decimal"
              className="w-full border border-[#EAE4D3] rounded-xl px-3 py-2.5 text-sm font-ticket" />
            {error && <p className="text-[#C1694F] text-xs font-ui">{error}</p>}
            <button type="submit" className="w-full bg-[#16261F] text-white py-3 rounded-full text-sm font-ui font-semibold uppercase tracking-wide shadow-lg flex items-center justify-center gap-2"><Plus size={16} /> Add Income</button>
          </form>
          <p className="text-[11px] text-[#9C9686] font-ui mt-3">Only owner logins can see or add income.</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// STAFF (owner only)
// ---------------------------------------------------------------------------
function StaffManager({ profiles, setProfiles, currentUser }) {
  const [form, setForm] = useState({ name: "", role: "manager", pin: "" });
  const addProfile = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.pin.trim()) return;
    setProfiles([...profiles, { id: uid(), name: form.name.trim(), role: form.role, pin: form.pin.trim() }]);
    setForm({ name: "", role: "manager", pin: "" });
  };
  const removeProfile = (id) => { if (id === currentUser.id) return; setProfiles(profiles.filter((p) => p.id !== id)); };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2 bg-white rounded-2xl shadow-sm divide-y divide-[#F0EBDD]">
        {profiles.map((p) => (
          <div key={p.id} className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-ui font-semibold shrink-0" style={{ backgroundColor: roleColor(p.role) }}>
                {p.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-medium text-[#16261F]">{p.name}</div>
                <div className="text-[10px] font-ui uppercase tracking-widest font-medium" style={{ color: roleColor(p.role) }}>{ROLE_LABEL[p.role]}</div>
              </div>
            </div>
            {p.id !== currentUser.id && <button onClick={() => removeProfile(p.id)} className="text-[#C1694F] p-1.5 hover:bg-[#F0EBDD] rounded-full"><Trash2 size={16} /></button>}
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl shadow-md p-4">
        <div className="font-display text-lg font-600 text-[#16261F] mb-3 flex items-center gap-2"><ShieldCheck size={16} /> New Profile</div>
        <form onSubmit={addProfile} className="space-y-2">
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-[#EAE4D3] rounded-xl px-3 py-2.5 text-sm" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full border border-[#EAE4D3] rounded-xl px-3 py-2.5 text-sm">
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
          <input placeholder="PIN" value={form.pin} inputMode="numeric" pattern="[0-9]*" autoComplete="off"
            onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })} className="w-full border border-[#EAE4D3] rounded-xl px-3 py-2.5 text-sm" />
          <button type="submit" className="w-full bg-[#16261F] text-white py-3 rounded-full text-sm font-ui font-semibold uppercase tracking-wide shadow-lg">Create Profile</button>
        </form>
      </div>
    </div>
  );
}
