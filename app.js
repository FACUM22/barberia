// === Datos de tu barbería: editá acá ===
const SITE={name:'Tu Barbería',since:2019,barbers:3,hero:'',instagram:'https://instagram.com/',
 hours:['Lun - Vie: 10:00-20:00','Sábado: 10:00-17:00','Domingo: cerrado'],phones:['099 000 000'],
 places:['Tu dirección 1234, Montevideo'],promo:'Lunes y miércoles 15% off en servicio VIP.'};
const pic=(o,d)=>o.img?`<img src="${esc(o.img)}" alt="${esc(o.name)}" loading="lazy" onerror="this.remove()">`:`<div class="em">${esc(o.emoji||d)}</div>`;
const HOURS=[10,11,12,13,14,15,16,17,18,19], FEE=0.5, LIMIT_H=2, CUR='$U';
const S={tab:'inicio',cuts:[],products:[],blocked:{},slots:{},orders:[],cart:{},me:null,profile:null,admin:false,db:null,sel:{cut:'',date:'',hour:null},adate:'',note:''};
const $=s=>document.querySelector(s), esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>CUR+' '+Number(n||0).toLocaleString('es-UY');
const pad=n=>String(n).padStart(2,'0'), today=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
const key=(d,h)=>d+'_'+pad(h), when=(d,h)=>new Date(d+'T'+pad(h)+':00:00');
const active=k=>S.slots[k]&&S.slots[k].status==='active';
const slotList=()=>Object.entries(S.slots).map(([id,v])=>({id,...v}));

