/* ================================================================
   Cash Riyada — Cloud bridge + pipeline layer  (client side)
   ----------------------------------------------------------------
   docs.html is already a full multi-client CRM stored in localStorage
   under the key `cashriyada_clients_v1`, with:
     - collectAllData()  -> serialises the whole consultation to JSON
     - loadClient(id)    -> fully restores a client (rebuilds rows)
     - saveCurrentClient(), deleteClient(id)

   This file adds a thin CLOUD + STATUS layer on top, WITHOUT changing
   any report logic:
     1) mirrors every saved client to Firestore (collection "clients")
     2) adds a per-client "status" used by the pipeline board
     3) auto-loads a client when docs.html is opened with ?client=ID
     4) injects a small toolbar (status + save-to-cloud + open board)

   Hosting note: GitHub Pages is STATIC. PDF here is the report's own
   browser print (طباعة). The old Cash Clinic PDF->Drive step needed a
   Firebase Cloud Function (a server) and is intentionally NOT used.
   ================================================================ */
(function () {
  "use strict";

  /* 1) PASTE your NEW Cash Riyada Firebase web config here.
     Firebase console -> Project settings -> Your apps -> Web app -> Config.
     (Create a brand-new project, e.g. "cash-riyada", separate from Cash Clinic.) */
  var firebaseConfig = {
    apiKey: "AIzaSyDGbYQ-VURwYzyRyIURBxylry_t-HnQbbk",
    authDomain: "sh-riyada.firebaseapp.com",
    projectId: "sh-riyada",
    storageBucket: "sh-riyada.firebasestorage.app",
    messagingSenderId: "1036435550825",
    appId: "1:1036435550825:web:ce575879e7b7e96612e8f8",
  };

  /* ===== Google Drive (save PDF) =====
     After deploying the Apps Script Web App (see README / google-drive-apps-script.gs),
     paste its /exec URL between the quotes below. Leave empty to disable the Drive button. */
  window.CR_DRIVE_ENDPOINT = "https://script.google.com/macros/s/AKfycbzXV0M1OOYThVEtxlBvJNzOHsC9uOXFJ9mb_wadLxUnLnGA4EcCzxKGIsjDykCon-Js/exec";

  // ---- Pipeline status model (client status columns) ----
  var STATUS = [
    { key: "new",        label: "جديد",           color: "#3EADAD" },
    { key: "first",      label: "الجلسة الأولى",   color: "#C98A2B" },
    { key: "second",     label: "الجلسة الثانية",  color: "#6F2440" },
    { key: "done",       label: "مكتمل",           color: "#27ae60" },
    { key: "inprogress", label: "تحت التنفيذ",     color: "#2B898C" },
  ];
  window.CR_STATUS = STATUS;
  var STATUS_KEYS = STATUS.map(function (s) { return s.key; });

  var CM_KEY = "cashriyada_clients_v1"; // same key the report already uses

  // ---- Lazy Firebase (modular SDK from CDN, only loaded when needed) ----
  var _fb = null;
  async function fb() {
    if (_fb) return _fb;
    var appMod  = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js");
    var fsMod   = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
    var authMod = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js");
    var app  = appMod.initializeApp(firebaseConfig);
    var db   = fsMod.getFirestore(app);
    var auth = authMod.getAuth(app);
    _fb = { app: app, db: db, auth: auth, fs: fsMod, authMod: authMod };
    return _fb;
  }
  async function ensureAuth(ctx) {
    if (ctx.auth.currentUser) return ctx.auth.currentUser;
    var cred = await ctx.authMod.signInAnonymously(ctx.auth);
    return cred.user;
  }

  // ---- Local DB helpers (mirror of the report's own) ----
  function cmLoad() {
    try { return JSON.parse(localStorage.getItem(CM_KEY) || "{}"); }
    catch (e) { return {}; }
  }
  function cmSave(db) { localStorage.setItem(CM_KEY, JSON.stringify(db)); }

  function pick(data, id) { return (data && data[id] != null) ? data[id] : ""; }

  // Build the flat identity fields the board needs, from a data blob.
  function identityFrom(data) {
    return {
      label:   pick(data, "c-name") || pick(data, "c-company") || "عميل بدون اسم",
      company: pick(data, "c-company"),
      phone:   pick(data, "c-phone"),
      sector:  pick(data, "c-sector"),
      date:    pick(data, "c-date"),
    };
  }

  function currentStatus() {
    var sel = document.getElementById("cr-status-select");
    return sel ? sel.value : "new";
  }

  var CRCloud = {
    /** Push one client (by id) from local storage up to Firestore. */
    saveClient: async function (clientId, statusOverride) {
      try {
        var db = cmLoad();
        var id = clientId || window.currentClientId;
        if (!id || !db[id]) return { ok: false, error: "no local client to save" };
        var entry = db[id];
        var data = entry.data || {};
        var ident = identityFrom(data);
        var status = statusOverride || currentStatus() || "new";

        var ctx = await fb();
        await ensureAuth(ctx);
        await ctx.fs.setDoc(
          ctx.fs.doc(ctx.db, "clients", id),
          {
            id: id,
            label: entry.label || ident.label,
            company: ident.company,
            phone: ident.phone,
            sector: ident.sector,
            date: ident.date,
            status: status,
            savedAt: entry.savedAt || Date.now(),
            data: data,
            updatedAt: ctx.fs.serverTimestamp(),
          },
          { merge: true }
        );
        return { ok: true, id: id };
      } catch (e) {
        console.error("CRCloud.saveClient failed", e);
        return { ok: false, error: String(e && e.message ? e.message : e) };
      }
    },

    /** Pull one client doc back from Firestore. Returns report-shaped entry or null. */
    loadClient: async function (id) {
      try {
        var ctx = await fb();
        await ensureAuth(ctx);
        var snap = await ctx.fs.getDoc(ctx.fs.doc(ctx.db, "clients", id));
        if (!snap.exists()) return null;
        var v = snap.data() || {};
        return {
          id: id,
          label: v.label || "عميل",
          savedAt: v.savedAt || Date.now(),
          status: v.status || "new",
          data: v.data || {},
        };
      } catch (e) {
        console.error("CRCloud.loadClient failed", e);
        return null;
      }
    },

    /** List all clients for the board (light — no need to open the data blob). */
    listClients: async function () {
      try {
        var ctx = await fb();
        await ensureAuth(ctx);
        var snap = await ctx.fs.getDocs(ctx.fs.collection(ctx.db, "clients"));
        var out = [];
        snap.forEach(function (d) {
          var v = d.data() || {};
          var status = STATUS_KEYS.indexOf(v.status) > -1 ? v.status : "new";
          out.push({
            id: d.id,
            label: v.label || "عميل",
            company: v.company || "",
            phone: v.phone || "",
            sector: v.sector || "",
            date: v.date || "",
            status: status,
            savedAt: v.savedAt || 0,
          });
        });
        return out;
      } catch (e) {
        console.error("CRCloud.listClients failed", e);
        return null;
      }
    },

    /** Move a client to a status column (board control). */
    setStatus: async function (id, status) {
      try {
        if (STATUS_KEYS.indexOf(status) < 0) return { ok: false, error: "bad status" };
        var ctx = await fb();
        await ensureAuth(ctx);
        await ctx.fs.setDoc(
          ctx.fs.doc(ctx.db, "clients", id),
          { status: status, updatedAt: ctx.fs.serverTimestamp() },
          { merge: true }
        );
        return { ok: true };
      } catch (e) {
        console.error("CRCloud.setStatus failed", e);
        return { ok: false, error: String(e && e.message ? e.message : e) };
      }
    },

    /** Delete a client from the cloud (local copy handled by the report). */
    deleteClient: async function (id) {
      try {
        var ctx = await fb();
        await ensureAuth(ctx);
        await ctx.fs.deleteDoc(ctx.fs.doc(ctx.db, "clients", id));
        return { ok: true };
      } catch (e) {
        console.error("CRCloud.deleteClient failed", e);
        return { ok: false, error: String(e && e.message ? e.message : e) };
      }
    },

    /** One-time migration: push every locally-saved client to the cloud. */
    syncAllLocal: async function () {
      var db = cmLoad();
      var ids = Object.keys(db);
      var okCount = 0;
      for (var i = 0; i < ids.length; i++) {
        var r = await CRCloud.saveClient(ids[i], (db[ids[i]].status || "new"));
        if (r && r.ok) okCount++;
      }
      return { ok: true, synced: okCount, total: ids.length };
    },
  };

  window.CRCloud = CRCloud;

  // ================================================================
  //  Report hooks — wrap the report's own save/delete (no logic edits)
  // ================================================================
  function installHooks() {
    // Save: local first (sets currentClientId), then push to cloud.
    if (typeof window.saveCurrentClient === "function" && !window.saveCurrentClient.__crWrapped) {
      var origSave = window.saveCurrentClient;
      window.saveCurrentClient = function () {
        origSave.apply(this, arguments);
        CRCloud.saveClient(window.currentClientId).then(function (r) {
          flashBar(r && r.ok ? "☁ حُفظ في السحابة" : "⚠ تعذّر الحفظ السحابي", r && r.ok);
        });
      };
      window.saveCurrentClient.__crWrapped = true;
    }
    // Delete: report deletes local, we also delete cloud.
    if (typeof window.deleteClient === "function" && !window.deleteClient.__crWrapped) {
      var origDel = window.deleteClient;
      window.deleteClient = function (id) {
        origDel.apply(this, arguments);
        if (id) CRCloud.deleteClient(id);
      };
      window.deleteClient.__crWrapped = true;
    }
  }

  // ================================================================
  //  Injected toolbar (status + save-to-cloud + open board)
  // ================================================================
  function injectBar() {
    if (document.getElementById("cr-cloud-bar")) return;
    var bar = document.createElement("div");
    bar.id = "cr-cloud-bar";
    bar.className = "no-print";
    bar.style.cssText =
      "position:fixed;bottom:14px;left:14px;z-index:9999;background:#2E1748;color:#fff;" +
      "border-radius:12px;padding:9px 12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;" +
      "font-family:inherit;font-size:12px;box-shadow:0 8px 22px rgba(30,43,122,.28);direction:rtl";

    var opts = STATUS.map(function (s) {
      return '<option value="' + s.key + '">' + s.label + "</option>";
    }).join("");

    bar.innerHTML =
      '<span style="font-weight:700;opacity:.9">الحالة:</span>' +
      '<select id="cr-status-select" style="border:0;border-radius:8px;padding:5px 8px;font-family:inherit;' +
        'font-size:12px;font-weight:700;color:#2E1748;cursor:pointer">' + opts + "</select>" +
      '<button id="cr-save-cloud" style="background:#2B898C;color:#fff;border:0;border-radius:8px;' +
        'padding:6px 11px;font-family:inherit;font-size:12px;font-weight:800;cursor:pointer">☁ حفظ للسحابة</button>' +
      '<a href="pipeline.html" style="background:rgba(255,255,255,.16);color:#fff;text-decoration:none;' +
        'border-radius:8px;padding:6px 11px;font-weight:700">📋 لوحة الحالات</a>' +
      '<span id="cr-bar-msg" style="font-weight:700;min-width:10px"></span>';

    document.body.appendChild(bar);

    document.getElementById("cr-save-cloud").addEventListener("click", function () {
      if (typeof window.saveCurrentClient === "function") {
        window.saveCurrentClient(); // wrapped -> also pushes to cloud
      } else {
        CRCloud.saveClient(window.currentClientId).then(function (r) {
          flashBar(r && r.ok ? "☁ حُفظ" : "⚠ فشل", r && r.ok);
        });
      }
    });
  }

  function flashBar(msg, ok) {
    var el = document.getElementById("cr-bar-msg");
    if (!el) return;
    el.textContent = msg || "";
    el.style.color = ok ? "#b8f5cf" : "#ffd0d0";
    setTimeout(function () { if (el) el.textContent = ""; }, 2600);
  }

  // ================================================================
  //  Auto-load a client when opened via docs.html?client=client_XX
  // ================================================================
  async function autoLoadFromUrl() {
    try {
      var id = new URLSearchParams(window.location.search).get("client");
      if (!id) return;
      var entry = await CRCloud.loadClient(id);
      if (!entry) { flashBar("⚠ لم يُعثر على الحالة", false); return; }

      // Write into the report's own local DB, then let it restore fully.
      var db = cmLoad();
      db[id] = { id: id, label: entry.label, savedAt: entry.savedAt, data: entry.data, status: entry.status };
      cmSave(db);
      window.currentClientId = id;

      if (typeof window.loadClient === "function") {
        window.loadClient(id); // rebuilds all rows + recalculates
      }
      // reflect the loaded status in the toolbar
      var sel = document.getElementById("cr-status-select");
      if (sel && entry.status) sel.value = entry.status;

      flashBar("تم تحميل الحالة: " + entry.label, true);
    } catch (e) {
      console.error("autoLoadFromUrl failed", e);
    }
  }

  // ---- boot ----
  function boot() {
    // Only wire the report toolbar/hooks on docs.html (where the report lives).
    // On pipeline.html / dashboard.html we just expose window.CRCloud + CR_STATUS.
    var isReportPage = (typeof window.collectAllData === "function") ||
                       !!document.getElementById("c-name");
    if (!isReportPage) return;
    installHooks();
    injectBar();
    setTimeout(autoLoadFromUrl, 250);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 80); });
  } else {
    setTimeout(boot, 80);
  }
})();
