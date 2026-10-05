import "./style.css";
import {createClient} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_ANON_KEY;
const db=url&&key?createClient(url,key):null;
const S={session:null,team:null,people:[],dates:[],marks:new Map(),stream:null};

const app=document.getElementById("app");
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const today=()=>new Date().toISOString().slice(0,10);
const dateLabel=d=>new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric"}).format(new Date(d+"T00:00:00"));

function authScreen(message=""){
 app.innerHTML='<div class="min-h-screen grid place-items-center p-5"><div class="glass rounded-3xl w-full max-w-md p-7"><div class="text-2xl font-black">Attendance<span class="text-violet-400">Flow</span></div><p class="text-slate-400 mt-2">Shared attendance for large teams.</p><form id="authForm" class="space-y-3 mt-6"><input id="email" type="email" required placeholder="Email" class="w-full rounded-xl bg-slate-950/70 border border-white/10 px-4 py-3"><input id="password" type="password" minlength="6" required placeholder="Password" class="w-full rounded-xl bg-slate-950/70 border border-white/10 px-4 py-3"><input id="team" placeholder="Team name for new account" class="w-full rounded-xl bg-slate-950/70 border border-white/10 px-4 py-3"><div class="grid grid-cols-2 gap-2"><button id="login" type="button" class="liquid rounded-xl bg-violet-600 py-3 font-bold">Sign in</button><button id="signup" type="button" class="liquid rounded-xl bg-white/5 py-3 font-bold">Create account</button></div></form><p id="msg" class="text-sm text-slate-400 mt-4">'+esc(message)+'</p></div></div>';
 document.getElementById("login").onclick=()=>doAuth(false);
 document.getElementById("signup").onclick=()=>doAuth(true);
}
async function doAuth(newUser){
 if(!db)return;
 const email=document.getElementById("email").value;
 const password=document.getElementById("password").value;
 const team=document.getElementById("team").value.trim()||"My Team";
 document.getElementById("msg").textContent="Working…";
 const r=newUser?await db.auth.signUp({email,password,options:{data:{team_name:team}}}):await db.auth.signInWithPassword({email,password});
 document.getElementById("msg").textContent=r.error?r.error.message:(newUser?"Account created. Check email confirmation if enabled.":"Signed in.");
}

function dashboard(){
 app.innerHTML='<main class="max-w-[1500px] mx-auto px-4 md:px-8 py-6"><header class="glass rounded-3xl px-5 py-4 flex flex-wrap justify-between gap-3"><div><div class="text-xl font-black">Attendance<span class="text-violet-400">Flow</span></div><div id="teamLabel" class="text-xs text-slate-400"></div></div><div class="flex items-center gap-2"><span id="email" class="text-xs text-slate-400"></span><button id="logout" class="liquid rounded-xl bg-slate-800 px-4 py-2">Sign out</button></div></header><section class="py-10 flex flex-col lg:flex-row lg:items-end justify-between gap-5"><div><div class="text-violet-300 text-sm font-semibold">TEAM ATTENDANCE</div><h1 class="text-4xl md:text-6xl font-black mt-2">Know who is <span class="text-transparent bg-clip-text bg-gradient-to-r from-violet-300 to-cyan-300">here.</span></h1><p class="text-slate-400 mt-3">Photos are optional. Upload from the device or take a picture with the camera.</p></div><div class="flex gap-2"><button id="newDate" class="liquid rounded-2xl bg-violet-600 px-5 py-3 font-bold">+ Add date</button><button id="newPerson" class="liquid rounded-2xl bg-white/5 px-5 py-3 font-bold">+ Add person</button></div></section><section class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5"><div class="glass rounded-2xl p-4"><div class="text-xs text-slate-400">People</div><div id="peopleCount" class="text-2xl font-black">0</div></div><div class="glass rounded-2xl p-4"><div class="text-xs text-slate-400">Present today</div><div id="presentCount" class="text-2xl font-black text-green-300">0</div></div><div class="glass rounded-2xl p-4"><div class="text-xs text-slate-400">Absent today</div><div id="absentCount" class="text-2xl font-black text-red-300">0</div></div><div class="glass rounded-2xl p-4"><div class="text-xs text-slate-400">Rate</div><div id="rate" class="text-2xl font-black text-cyan-300">0%</div></div></section><section class="glass rounded-3xl overflow-hidden"><div class="px-5 py-4 border-b border-white/10"><b>Attendance register</b><div class="text-xs text-slate-500 mt-1">Click a cell: empty → present → absent → empty</div></div><div class="overflow-x-auto"><table class="w-full text-sm"><thead id="thead"></thead><tbody id="tbody"></tbody></table></div><div id="empty" class="hidden text-center py-16 text-slate-500">No people yet. Add your first person.</div></section></main><div id="modal" class="modal hidden"></div>';
 document.getElementById("email").textContent=S.session.user.email||"";
 document.getElementById("teamLabel").textContent=S.team.name;
 document.getElementById("logout").onclick=()=>db.auth.signOut();
 document.getElementById("newDate").onclick=addDate;
 document.getElementById("newPerson").onclick=personModal;
}