function sub(col,fn){try{S.db.collection(col).onSnapshot(s=>fn(s.docs.map(d=>({id:d.id,...d.data()}))),()=>{})}catch(e){}}
async function init(){
  try{
    const [db,user]=await Promise.all([claude.use('db'),claude.use('user')]);
    S.db=db;
    if(user){S.admin=await user.isOwner()||await user.canEdit();S.me=await user.id();}
    if(db){
      sub('cuts',a=>{S.cuts=a;render()});sub('products',a=>{S.products=a;render()});
      sub('blocked',a=>{S.blocked=Object.fromEntries(a.map(x=>[x.id,x]));render()});
      sub('slots',a=>{S.slots=Object.fromEntries(a.map(x=>[x.id,x]));render()});
      if(S.admin)sub('orders',a=>{S.orders=a.flatMap(x=>x.list||[]).sort((x,y)=>(y.ts||0)-(x.ts||0));render()});
      if(S.me){const p=await db.doc('data/users/'+S.me+'/profile').get();S.profile=p.exists?p.data():null;}
    }
  }catch(e){}
  render();
}
function renderNav(){
  const t=[['inicio','Inicio'],['cortes','Servicios'],['agenda','Agendar'],['tienda','Tienda'+(Object.keys(S.cart).length?' ('+Object.values(S.cart).reduce((a,b)=>a+b,0)+')':'')],['cuenta','Mi cuenta']];
  if(S.admin)t.push(['admin','Panel admin']);
  $('#nav').innerHTML=t.map(([k,l])=>`<button class="${S.tab===k?'on':''}" data-act="tab" data-k="${k}">${l}</button>`).join('');
}
function needLogin(){return S.me?'':'<div class="card"><b>Ingresá o registrate</b><label>Email</label><input id="ae" type="email"><label>Contraseña (mín. 6)</label><input id="ap" type="password"><label>Código de barbero (solo si sos el barbero)</label><input id="ac"><br><br><button class="p" data-act="login">Ingresar</button> <button class="s" data-act="register">Registrarme</button></div>'}
function vCortes(){
  if(!S.cuts.length)return '<div class="msg">Todavía no hay cortes cargados. '+(S.admin?'Agregalos desde el Panel admin.':'Volvé pronto.')+'</div>';
  return '<div class="grid">'+S.cuts.map(c=>`<div class="card">${pic(c,'💈')}<b>${esc(c.name)}</b><div class="mu">${esc(c.desc||'')}</div><div class="pr">${money(c.price)}</div><button class="p" data-act="pick" data-id="${c.id}">Agendar</button></div>`).join('')+'</div>';
}
function vAgenda(){
  if(!S.cuts.length)return '<div class="msg">Aún no hay servicios disponibles.</div>';
  const s=S.sel,d=s.date,cut=S.cuts.find(c=>c.id===s.cut);let h='';
  if(!S.profile)h+='<div class="msg">Completá tu registro en «Mi cuenta» (nombre y celular) antes de reservar.</div>';
  h+=needLogin()+`<div class="card"><label>Corte</label><select data-act="cut"><option value="">Elegí…</option>${S.cuts.map(c=>`<option value="${c.id}" ${c.id===s.cut?'selected':''}>${esc(c.name)} — ${money(c.price)}</option>`).join('')}</select><label>Día</label><input type="date" min="${today()}" value="${d}" data-act="date">`;
  if(d&&S.blocked[d])h+=`<div class="msg er">El barbero no trabaja ese día${S.blocked[d].reason?': '+esc(S.blocked[d].reason):''}.</div>`;
  else if(d){h+='<div class="hrs">'+HOURS.map(x=>{const dis=active(key(d,x))||when(d,x)<new Date();return `<button class="${s.hour===x?'sel':''}" ${dis?'disabled':''} data-act="hour" data-h="${x}">${pad(x)}:00</button>`}).join('')+'</div>';}
  h+='</div>';
  if(cut&&d&&s.hour!=null&&!S.blocked[d])h+=`<div class="card"><b>${esc(cut.name)}</b> · ${d} ${pad(s.hour)}:00<br><span class="pr">${money(cut.price)}</span><p class="mu">Política: si cancelás con menos de ${LIMIT_H} h de anticipación, se cobra el ${FEE*100}% (${money(cut.price*FEE)}) y no se devuelve. Antes de ese plazo, reembolso total.</p><button class="p" data-act="book" ${S.profile&&S.me?'':'disabled'}>Pagar y reservar</button></div>`;
  return h+(S.note?`<div class="msg">${esc(S.note)}</div>`:'');
}
function vTienda(){
  let h=needLogin();
  if(!S.products.length)return h+'<div class="msg">La tienda está vacía por ahora.</div>';
  h+='<div class="grid">'+S.products.map(p=>`<div class="card">${pic(p,'🧴')}<b>${esc(p.name)}</b><div class="pr">${money(p.price)}</div><div class="mu">${p.stock>0?'Stock: '+p.stock:'Agotado'}</div><button class="p" ${p.stock>0?'':'disabled'} data-act="add" data-id="${p.id}">Agregar</button></div>`).join('')+'</div>';
  const items=Object.entries(S.cart).map(([id,q])=>({p:S.products.find(x=>x.id===id),q})).filter(x=>x.p);
  if(items.length){const tot=items.reduce((a,x)=>a+x.p.price*x.q,0);
    h+=`<h2>Carrito</h2><div class="card">${items.map(x=>`<div class="row"><span>${esc(x.p.name)} × ${x.q}</span><span>${money(x.p.price*x.q)} <button class="s" data-act="rm" data-id="${x.p.id}">Quitar</button></span></div>`).join('')}<div class="row"><b>Total</b><b class="pr">${money(tot)}</b></div><button class="p" data-act="buy" ${S.profile&&S.me?'':'disabled'}>Pagar y reservar para retirar</button>${S.profile?'':'<p class="mu">Registrate en «Mi cuenta» para comprar.</p>'}</div>`;}
  return h+(S.note?`<div class="msg">${esc(S.note)}</div>`:'');
}
function policy(sl){const late=when(sl.date,sl.hour)-new Date()<LIMIT_H*3600e3;return late?{fee:Math.round(sl.price*FEE),late}:{fee:0,late}}
function vCuenta(){
  let h=needLogin()+(S.me?'<p><button class="s" data-act="logout">Cerrar sesión</button></p>':'');const p=S.profile||{};
  h+=`<div class="card"><h2 style="margin-top:0">${S.profile?'Mi registro':'Registrate'}</h2><label>Nombre</label><input id="pn" value="${esc(p.name)}"><label>Celular</label><input id="pp" value="${esc(p.phone)}" inputmode="tel"><br><br><button class="p" data-act="saveprof" ${S.me?'':'disabled'}>Guardar</button></div>`;
  const mine=slotList().filter(x=>x.uid===S.me&&S.me).sort((a,b)=>(a.id<b.id?1:-1));
  h+='<h2>Mis turnos</h2>'+(mine.length?'<div class="card">'+mine.map(x=>{const f=policy(x),up=x.status==='active'&&when(x.date,x.hour)>new Date();return `<div class="row"><span>${x.date} ${pad(x.hour)}:00 · ${esc(x.cutName)}<br><span class="tag">${x.status==='active'?'Confirmado':'Cancelado — cargo '+money(x.fee||0)}</span></span>${up?`<button class="d" data-act="cancel" data-id="${x.id}">Cancelar${f.late?' (cargo '+money(f.fee)+')':''}</button>`:''}</div>`}).join('')+'</div>':'<p class="mu">Sin turnos todavía.</p>');
  return h+(S.note?`<div class="msg">${esc(S.note)}</div>`:'');
}
function vAdmin(){
  const ad=S.adate||today();
  const day=slotList().filter(x=>x.date===ad&&x.status==='active').sort((a,b)=>a.hour-b.hour);
  const bl=Object.values(S.blocked).sort((a,b)=>a.id<b.id?-1:1);
  let h=`<h2>Agenda</h2><div class="card"><input type="date" value="${ad}" data-act="adate">${day.length?day.map(x=>`<div class="row"><span><b>${pad(x.hour)}:00</b> · ${esc(x.name)} · ${esc(x.phone)}<br><span class="mu">${esc(x.cutName)} · ${money(x.price)}</span></span><button class="d" data-act="acancel" data-id="${x.id}">Anular</button></div>`).join(''):'<p class="mu">Sin turnos este día.</p>'}${S.blocked[ad]?'<p class="er">Día bloqueado.</p>':''}</div>`;
  h+=`<h2>Días no laborables</h2><div class="card"><div class="f"><div><label>Fecha</label><input type="date" id="bd" min="${today()}"></div><div><label>Motivo</label><input id="br"></div><button class="p" data-act="block">Bloquear</button></div>${bl.map(b=>`<div class="row"><span>${b.id} <span class="mu">${esc(b.reason||'')}</span></span><button class="s" data-act="unblock" data-id="${b.id}">Habilitar</button></div>`).join('')}</div>`;
  h+=`<h2>Cortes</h2><div class="card"><div class="f"><input id="cn" placeholder="Nombre"><input id="ce" placeholder="Emoji" size="3"><input id="cd" placeholder="Descripción"><input id="cimg" placeholder="URL de foto (opcional)"><input id="cp" type="number" placeholder="Precio" style="width:100px"><button class="p" data-act="addcut">Agregar</button></div>${S.cuts.map(c=>`<div class="row"><span>${esc(c.emoji||'')} ${esc(c.name)} · ${money(c.price)}</span><button class="d" data-act="delcut" data-id="${c.id}">Borrar</button></div>`).join('')}</div>`;
  h+=`<h2>Productos</h2><div class="card"><div class="f"><input id="pnm" placeholder="Nombre"><input id="pem" placeholder="Emoji" size="3"><input id="pimg" placeholder="URL de foto (opcional)"><input id="ppr" type="number" placeholder="Precio" style="width:100px"><input id="pst" type="number" placeholder="Stock" style="width:80px"><button class="p" data-act="addprod">Agregar</button></div>${S.products.map(p=>`<div class="row"><span>${esc(p.emoji||'')} ${esc(p.name)} · ${money(p.price)} · stock ${p.stock}</span><button class="d" data-act="delprod" data-id="${p.id}">Borrar</button></div>`).join('')}</div>`;
  h+=`<h2>Pedidos de la tienda</h2><div class="card">${S.orders.length?S.orders.map(o=>`<div class="row"><span>${esc(o.name)} · ${esc(o.phone)}<br><span class="mu">${esc(o.items)}</span></span><b>${money(o.total)}</b></div>`).join(''):'<p class="mu">Sin pedidos.</p>'}</div>`;
  h+=`<p class="mu">Para sumar otro barbero, compartí esta página con permiso de edición desde el botón Compartir.</p>`;
  return h;
}
function vInicio(){
  const yrs=new Date().getFullYear()-SITE.since;
  const svc=S.cuts.slice(0,6).map(c=>`<div class="card">${pic(c,'💈')}<b>${esc(c.name)}</b><div class="mu">${esc(c.desc||'')}</div><div class="pr">${money(c.price)}</div></div>`).join('')||'<p class="mu">Pronto vas a ver acá nuestros servicios.</p>';
  return `<section class="hero" ${SITE.hero?`style="--hero:url('${esc(SITE.hero)}')"`:''}><small>Desde ${SITE.since}</small><h1>Viví la experiencia ${esc(SITE.name)}</h1><p>Tradición y estilo moderno. Reservá tu turno online en menos de un minuto.</p><button class="p" data-act="tab" data-k="agenda">Reservar cita</button></section>
  <section class="sec two"><div><small>Sobre nosotros</small><h2>Cuidamos de vos</h2><p class="mu">Más que un lugar para cortarte el pelo: un espacio pensado en vos. Acá los detalles cuentan y el estilo se define.</p></div><div class="stats"><div><b>${yrs}+</b><span class="mu">Años de trayectoria</span></div><div><b>${S.cuts.length}</b><span class="mu">Servicios</span></div><div><b>${SITE.barbers}</b><span class="mu">Barberos</span></div></div></section>
  <section class="sec"><small>Nuestros servicios</small><h2>Descubrí lo que tenemos para vos</h2><div class="grid">${svc}</div><p><button class="s" data-act="tab" data-k="cortes">Ver todos</button></p></section>
  ${SITE.promo?`<div class="msg">${esc(SITE.promo)}</div>`:''}
  <section class="sec" style="text-align:center"><h2>Tu mejor versión está a un clic</h2><button class="p" data-act="tab" data-k="agenda">Reservar cita</button></section>`;
}
function chrome(){
  $('#top').innerHTML=[...SITE.phones,...SITE.hours].map(x=>`<span>${esc(x)}</span>`).join('')+`<a href="${esc(SITE.instagram)}" style="color:var(--ac)">Instagram</a>`;
  $('#brand').textContent=SITE.name;
  $('#ft').innerHTML=`<b>${esc(SITE.name)}</b><br>${SITE.places.map(esc).join('<br>')}<br>${SITE.phones.map(esc).join(' · ')}`;
}
function render(){
  chrome();
  renderNav();
  const a=document.activeElement;if(a&&(a.tagName==='INPUT')&&a.id&&S.tab!=='agenda')return;
  $('#app').innerHTML=({inicio:vInicio,cortes:vCortes,agenda:vAgenda,tienda:vTienda,cuenta:vCuenta,admin:vAdmin}[S.tab]||vCortes)();
}
const val=id=>($('#'+id)||{}).value||'';
const say=m=>{S.note=m;render()};
async function act(el){
  const a=el.dataset.act,id=el.dataset.id,db=S.db;
  if(a==='tab'){S.tab=el.dataset.k;S.note='';return render()}
  if(a==='pick'){S.sel.cut=id;S.tab='agenda';return render()}
  if(a==='hour'){S.sel.hour=+el.dataset.h;return render()}
  if(a==='add'){S.cart[id]=(S.cart[id]||0)+1;return render()}
  if(a==='rm'){delete S.cart[id];return render()}
  if(!db)return;
  try{
  if(a==='saveprof'){const n=val('pn').trim(),p=val('pp').trim();if(!n||!p)return say('Completá nombre y celular.');S.profile={name:n,phone:p};await db.doc('data/users/'+S.me+'/profile').set(S.profile);say('Registro guardado.')}
  if(a==='book'){const {cut:ci,date:d,hour:h}=S.sel,c=S.cuts.find(x=>x.id===ci),k=key(d,h);
    const cur=await db.doc('slots/'+k).get();
    if(S.blocked[d]||(cur.exists&&cur.data().status==='active'))return say('Ese horario ya no está disponible.');
    await db.doc('slots/'+k).set({date:d,hour:h,uid:S.me,name:S.profile.name,phone:S.profile.phone,cutName:c.name,price:c.price,paid:true,status:'active'});
    S.sel.hour=null;say('Turno reservado y pago registrado (simulado). ¡Te esperamos!')}
  if(a==='cancel'||a==='acancel'){const sl=S.slots[id];if(!sl)return;const adminCancel=a==='acancel',f=adminCancel?{fee:0,late:false}:policy(sl);
    if(!confirm(f.late?'Faltan menos de '+LIMIT_H+' h: se cobrará '+money(f.fee)+' y no se reembolsa. ¿Cancelar igual?':'¿Cancelar el turno? Se reembolsa el total.'))return;
    await db.doc('slots/'+id).update({status:'cancelled',fee:f.fee,refund:sl.price-f.fee});say(adminCancel?'Turno anulado.':'Turno cancelado. Reembolso: '+money(sl.price-f.fee))}
  if(a==='buy'){const items=Object.entries(S.cart).map(([i,q])=>({p:S.products.find(x=>x.id===i),q})).filter(x=>x.p);
    const ref=db.doc('orders/'+S.me),cur=await ref.get(),list=(cur.exists&&cur.data().list)||[];list.push({name:S.profile.name,phone:S.profile.phone,ts:Date.now(),total:items.reduce((s,x)=>s+x.p.price*x.q,0),items:items.map(x=>x.q+'× '+x.p.name).join(', ')});await ref.set({list});
    S.cart={};say('Pedido registrado (pago simulado). Retiralo en el local.')}
  if(a==='block'){const d=val('bd');if(!d)return;await db.doc('blocked/'+d).set({reason:val('br')})}
  if(a==='unblock')await db.doc('blocked/'+id).delete();
  if(a==='addcut'){if(!val('cn')||!val('cp'))return;await db.collection('cuts').add({name:val('cn'),emoji:val('ce'),desc:val('cd'),img:val('cimg'),price:+val('cp')})}
  if(a==='delcut')await db.doc('cuts/'+id).delete();
  if(a==='addprod'){if(!val('pnm')||!val('ppr'))return;await db.collection('products').add({name:val('pnm'),emoji:val('pem'),img:val('pimg'),price:+val('ppr'),stock:+val('pst')||0})}
  if(a==='delprod')await db.doc('products/'+id).delete();
  }catch(e){say('No se pudo completar la acción: '+(e&&e.message||'error'))}
}
document.addEventListener('click',e=>{const el=e.target.closest('button[data-act]');if(el)act(el)});
document.addEventListener('change',e=>{const a=e.target.dataset.act;
  if(a==='cut'){S.sel.cut=e.target.value;render()}
  if(a==='date'){S.sel.date=e.target.value;S.sel.hour=null;render()}
  if(a==='adate'){S.adate=e.target.value;render()}});
init();
document.addEventListener('click',async e=>{const el=e.target.closest('button[data-act]');if(!el||!['login','register','logout'].includes(el.dataset.act))return;
  try{await fetch('api.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({a:el.dataset.act,email:val('ae'),pass:val('ap'),code:val('ac')})}).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error);});location.reload()}catch(x){say(x.message)}});