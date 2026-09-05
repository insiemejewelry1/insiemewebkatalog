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
    const saved = localStorage.getItem('pingvin_session_v14');
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
            if (remember) localStorage.setItem('pingvin_session_v14', JSON.stringify({role: userRole, user: sessionUser}));
            document.getElementById('adm-btn').style.display = "inline-block";
            return startApp();
        } catch (e) { document.getElementById('auth-err').innerText = "POGREŠNA LOZINKA."; return; }
    }
    try {
        const snap = await db.collection('users').where('username', '==', u.toLowerCase()).where('password', '==', p).get();
        if (snap.empty) throw new Error("POGREŠNI PODACI.");
        const d = snap.docs[0].data(); if (d.status !== "approved") throw new Error("ČEKA SE ODOBRENJE.");
        userRole = "user"; sessionUser = { name: d.fullName, phone: d.phone };
        if (remember) localStorage.setItem('pingvin_session_v14', JSON.stringify({role: userRole, user: sessionUser}));
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
        else document.getElementById('ann-bar').style.display='none';
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
    ui.innerHTML = globalColors.map(c => `<span class="chip ${selectedColors.includes(c) ? 'active' : ''}" onclick="toggleColor('${c}')">${c} ×</span>`).join('');
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
    if (!coll) { grid.innerHTML = `<div style="text-align:center; padding:100px 0; color:#CCC;">ODABERITE KOLEKCIJU</div>`; return; }
    let list = products.filter(p => p.collection === coll && (!cat || p.category === cat));
    list.sort((a,b) => a.id.toString().localeCompare(b.id.toString()));
    grid.innerHTML = list.map(p => `
        <div class="p-card" onclick="openDet('${p.fs_id}')">
            <img src="${p.image}">
            <div class="p-info"><h3>${p.id}</h3><p style="color:#C63D13;"><strong>${Number(p.price).toLocaleString()} DIN</strong></p></div>
        </div>`).join('');
}

function openDet(id) {
    const p = products.find(x => x.fs_id === id); activeP = p;
    const pdf = p.colorChart ? `<button onclick="viewPdf('${p.colorChart}')" class="btn-minimal" style="width:auto; padding:10px 20px; background:#f5f5f5; color:#000; margin-top:20px; border-radius:10px;">🎨 KATALOG BOJA</button>` : "";
    const cols = p.availableColors?.length ? `<div style="margin:30px 0; text-align:left;"><p style="font-size:0.7rem; font-weight:800; margin-bottom:10px; letter-spacing:1px;">ODABERITE BOJU</p><select id="p-sel-c" class="minimal-select" style="width:100%;">${p.availableColors.map(c=>`<option value="${c}">${c}</option>`).join('')}</select></div>` : "";
    
    document.getElementById('det-body').innerHTML = `
        <img src="${p.image}" class="detail-image" onclick="zoomIn('${p.image}')">
        <h1 class="detail-title">${p.id}</h1>
        <p class="detail-price">${Number(p.price).toLocaleString()} DIN</p>
        <div style="max-width:320px; margin:auto;">
            ${cols} ${pdf}
        </div>
        <p style="margin-top:40px; font-size:0.9rem; color:#555; padding:0 20px;">${p.description || "Nema dodatnog opisa."}</p>
        <button onclick="addCart()" class="btn-add-cart-fixed">DODAJ U KORPU</button>
    `;
    navigateTo('det');
    window.scrollTo(0,0);
}

function zoomIn(src) { document.getElementById('zoom-target').src = src; document.getElementById('zoom-overlay').style.display = 'flex'; }

function addCart() {
    const c = document.getElementById('p-sel-c') ? document.getElementById('p-sel-c').value : "Standard";
    cart.push({...activeP, selC: c});
    document.getElementById('cart-num').innerText = cart.length;
    alert("DODATO.");
}

function handleOpenCart() {
    let tot = 0;
    document.getElementById('c-list').innerHTML = cart.map((i, idx) => {
        tot += i.price;
        return `<div class="cart-item">
            <img src="${i.image}">
            <div style="flex:1;"><strong>${i.id}</strong><br><small>Boja: ${i.selC}</small></div>
            <div>${i.price.toLocaleString()} din <span onclick="remC(${idx})" style="color:red; font-weight:800; cursor:pointer; margin-left:15px; font-size:1.5rem;">×</span></div>
        </div>`;
    }).join('');
    document.getElementById('c-tot').innerText = tot.toLocaleString();
    document.getElementById('m-cart').style.display = 'flex';
}

function remC(i) { cart.splice(i,1); handleOpenCart(); document.getElementById('cart-num').innerText = cart.length; }

function goToOrder() { if(cart.length===0) return; handleHideM('m-cart'); navigateTo('ord'); }

async function finishOrder() {
    const n=document.getElementById('on').value, ph=document.getElementById('op').value, ad=document.getElementById('oa').value;
    if(!n || !ph || !ad) return alert("POPUNITE POLJA.");
    const items = cart.map(i => `- ${i.id} (${i.selC})`).join('\n'), tot = document.getElementById('c-tot').innerText + " DIN";
    const body = encodeURIComponent(`NARUDŽBINA:\nIme: ${n}\nTel: ${ph}\nAdresa: ${ad}\n\nPROIZVODI:\n${items}\n\nUKUPNO: ${tot}`);
    window.location.href = `mailto:porudzbine.zlatarapingvin@gmail.com?subject=Nova Porudžbina&body=${body}`;
    cart = []; document.getElementById('cart-num').innerText = "0"; navigateTo('cat');
}