async function teamSetup(){
 const q=await db.from("team_members").select("team_id,role,teams(id,name)").eq("user_id",S.session.user.id).limit(1).maybeSingle();
 if(q.data){S.team=q.data.teams;return}
 const name=S.session.user.user_metadata?.team_name||"My Team";
 const t=await db.from("teams").insert({name,created_by:S.session.user.id}).select().single();
 if(t.error){alert(t.error.message);return}
 const m=await db.from("team_members").insert({team_id:t.data.id,user_id:S.session.user.id,role:"owner"});
 if(m.error){alert(m.error.message);return}
 S.team=t.data;
}

async function load(){
 const p=await db.from("people").select("*").eq("team_id",S.team.id).eq("active",true).order("name");
 const d=await db.from("attendance_dates").select("*").eq("team_id",S.team.id).order("date");
 const a=await db.from("attendance").select("*").eq("team_id",S.team.id);
 if(p.error||d.error||a.error){console.error(p.error||d.error||a.error);return}
 S.people=p.data||[];S.dates=d.data||[];S.marks=new Map((a.data||[]).map(x=>[x.person_id+"|"+x.date,x.status]));render();
}
function render(){
 const h=document.getElementById("thead"),b=document.getElementById("tbody");
 h.innerHTML="<tr><th class='sticky left-0 bg-slate-950/95 text-left px-5 py-4 min-w-[260px]'>Person</th>"+S.dates.map(d=>"<th class='px-3 py-4 min-w-[110px]'>"+dateLabel(d.date)+"<br><button data-date-remove='"+d.date+"' class='text-[10px] text-slate-500'>remove</button></th>").join("")+"</tr>";
 b.innerHTML=S.people.map(p=>{
   const photo=p.photo_url?'<img class="avatar" src="'+esc(p.photo_url)+'">':'<div class="avatar grid place-items-center text-violet-300 font-black">'+esc(p.name.charAt(0).toUpperCase())+"</div>";
   return "<tr class='border-t border-white/5'><td class='sticky left-0 bg-slate-950/95 px-5 py-3'><div class='flex items-center gap-3'>"+photo+"<div><b>"+esc(p.name)+"</b><div class='text-[11px] text-slate-500'>"+esc(p.identifier||"")+"</div></div><button data-person-remove='"+p.id+"' class='ml-auto text-slate-600 hover:text-red-300'>×</button></div></td>"+S.dates.map(d=>{const s=S.marks.get(p.id+"|"+d.date)||"empty";return "<td class='px-3 py-3'><button data-person='"+p.id+"' data-date='"+d.date+"' class='att "+s+"'>"+(s==="present"?"✓":s==="absent"?"✕":"•")+"</button></td>"}).join("")+"</tr>";
 }).join("");
 document.getElementById("empty").classList.toggle("hidden",S.people.length>0);
 document.querySelectorAll("[data-person]").forEach(x=>x.onclick=()=>toggle(x.dataset.person,x.dataset.date));
 document.querySelectorAll("[data-person-remove]").forEach(x=>x.onclick=()=>removePerson(x.dataset.personRemove));
 document.querySelectorAll("[data-date-remove]").forEach(x=>x.onclick=()=>removeDate(x.dataset.dateRemove));
 stats();
}
function stats(){
 const v=S.people.map(p=>S.marks.get(p.id+"|"+today())).filter(Boolean);
 const present=v.filter(x=>x==="present").length,absent=v.filter(x=>x==="absent").length,total=present+absent;
 document.getElementById("peopleCount").textContent=S.people.length;
 document.getElementById("presentCount").textContent=present;
 document.getElementById("absentCount").textContent=absent;
 document.getElementById("rate").textContent=total?Math.round(present/total*100)+"%":"0%";
}
async function toggle(pid,date){
 const k=pid+"|"+date,old=S.marks.get(k)||"empty",next=old==="empty"?"present":old==="present"?"absent":"empty";
 if(next==="empty"){
   const r=await db.from("attendance").delete().eq("team_id",S.team.id).eq("person_id",pid).eq("date",date);if(r.error)return alert(r.error.message);S.marks.delete(k);
 }else{
   const r=await db.from("attendance").upsert({team_id:S.team.id,person_id:pid,date,status:next,marked_by:S.session.user.id},{onConflict:"team_id,person_id,date"});if(r.error)return alert(r.error.message);S.marks.set(k,next);
 }
 render();
}
async function addDate(){
 const d=prompt("Date (YYYY-MM-DD):",today());if(!d)return;
 const r=await db.from("attendance_dates").insert({team_id:S.team.id,date:d});if(r.error)return alert(r.error.message);load();
}
function personModal(){
 const m=document.getElementById("modal");m.classList.remove("hidden");
 m.innerHTML='<div class="glass rounded-3xl w-full max-w-lg p-6"><div class="flex justify-between"><div><h2 class="text-xl font-black">Add person</h2><p class="text-xs text-slate-500">Photo is optional.</p></div><button id="closeModal" class="text-2xl">×</button></div><form id="personForm" class="space-y-4 mt-5"><input id="personName" required placeholder="Full name" class="w-full rounded-xl bg-slate-950/70 border border-white/10 px-4 py-3"><input id="personId" placeholder="ID / employee number (optional)" class="w-full rounded-xl bg-slate-950/70 border border-white/10 px-4 py-3"><div class="rounded-2xl border border-dashed border-white/10 p-4"><b>Photo</b> <span class="text-xs text-slate-500">(optional)</span><div class="flex gap-2 mt-3"><button type="button" id="upload" class="liquid rounded-xl bg-white/5 px-4 py-2">Upload from device</button><button type="button" id="camera" class="liquid rounded-xl bg-violet-600 px-4 py-2">Take with camera</button></div><input id="file" type="file" accept="image/*" class="hidden"><div id="cameraBox" class="hidden mt-3"><video id="video" autoplay playsinline class="w-full rounded-xl bg-black"></video><button type="button" id="capture" class="w-full mt-2 rounded-xl bg-cyan-600 py-2 font-bold">Capture photo</button></div><canvas id="canvas" class="hidden"></canvas><img id="preview" class="hidden mt-3 w-24 h-24 rounded-2xl object-cover"></div><button class="liquid w-full rounded-xl bg-violet-600 py-3 font-bold">Save person</button></form></div>';
 let photo=null;
 document.getElementById("closeModal").onclick=closeModal;
 document.getElementById("upload").onclick=()=>document.getElementById("file").click();
 document.getElementById("file").onchange=e=>{photo=e.target.files?.[0]||null;showPreview(photo)};
 document.getElementById("camera").onclick=startCamera;
 document.getElementById("capture").onclick=()=>{
   const v=document.getElementById("video"),c=document.getElementById("canvas");
   c.width=v.videoWidth||640;c.height=v.videoHeight||480;c.getContext("2d").drawImage(v,0,0,c.width,c.height);
   c.toBlob(blob=>{photo=blob;showPreview(blob);stopCamera()},"image/jpeg",.86);
 };
 document.getElementById("personForm").onsubmit=async e=>{
   e.preventDefault();
   const name=document.getElementById("personName").value.trim(),identifier=document.getElementById("personId").value.trim();
   let photo_url=null,photo_path=null;
   if(photo){
     const ext=photo.type==="image/png"?"png":"jpg",path=S.team.id+"/"+crypto.randomUUID()+"."+ext;
     const up=await db.storage.from("avatars").upload(path,photo,{contentType:photo.type||"image/jpeg"});
     if(up.error)return alert(up.error.message);
     photo_path=path;photo_url=db.storage.from("avatars").getPublicUrl(path).data.publicUrl;
   }
   const r=await db.from("people").insert({team_id:S.team.id,name,identifier,photo_url,photo_path});
   if(r.error)return alert(r.error.message);
   closeModal();load();
 };
}
function showPreview(blob){const img=document.getElementById("preview");if(!blob)return;img.src=URL.createObjectURL(blob);img.classList.remove("hidden")}
async function startCamera(){
 if(!navigator.mediaDevices?.getUserMedia)return alert("Camera access requires HTTPS or localhost.");
 try{S.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user"},audio:false});document.getElementById("cameraBox").classList.remove("hidden");document.getElementById("video").srcObject=S.stream}
 catch(e){alert("Camera permission was denied or no camera is available.")}
}
function stopCamera(){if(S.stream){S.stream.getTracks().forEach(t=>t.stop());S.stream=null}}
function closeModal(){stopCamera();document.getElementById("modal").classList.add("hidden")}
async function removePerson(id){if(!confirm("Remove this person from the active register?"))return;const r=await db.from("people").update({active:false}).eq("id",id).eq("team_id",S.team.id);if(r.error)alert(r.error.message);else load()}
async function removeDate(date){if(!confirm("Remove this date and its attendance marks?"))return;const r=await db.from("attendance_dates").delete().eq("team_id",S.team.id).eq("date",date);if(r.error)alert(r.error.message);else load()}

function realtime(){
 db.channel("team-"+S.team.id).on("postgres_changes",{event:"*",schema:"public",table:"attendance",filter:"team_id=eq."+S.team.id},()=>load()).subscribe();
}
function visual(){
 const c=document.getElementById("ambientCanvas"),x=c.getContext("2d");let p=[];
 function resize(){c.width=innerWidth;c.height=innerHeight;p=Array.from({length:45},()=>({x:Math.random()*c.width,y:Math.random()*c.height,r:Math.random()*1.5+.3,v:(Math.random()-.5)*.2}))}
 function draw(){x.clearRect(0,0,c.width,c.height);p.forEach(q=>{q.y+=q.v;if(q.y<0)q.y=c.height;if(q.y>c.height)q.y=0;x.beginPath();x.arc(q.x,q.y,q.r,0,Math.PI*2);x.fillStyle="rgba(167,139,250,.35)";x.fill()});requestAnimationFrame(draw)}
 resize();addEventListener("resize",resize);draw();
}
function cursor(){
 const o=document.getElementById("cursorOuter"),d=document.getElementById("cursorDot");if(!o)return;
 o.style.width="34px";o.style.height="34px";o.style.border="1px solid rgba(255,255,255,.4)";o.style.borderRadius="50%";
 d.style.width="6px";d.style.height="6px";d.style.borderRadius="50%";d.style.background="#fff";
 addEventListener("mousemove",e=>{o.style.left=e.clientX+"px";o.style.top=e.clientY+"px";d.style.left=e.clientX+"px";d.style.top=e.clientY+"px"});
}
async function start(){
 visual();cursor();
 if(!db){authScreen("Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.");return}
 const s=await db.auth.getSession();S.session=s.data.session;
 db.auth.onAuthStateChange((_event,session)=>{S.session=session;if(session)loadApp();else authScreen()});
 if(S.session)loadApp();else authScreen();
}
async function loadApp(){dashboard();await teamSetup();document.getElementById("teamLabel").textContent=S.team.name;await load();realtime()}
start();