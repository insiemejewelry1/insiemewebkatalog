const firebaseConfig = {
  apiKey: "AIzaSyDqmqeEsmYvHWC_f1MNPKF72SeavICrIVg",
  authDomain: "zlatara-c0f23.firebaseapp.com",
  projectId: "zlatara-c0f23",
  storageBucket: "zlatara-c0f23.firebasestorage.app",
  messagingSenderId: "521446974460",
  appId: "1:521446974460:web:260faa3c6208ae30ca4879",
  measurementId: "G-D611CBY0ND"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

const SECRET = "ZlataraMojaSifra123";

let products = [], cart = [], selectedColors = [], globalColors = [], userRole = "guest", sessionUser = null, activeP = null, editId = null;

window.onload = () => {
    const saved = localStorage.getItem('pingvin_session_v12');
    if (saved) {
        const d = JSON.parse(saved);
        userRole = d.role; sessionUser = d.user;
        if (userRole === "admin") document.getElementById('adm-btn').style.display = "inline-block";
        startApp();
    }
};

async function doLogin() {
    const u = document.getElementById('l-u').value.trim(), p = document.getElementById('l-p').value.trim(), remember = document.getElementById('rem-check').checked;
    if (u.toLowerCase() === "admin") {
        try {
            await auth.signInWithEmailAndPassword("porudzbine.zlatarapingvin@gmail.com", p);
            userRole = "admin"; sessionUser = { name: "Admin" };
            if (remember) localStorage.setItem('pingvin_session_v12', JSON.stringify({role: userRole, user: sessionUser}));
            document.getElementById('adm-btn').style.display = "inline-block";
            return startApp();
        } catch (e) { document.getElementById('auth-err').innerText = "POGREŠNA ADMIN LOZINKA."; return; }
    }
    try {
        const snap = await db.collection('users').where('username', '==', u.toLowerCase()).where('password', '==', p).get();
        if (snap.empty) throw new Error("POGREŠNI PODACI.");
        const d = snap.docs[0].data(); if (d.status !== "approved") throw new Error("NALOG ČEKA ODOBRENJE.");
        userRole = "user"; sessionUser = { name: d.fullName, phone: d.phone };
        if (remember) localStorage.setItem('pingvin_session_v12', JSON.stringify({role: userRole, user: sessionUser}));
        startApp();
    } catch(e) { document.getElementById('auth-err').innerText = e.message; }
}

async function doReg() {
    const n = document.getElementById('r-n').value, ph = document.getElementById('r-ph').value, u = document.getElementById('r-u').value.toLowerCase(), p = document.getElementById('r-p').value;
    if(!n || !ph || !u || !p) return alert("POPUNITE POLJA.");
    await db.collection('users').add({ fullName: n, phone: ph, username: u, password: p, status: "pending", timestamp: Date.now(), tajniKljuc: SECRET });
    alert("ZAHTEV POSLAT!"); swAuth(false);
}

function startApp() {
    document.querySelectorAll('section').forEach(s => s.style.display = 'none');
    document.getElementById('scr-cat').style.display = 'block';
    document.getElementById('app-nav').style.display = 'block';
    sync();
}

function sync() {
    db.collection('products').onSnapshot(s => {
        products = s.docs.map(d => ({ fs_id: d.id, ...d.data() }));
        drawGrid();
        if (userRole === "admin") { drawAdminList(); extractColors(); }
    });
    db.collection('announcements').orderBy('timestamp','desc').limit(1).onSnapshot(s => {
        if (!s.empty) { document.getElementById('ann-bar').style.display='block'; document.getElementById('ann-bar').innerText=s.docs[0].data().body; }
    });
    if (userRole === "admin") loadReqs();
}

function extractColors() {
    let set = new Set();
    products.forEach(p => { if(p.availableColors) p.availableColors.forEach(c => set.add(c)); });
    globalColors = Array.from(set).sort();
    renderColorChips();
}

function renderColorChips() {
    const ui = document.getElementById('color-chips-ui');
    if(!ui) return;
    ui.innerHTML = globalColors.map(c => `<span class="chip ${selectedColors.includes(c) ? 'active' : ''}" onclick="toggleColor('${c}')">${c}</span>`).join('');
}

function toggleColor(c) {
    if(selectedColors.includes(c)) selectedColors = selectedColors.filter(x => x !== c);
    else selectedColors.push(c);
    renderColorChips();
}

function addNewColor() {
    const v = document.getElementById('new-color-text').value.trim().toUpperCase();
    if(!v) return;
    if(!selectedColors.includes(v)) selectedColors.push(v);
    if(!globalColors.includes(v)) globalColors.push(v);
    renderColorChips();
    document.getElementById('new-color-text').value = "";
}

function drawGrid() {
    const grid = document.getElementById('grid-ui'), coll = document.getElementById('f-coll').value, cat = document.getElementById('f-cat').value;
    if (!coll) { grid.innerHTML = `<div class="empty-view"><h2>ODABERITE KOLEKCIJU</h2></div>`; return; }
    let list = products.filter(p => p.collection === coll && (!cat || p.category === cat));
    list.sort((a,b) => a.id.toString().localeCompare(b.id.toString()));
    grid.innerHTML = list.map(p => `
        <div class="p-card" onclick="openDet('${p.fs_id}')">
            <img src="${p.image || ''}">
            <div class="p-info"><h3>${p.id}</h3><p>${Number(p.price).toLocaleString()} DIN</p></div>
        </div>`).join('');
}

function openDet(id) {
    const p = products.find(x => x.fs_id === id); activeP = p;
    const pdf = p.colorChart ? `<button onclick="viewPdf('${p.colorChart}')" class="btn-minimal" style="width:auto; padding:10px 20px; background:#f0f0f0; color:#000; margin-top:20px;">KATALOG BOJA</button>` : "";
    const cols = p.availableColors?.length ? `<div style="margin:30px 0;"><p style="font-size:0.65rem; font-weight:700; margin-bottom:10px; letter-spacing:1px;">BOJA</p><select id="p-sel-c" class="minimal-select" style="width:100%;">${p.availableColors.map(c=>`<option value="${c}">${c}</option>`).join('')}</select></div>` : "";
    document.getElementById('det-body').innerHTML = `
        <img src="${p.image || ''}" class="detail-image" onclick="zoomIn('${p.image}')">
        <h1 class="detail-title">${p.id}</h1>
        <p class="detail-price">${Number(p.price).toLocaleString()} DIN</p>
        ${cols} ${pdf}
        <p style="margin-top:40px; font-size:0.85rem; color:#444;">${p.description || ""}</p>
        <button onclick="addCart()" class="btn-add-cart">DODAJ U KORPU</button>
    `;
    navigateTo('det');
    window.scrollTo(0,0);
}

function zoomIn(src) { document.getElementById('zoom-target').src = src; document.getElementById('zoom-overlay').style.display = 'flex'; }
function addCart() { const c = document.getElementById('p-sel-c') ? document.getElementById('p-sel-c').value : "Standard"; cart.push({...activeP, selC: c}); document.getElementById('cart-num').innerText = cart.length; alert("DODATO."); }

async function saveProduct() {
    const id=document.getElementById('a-id').value, pr=document.getElementById('a-pr').value, img=document.getElementById('a-img').files[0], pdf=document.getElementById('a-pdf').files[0];
    if(!id || !pr) return alert("UNESITE ŠIFRU I CENU.");
    let obj = { id, price: parseFloat(pr), description: document.getElementById('a-ds').value, category: document.getElementById('a-ct').value, collection: document.getElementById('a-cl').value, availableColors: selectedColors, tajniKljuc: SECRET };
    if(img) obj.image = await toB64(img);
    if(pdf) { const b = new Uint8Array(await pdf.arrayBuffer()), c = pako.gzip(b); obj.colorChart = "data:application/pdf;base64," + btoa(String.fromCharCode(...c)); }
    if(editId) await db.collection('products').doc(editId).update(obj);
    else await db.collection('products').add(obj);
    alert("SAČUVANO."); resetAdminForm();
}

function drawAdminList() {
    document.getElementById('admin-list-ui').innerHTML = products.map(p => `
        <div class="admin-list-item">
            <div style="display:flex; align-items:center;"><img src="${p.image || ''}" style="width:40px; height:40px; object-fit:cover; margin-right:15px;"><span>${p.id}</span></div>
            <div>
                <button onclick="startEdit('${p.fs_id}')" style="background:none; border:none; color:blue; font-weight:700; cursor:pointer; font-size:0.7rem;">IZMENI</button>
                <button onclick="delP('${p.fs_id}')" style="background:none; border:none; color:red; font-weight:700; cursor:pointer; margin-left:10px; font-size:0.7rem;">OBRIŠI</button>
            </div>
        </div>`).join('');
}

function startEdit(id) {
    const p = products.find(x => x.fs_id === id); editId = id;
    document.getElementById('a-id').value = p.id; document.getElementById('a-pr').value = p.price; document.getElementById('a-ds').value = p.description;
    document.getElementById('a-ct').value = p.category; document.getElementById('a-cl').value = p.collection;
    selectedColors = p.availableColors || []; renderColorChips();
    document.getElementById('form-title').innerText = "IZMENA MODELA";
    document.getElementById('btn-sv').innerText = "SAČUVAJ IZMENE";
    document.getElementById('btn-can').style.display = "block";
    window.scrollTo(0,0);
}

function resetAdminForm() {
    editId = null; selectedColors = [];
    document.getElementById('a-id').value = ""; document.getElementById('a-pr').value = ""; document.getElementById('a-ds').value = "";
    document.getElementById('form-title').innerText = "NOVI MODEL";
    document.getElementById('btn-sv').innerText = "SAČUVAJ PROIZVOD";
    document.getElementById('btn-can').style.display = "none";
    renderColorChips();
}

async function delP(id) { 
    if(confirm("OBRISATI?")) {
        await db.collection('products').doc(id).update({ tajniKljuc: SECRET });
        await db.collection('products').doc(id).delete();
    }
}

function loadReqs() {
    db.collection('users').where('status','==','pending').onSnapshot(s => {
        document.getElementById('req-list-ui').innerHTML = s.docs.map(doc => `
            <div style="padding:15px; border:1px solid #eee; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size:0.8rem;"><strong>${doc.data().fullName}</strong><br><small>${doc.data().phone}</small></div>
                <button onclick="updU('${doc.id}','approved')" class="btn-small-black" style="padding:10px 15px;">ODOBRI</button>
            </div>`).join('');
    });
}

async function updU(id, s) { await db.collection('users').doc(id).update({ status: s, tajniKljuc: SECRET }); }

async function setAnn() { 
    const b = document.getElementById('an-b').value;
    const snap = await db.collection('announcements').get();
    snap.forEach(d => d.ref.delete());
    if(b) await db.collection('announcements').add({ body: b, timestamp: Date.now(), tajniKljuc: SECRET });
    alert("OBJAVLJENO.");
}

function navigateTo(id) { document.querySelectorAll('section').forEach(s => s.style.display = 'none'); document.getElementById('scr-'+id).style.display = 'block'; }
function doLogout() { localStorage.removeItem('pingvin_session_v12'); location.reload(); }
function handleHideM(id) { document.getElementById(id).style.display = 'none'; }
function swAuth(is) { document.getElementById('box-login').style.display = is ? 'none' : 'block'; document.getElementById('box-reg').style.display = is ? 'block' : 'none'; }
function switchTab(t) {
    document.getElementById('area-p').style.display = t==='p'?'block':'none';
    document.getElementById('area-u').style.display = t==='u'?'block':'none';
    document.getElementById('area-a').style.display = t==='a'?'block':'none';
    document.querySelectorAll('.admin-tabs span').forEach(s => s.classList.toggle('active', s.id==='tab-'+t));
}
function toB64(f) { return new Promise((res) => { const r = new FileReader(); r.readAsDataURL(f); r.onload = () => res(r.result); }); }
function viewPdf(d) {
    const b64 = d.split('base64,')[1], bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    try {
        const u = pako.ungzip(bytes);
        window.open(URL.createObjectURL(new Blob([u], {type:'application/pdf'})));
    } catch(e) {
        window.open(URL.createObjectURL(new Blob([bytes], {type:'application/pdf'})));
    }
}