// ADMIN PREVIEW
function previewImage(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('img-preview-box').innerHTML = `<img src="${e.target.result}">`;
            document.getElementById('img-label').innerText = "Slika spremna";
        };
        reader.readAsDataURL(input.files[0]);
    }
}
function previewPdfName(input) { if(input.files && input.files[0]) document.getElementById('pdf-label').innerText = input.files[0].name; }

async function saveProduct() {
    const id=document.getElementById('a-id').value, pr=document.getElementById('a-pr').value, img=document.getElementById('a-img').files[0], pdf=document.getElementById('a-pdf').files[0];
    if(!id || !pr) return alert("OBAVEZNA POLJA!");
    const btn = document.getElementById('btn-sv'); btn.disabled = true;
    let obj = { id, price: parseFloat(pr), description: document.getElementById('a-ds').value, category: document.getElementById('a-ct').value, collection: document.getElementById('a-cl').value, availableColors: selectedColors, tajniKljuc: SECRET };
    if(img) obj.image = await toB64(img);
    if(pdf) { const b = new Uint8Array(await pdf.arrayBuffer()), c = pako.gzip(b); obj.colorChart = "data:application/pdf;base64," + btoa(String.fromCharCode(...c)); }
    if(editId) await db.collection('products').doc(editId).update(obj);
    else await db.collection('products').add(obj);
    alert("SAČUVANO."); resetAdminForm(); btn.disabled = false;
}

function drawAdminList() {
    document.getElementById('admin-list-ui').innerHTML = products.map(p => `
        <div class="admin-list-item">
            <div style="display:flex; align-items:center;"><img src="${p.image}"><div><strong>${p.id}</strong><br><small>${p.price} din</small></div></div>
            <div>
                <span class="icon-action" style="color:blue;" onclick="startEdit('${p.fs_id}')">✎</span>
                <span class="icon-action" style="color:red;" onclick="delP('${p.fs_id}')">🗑</span>
            </div>
        </div>`).join('');
}

function startEdit(id) {
    const p = products.find(x => x.fs_id === id); editId = id;
    document.getElementById('a-id').value = p.id; document.getElementById('a-pr').value = p.price; document.getElementById('a-ds').value = p.description;
    document.getElementById('a-ct').value = p.category; document.getElementById('a-cl').value = p.collection;
    selectedColors = p.availableColors || []; renderColorChips();
    document.getElementById('img-preview-box').innerHTML = `<img src="${p.image}">`;
    document.getElementById('btn-sv').innerText = "SAČUVAJ IZMENE";
    document.getElementById('btn-can').style.display = "block";
    window.scrollTo(0,0);
}

function resetAdminForm() {
    editId = null; selectedColors = [];
    document.getElementById('a-id').value = ""; document.getElementById('a-pr').value = ""; document.getElementById('a-ds').value = "";
    document.getElementById('img-preview-box').innerHTML = "🖼";
    document.getElementById('btn-sv').innerText = "Sačuvajte Proizvod";
    document.getElementById('btn-can').style.display = "none";
    renderColorChips();
}

async function delP(id) { if(confirm("OBRISATI?")) { await db.collection('products').doc(id).update({tajniKljuc:SECRET}); await db.collection('products').doc(id).delete(); } }

function loadReqs() {
    db.collection('users').where('status','==','pending').onSnapshot(s => {
        document.getElementById('req-count').innerText = s.size;
        document.getElementById('req-list-ui').innerHTML = s.size === 0 ? '<p style="color:#999;">Nema novih zahteva.</p>' : s.docs.map(doc => `
            <div style="padding:15px; border:1px solid #eee; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; border-radius:15px;">
                <div><strong>${doc.data().fullName}</strong><br><small>${doc.data().phone}</small></div>
                <div>
                    <button onclick="updU('${doc.id}','approved')" class="btn-minimal" style="padding:10px 15px; width:auto; background:green;">ODOBRI</button>
                    <button onclick="delU('${doc.id}')" class="btn-minimal" style="padding:10px 15px; width:auto; background:red; margin-left:5px;">OBRIŠI</button>
                </div>
            </div>`).join('');
    });
}

async function updU(id, s) { await db.collection('users').doc(id).update({ status: s, tajniKljuc: SECRET }); }
async function delU(id) { if(confirm("OBRISATI ZAHTEV?")) { await db.collection('users').doc(id).update({ tajniKljuc: SECRET }); await db.collection('users').doc(id).delete(); } }
async function handleClearAnn() { const snap = await db.collection('announcements').get(); snap.forEach(d => d.ref.delete()); }

async function setAnn() { 
    const b = document.getElementById('an-b').value;
    const snap = await db.collection('announcements').get();
    snap.forEach(d => d.ref.delete());
    if(b) await db.collection('announcements').add({ body: b, timestamp: Date.now(), tajniKljuc: SECRET });
    alert("OBJAVLJENO.");
}

function navigateTo(id) { document.querySelectorAll('section').forEach(s => s.style.display = 'none'); document.getElementById('scr-'+id).style.display = 'block'; }
function doLogout() { localStorage.removeItem('pingvin_session_v14'); location.reload(); }
function handleHideM(id) { document.getElementById(id).style.display = 'none'; }
function zoomIn(src) { document.getElementById('zoom-target').src = src; document.getElementById('zoom-overlay').style.display = 'flex'; }
function swAuth(is) { document.getElementById('box-login').style.display = is ? 'none' : 'block'; document.getElementById('box-reg').style.display = is ? 'block' : 'none'; }
function toB64(f) { return new Promise((res) => { const r = new FileReader(); r.readAsDataURL(f); r.onload = () => res(r.result); }); }
