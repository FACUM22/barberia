// Capa de datos: emula la API usada por la app contra api.php (PHP + SQLite)
(()=>{
const api=async b=>{const r=await fetch('api.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});const j=await r.json();if(!r.ok)throw{code:'not_granted',message:j.error||'error'};return j};
const snap=(id,d)=>({id,exists:d!=null,data:()=>d??undefined});
const ref=p=>({id:p.split('/').pop(),path:p,get:async()=>snap(p.split('/').pop(),(await api({a:'get',path:p})).data),set:d=>api({a:'set',path:p,data:d}),update:d=>api({a:'set',path:p,data:d,merge:1}),delete:()=>api({a:'del',path:p})});
const col=c=>({doc:id=>ref(c+'/'+id),add:async d=>{const id=Math.random().toString(36).slice(2,10);await api({a:'set',path:c+'/'+id,data:d});return ref(c+'/'+id)},
 onSnapshot(fn,err){let h='';const tick=async()=>{try{const j=await api({a:'list',col:c});const x=JSON.stringify(j.docs);if(x!==h){h=x;fn({docs:j.docs.map(d=>snap(d.id,d.data))})}}catch(e){err&&err(e)}};tick();const t=setInterval(tick,5000);return()=>clearInterval(t)}});
window.claude={use:async n=>{const m=await api({a:'me'});
 if(n==='db')return{collection:col,doc:ref};
 if(n==='user')return{isOwner:async()=>!!m.admin,canEdit:async()=>!!m.admin,id:async()=>m.id}}};
})();