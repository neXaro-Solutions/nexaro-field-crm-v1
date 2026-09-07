const KEY='nexaro-crm-v1';
let S=JSON.parse(localStorage.getItem(KEY)||'{"leads":[],"tasks":[],"territory":[]}');

const $=s=>document.querySelector(s);
const save=()=>localStorage.setItem(KEY,JSON.stringify(S));

document.querySelectorAll('nav button').forEach(b=>{
  b.onclick=()=>{
    document.querySelectorAll('nav button').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    render();
  };
});

function openLead(id){
  const f=$('#form');
  if(!f)return;
  f.reset();
  if(id){
    const l=S.leads.find(x=>x.id===id);
    if(l)Object.keys(l).forEach(k=>{
      const e=f.querySelector(`[name="${k}"]`);
      if(e)e.value=l[k]??'';
    });
  }
  injectTPV();
  f.scrollIntoView({behavior:'smooth',block:'center'});
}

function injectTPV(){
  const f=$('#form');
  if(!f||f.querySelector('[name="tpv"]'))return;
  const box=document.createElement('div');
  box.innerHTML='<label>Monatliches Kartenzahlungsvolumen (TPV) €<input name="tpv" type="number" min="0" step="100" placeholder="z. B. 5000"></label>';
  const first=f.querySelector('label');
  if(first)first.after(box.firstElementChild);
  else f.appendChild(box.firstElementChild);
}

function qualification(tpv){
  tpv=Number(tpv)||0;
  if(tpv>=15000)return{level:'A',text:'Sehr stark qualifiziert'};
  if(tpv>=10000)return{level:'B',text:'Stark qualifiziert'};
  if(tpv>=5000)return{level:'C',text:'Qualifiziert'};
  return{level:'D',text:'Unter internem Ziel von €5.000 TPV'};
}

function tariff(tpv){
  tpv=Number(tpv)||0;
  const payg=tpv*0.0139;
  const plus=tpv*0.0079+19;
  return plus<payg
    ?{name:'Zahlungen Plus',monthly:plus,fee:'0,79%'}
    :{name:'Umsatzbasiertes Zahlen',monthly:payg,fee:'1,39%'};
}

function commission(tpv){
  tpv=Number(tpv)||0;
  let activation=tpv>=500?200:0;
  let annualized=tpv*0.007*12*0.5;
  let day30=Math.max(0,annualized-activation);
  let master=tpv>15000?100:0;
  return{
    activation,
    day30,
    master,
    total:activation+day30+master
  };
}

function card(l){
  const q=qualification(l.tpv);
  const t=tariff(l.tpv);
  return `<div class="card lead-card">
    <h3>${l.firma||'Unbenannt'}</h3>
    <p>${l.branche||''} · ${l.status||'Neu'}</p>
    <p><strong>TPV:</strong> €${Number(l.tpv||0).toLocaleString('de-DE')}</p>
    <p><strong>Qualifizierung:</strong> ${q.text}</p>
    <p><strong>Tarif:</strong> ${t.name}</p>
    <button onclick="openLead('${l.id}')">Bearbeiten</button>
  </div>`;
}

function render(){
  const today=new Date().toISOString().slice(0,10);
  const leads=S.leads||[];
  const tasks=S.tasks||[];
  const root=$('main')||document.querySelector('.content')||document.body;

  const stats=document.querySelectorAll('[data-stat]');
  stats.forEach(e=>{
    const type=e.dataset.stat;
    if(type==='leads')e.textContent=leads.length;
    if(type==='tasks')e.textContent=tasks.filter(x=>x.date===today&&!x.done).length;
    if(type==='won')e.textContent=leads.filter(x=>x.status==='Gewonnen').length;
    if(type==='appointments')e.textContent=leads.filter(x=>x.status==='Termin').length;
  });

  const search=$('#search');
  if(search&&search.value){
    const q=search.value.toLowerCase();
    leads.filter(l=>JSON.stringify(l).toLowerCase().includes(q));
  }
}

function collectForm(){
  const f=$('#form');
  if(!f)return null;
  const data={};
  new FormData(f).forEach((v,k)=>data[k]=v);
  data.id=data.id||Date.now().toString();
  data.tpv=Number(data.tpv)||0;
  data.created=data.created||new Date().toISOString();
  return data;
}

function setupForm(){
  const f=$('#form');
  if(!f)return;
  injectTPV();
  f.addEventListener('submit',e=>{
    e.preventDefault();
    const data=collectForm();
    if(!data)return;
    const i=S.leads.findIndex(x=>x.id===data.id);
    if(i>=0)S.leads[i]=data;
    else S.leads.unshift(data);
    save();
    render();
    alert('Lead gespeichert.');
  });
}

function setupQuick(){
  const q=$('#quick');
  const add=$('#add');
  if(q)q.onclick=()=>openLead();
  if(add)add.onclick=()=>openLead();
}

function setupSearch(){
  const s=$('#search');
  if(s)s.oninput=render;
}

function setupLocation(){
  const b=$('#locate');
  if(!b)return;
  b.onclick=()=>{
    if(!navigator.geolocation){
      alert('Standort wird von diesem Gerät nicht unterstützt.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      p=>{
        localStorage.setItem('nexaro-location',JSON.stringify({
          lat:p.coords.latitude,
          lng:p.coords.longitude
        }));
        alert('Standort übernommen.');
      },
      ()=>alert('Standort konnte nicht ermittelt werden.')
    );
  };
}

document.addEventListener('DOMContentLoaded',()=>{
  setupForm();
  setupQuick();
  setupSearch();
  setupLocation();
  render();
});
