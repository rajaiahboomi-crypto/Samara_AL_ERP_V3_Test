'use strict';
const CFG=window.SAMARA_CONFIG;
const db=window.supabase.createClient(CFG.supabaseUrl,CFG.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},global:{headers:{'X-Client-Info':'samara-care-erp-v2.3'}}});
const rolePages={Admin:['dashboard','patients','beds','care','vitals','medicines','food','incidents','documents','billing','employees','reports','notifications'],Manager:['dashboard','patients','beds','care','vitals','medicines','food','incidents','documents','billing','reports','notifications'],Nurse:['dashboard','patients','care','vitals','medicines','food','incidents','documents','reports'],Caregiver:['dashboard','patients','care','food','incidents'],Accounts:['dashboard','patients','billing','reports','notifications'],Kitchen:['dashboard','food']};
const labels={dashboard:'Dashboard',patients:'Patients',beds:'Rooms & Beds',care:'Daily Care',vitals:'Vital Signs',medicines:'Medicines',food:'Food & Diet',incidents:'Incident & Fall Register',documents:'Documents',billing:'Billing',employees:'Employees',reports:'Reports',notifications:'Notifications'};
const navIcons={dashboard:'⌂',patients:'◉',beds:'▦',care:'✓',vitals:'♡',medicines:'✚',food:'◫',incidents:'⚠',documents:'▤',billing:'₹',employees:'♙',reports:'▥',notifications:'◌'};
let me=null,page='dashboard',profiles=[],employeeDocuments=[],patients=[],rooms=[],care=[],vitals=[],meds=[],meals=[],incidents=[],documents=[],billing=[],clinicalAlerts=[],notificationQueue=[],channel=null;
const $=id=>document.getElementById(id); const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
async function resolveLoginEmail(login){const id=String(login).trim().toLowerCase();const {data,error}=await db.rpc('samara_login_email',{p_login_id:id});if(error)throw error;if(data)return data;if(id==='admin')return 'admin@users.samaracare.local';throw new Error('Login ID not found. Contact the administrator.')}
function showError(e){alert(e?.message||String(e)||'Unexpected error')}
function setSync(t){$('syncStatus').textContent=t}
async function getProfile(uid){const {data,error}=await db.from('profiles').select('*').eq('id',uid).single();if(error)throw error;if(!data.active)throw new Error('This employee account is inactive.');return data}
async function login(){const btn=$('loginBtn');btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Signing in';try{const login=$('loginId').value.trim(),password=$('loginPassword').value;if(!login||!password)throw new Error('Enter Login ID and password.');const email=await resolveLoginEmail(login);const {data,error}=await db.auth.signInWithPassword({email,password});if(error)throw error;me=await getProfile(data.user.id);await enterApp()}catch(e){await db.auth.signOut();showError(e)}finally{btn.disabled=false;btn.textContent='Sign in'}}
async function enterApp(){$('loginView').classList.add('hidden');$('appView').classList.remove('hidden');$('userName').textContent=me.full_name;$('userRole').textContent=me.role;$('avatar').textContent=me.full_name?.[0]||'U';buildNav();await loadAll();subscribeRealtime();go('dashboard')}
function buildNav(){$('nav').innerHTML=(rolePages[me.role]||['dashboard']).map(p=>`<button id="nav-${p}" data-page="${p}"><i>${navIcons[p]||'•'}</i><span>${labels[p]}</span></button>`).join('');$('nav').querySelectorAll('button').forEach(b=>b.onclick=()=>go(b.dataset.page))}
async function loadAll(){
 setSync('Syncing…');
 const queries=[
  db.from('profiles').select('*').order('full_name'),
  db.from('employee_documents').select('*').order('uploaded_at',{ascending:false}).limit(300),
  db.from('patients').select('*').order('created_at',{ascending:false}),
  db.from('rooms_beds').select('*').order('room_no').order('bed_no'),
  db.from('care_records').select('*').order('recorded_at',{ascending:false}).limit(150),
  db.from('vital_signs').select('*').order('recorded_at',{ascending:false}).limit(200),
  db.from('medicine_records').select('*').order('created_at',{ascending:false}).limit(150),
  db.from('meal_records').select('*').order('recorded_at',{ascending:false}).limit(150),
  db.from('incidents').select('*').order('incident_at',{ascending:false}).limit(200),
  db.from('patient_documents').select('*').order('uploaded_at',{ascending:false}).limit(200),
  db.from('clinical_alerts').select('*').order('created_at',{ascending:false}).limit(200),
  db.from('notification_queue').select('*').order('created_at',{ascending:false}).limit(200)
 ];
 if(['Admin','Manager','Accounts'].includes(me.role))queries.push(db.from('billing_transactions').select('*').order('recorded_at',{ascending:false}).limit(300));
 const res=await Promise.all(queries);const err=res.find(x=>x.error)?.error;if(err)throw err;
 [profiles,employeeDocuments,patients,rooms,care,vitals,meds,meals,incidents,documents,clinicalAlerts,notificationQueue]=res.slice(0,12).map(x=>x.data||[]);billing=res[12]?.data||[];setSync('Live')
}
function subscribeRealtime(){if(channel)db.removeChannel(channel);channel=db.channel('samara-live-v2').on('postgres_changes',{event:'*',schema:'public'},async()=>{try{await loadAll();render()}catch(e){console.error(e)}}).subscribe()}
function closeMobileMenu(){document.getElementById('sidebar')?.classList.remove('open');document.getElementById('navOverlay')?.classList.remove('show');document.body.classList.remove('menu-open')}
function toggleMobileMenu(){const open=document.getElementById('sidebar')?.classList.toggle('open');document.getElementById('navOverlay')?.classList.toggle('show',!!open);document.body.classList.toggle('menu-open',!!open)}
function go(p){closeMobileMenu();page=p;document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'));$(`nav-${p}`)?.classList.add('active');$('pageTitle').textContent=labels[p];$('pageTitleLarge')&&($('pageTitleLarge').textContent=labels[p]);render()}
function render(){const fn=window[`render_${page}`];$('content').innerHTML=fn?fn():'';bindPageActions()}
function pname(id){return patients.find(p=>p.id===id)?.full_name||'Unknown patient'}function staffName(id){return profiles.find(p=>p.id===id)?.full_name||'—'}
function metric(label,value,sub,cls='',detail=''){const icons={'Total Beds':'▦','Occupied':'●','Critical Alerts':'!','Warnings':'⚠','Medicines Due':'✚','Outstanding':'₹','Open Incidents':'◇'};return `<button type="button" class="card metric metric-click" data-dashboard-detail="${detail}" aria-label="View ${esc(label)} details"><div class="metric-top"><div class="label">${esc(label)}</div><span class="metric-icon">${icons[label]||'•'}</span></div><div class="value ${cls}">${esc(value)}</div><div class="muted metric-sub">${esc(sub)}</div><div class="metric-link">View details →</div></button>`}
function render_dashboard(){
 const occupied=patients.filter(x=>x.status==='Active').length,pending=meds.filter(x=>x.status==='Pending').length;
 const openAlerts=clinicalAlerts.filter(x=>!['Resolved','Closed'].includes(x.status));
 const critical=openAlerts.filter(x=>x.severity==='Critical').length,warning=openAlerts.filter(x=>x.severity==='Warning').length;
 const openIncidents=incidents.filter(x=>x.status!=='Closed').length,outstanding=patients.reduce((a,p)=>a+Number(p.outstanding||0),0);
 const alertRows=openAlerts.slice(0,6).map(a=>`<button class="list-item detail-row" data-dashboard-detail="${a.severity==='Critical'?'critical':'warnings'}"><span><b>${esc(pname(a.patient_id))}</b><br><small class="muted">${esc(a.parameter)}: ${esc(a.value)} ${esc(a.unit||'')} · ${esc(a.severity)}</small></span><span class="tag ${a.severity==='Critical'?'red':'amber'}">${esc(a.status)}</span></button>`).join('');
 return `<div class="welcome-strip"><div><span class="eyebrow">TODAY'S OPERATIONS</span><h2>Good day, ${esc(me.full_name?.split(' ')[0]||'Team')}</h2><p>Tap any dashboard card to view the underlying records.</p></div><div class="welcome-date">${new Date().toLocaleDateString('en-IN',{weekday:'short',day:'2-digit',month:'short',year:'numeric'})}</div></div><div class="cards">${metric('Total Beds','25','Facility capacity','','beds')}${metric('Occupied',occupied,`${25-occupied} available`,'ok','occupied')}${metric('Critical Alerts',critical,'Immediate action',critical?'bad':'ok','critical')}${metric('Warnings',warning,'Clinical review',warning?'warn':'ok','warnings')}${metric('Medicines Due',pending,'Pending doses',pending?'warn':'ok','medicines')}${metric('Outstanding',`₹${outstanding.toLocaleString('en-IN')}`,'Current receivables','bad','outstanding')}${metric('Open Incidents',openIncidents,'Requires follow-up',openIncidents?'warn':'ok','incidents')}</div><div class="grid2"><div class="card"><div class="card-title-row"><h3>Clinical alerts</h3><button class="text-button" data-dashboard-detail="all-alerts">View all</button></div><div class="list">${alertRows||'<div class="muted">No open clinical alerts</div>'}</div></div><div class="card"><div class="card-title-row"><h3>Recent activity</h3><button class="text-button" data-dashboard-detail="activity">View all</button></div><div class="list">${[...care.slice(0,3),...vitals.slice(0,3)].sort((a,b)=>new Date(b.recorded_at)-new Date(a.recorded_at)).slice(0,5).map(x=>`<div class="list-item"><span><b>${esc(pname(x.patient_id))}</b><br><small class="muted">${esc(x.activity||`Temp ${x.temperature||'-'}, Pulse ${x.pulse||'-'}, SpO₂ ${x.spo2||'-'}%`)}</small></span><small>${new Date(x.recorded_at).toLocaleString('en-IN')}</small></div>`).join('')||'<div class="muted">No activity yet</div>'}</div></div></div>`}
function render_patients(){const refs=[...new Set(patients.map(p=>p.referred_by).filter(Boolean))].sort();return `<div class="page-head"><div><h2>Patients</h2><div class="muted">Shared resident records</div></div><div class="actions">${['Admin','Manager','Nurse'].includes(me.role)?'<button class="btn btn-secondary" id="printPatients">Print</button><button class="btn btn-primary" id="addPatient">+ Add Patient</button>':''}</div></div><div class="toolbar"><input id="patientSearch" placeholder="Search patient, code or room"><select id="patientRefFilter"><option value="">All Referred By</option>${refs.map(r=>`<option>${esc(r)}</option>`).join('')}</select><select id="patientPayFilter"><option value="">All payment status</option><option value="due">Outstanding</option><option value="clear">No Outstanding</option></select></div><div class="table-wrap"><table><thead><tr><th>Code</th><th>Patient</th><th>Room</th><th>Diagnosis</th><th>Referred By</th><th>Reference Contact</th><th>Care</th><th>Outstanding</th><th>Action</th></tr></thead><tbody id="patientRows">${patientRows(patients)}</tbody></table></div>`}
function patientRows(list){return list.map(p=>`<tr><td>${esc(p.patient_code)}</td><td><b>${esc(p.full_name)}</b><br><small>${esc(p.age||'')} ${p.gender?'· '+esc(p.gender):''}</small></td><td>${esc(p.room_bed||'-')}</td><td>${esc(p.diagnosis||'-')}</td><td>${esc(p.referred_by||'-')}</td><td>${esc(p.reference_contact||'-')}</td><td><span class="tag">${esc(p.care_level||'-')}</span></td><td>₹${Number(p.outstanding||0).toLocaleString('en-IN')}</td><td><button class="btn btn-secondary btn-small patient-history" data-id="${p.id}">Payment History</button></td></tr>`).join('')||'<tr><td colspan="9">No patients found</td></tr>'}
function applyPatientFilters(){const q=($('patientSearch')?.value||'').toLowerCase(),ref=$('patientRefFilter')?.value||'',pay=$('patientPayFilter')?.value||'';const list=patients.filter(p=>(!q||[p.full_name,p.patient_code,p.room_bed,p.referred_by].some(v=>String(v||'').toLowerCase().includes(q)))&&(!ref||p.referred_by===ref)&&(!pay||(pay==='due'?Number(p.outstanding)>0:Number(p.outstanding)<=0)));$('patientRows').innerHTML=patientRows(list);document.querySelectorAll('.patient-history').forEach(b=>b.onclick=()=>openPaymentHistory(b.dataset.id))}
function render_beds(){return `<div class="page-head"><div><h2>Rooms & Beds</h2><div class="muted">Editable room and bed master</div></div>${['Admin','Manager'].includes(me.role)?'<button class="btn btn-primary" id="addRoomBed">+ Add Room / Bed</button>':''}</div><div class="table-wrap"><table><thead><tr><th>Room</th><th>Bed</th><th>Type</th><th>Rate</th><th>Status</th><th>Patient</th><th>Action</th></tr></thead><tbody>${rooms.map(r=>{const code=`${r.room_no}-${r.bed_no}`,pt=patients.find(p=>p.room_bed===code&&p.status==='Active');return `<tr><td>${esc(r.room_no)}</td><td>${esc(r.bed_no)}</td><td>${esc(r.room_type||'-')}</td><td>₹${Number(r.daily_rate||0).toLocaleString('en-IN')}</td><td><span class="tag ${r.status==='Available'?'green':r.status==='Maintenance'?'red':'amber'}">${esc(pt?'Occupied':r.status)}</span></td><td>${esc(pt?.full_name||'-')}</td><td>${['Admin','Manager'].includes(me.role)?`<button class="btn btn-secondary btn-small edit-room" data-id="${r.id}">Edit</button>`:''}</td></tr>`}).join('')||'<tr><td colspan="7">No rooms configured. Click Add Room / Bed.</td></tr>'}</tbody></table></div>`}
function modulePage(title,sub,buttonId,buttonLabel,heads,rows){return `<div class="page-head"><div><h2>${title}</h2><div class="muted">${sub}</div></div>${buttonId?`<button class="btn btn-primary" id="${buttonId}">+ ${buttonLabel}</button>`:''}</div><div class="table-wrap"><table><thead><tr>${heads.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows||`<tr><td colspan="${heads.length}">No records yet</td></tr>`}</tbody></table></div>`}
function render_care(){return modulePage('Daily Care','Hygiene, mobility, feeding and assistance','addCare','Record Care',['Patient','Activity','Status','Employee','Time'],care.map(x=>`<tr><td>${esc(pname(x.patient_id))}</td><td>${esc(x.activity)}</td><td><span class="tag">${esc(x.status)}</span></td><td>${esc(staffName(x.recorded_by))}</td><td>${new Date(x.recorded_at).toLocaleString('en-IN')}</td></tr>`).join(''))}
function vitalClass(x){return x.alert_level==='Critical'?'red':x.alert_level==='Warning'?'amber':'green'}
function render_vitals(){const rows=vitals.map(x=>{const p=patients.find(z=>z.id===x.patient_id)||{};return `<tr><td><b>${esc(p.full_name||'')}</b></td><td>${esc(p.patient_code||'-')}</td><td>${esc(p.room_bed||'-')}</td><td>${esc(x.temperature??'-')} ${esc(x.temperature_unit||'°F')}</td><td>${esc(x.pulse??'-')}</td><td>${esc(x.respiration??'-')}</td><td>${esc(x.spo2??'-')}%</td><td>${esc(x.blood_sugar_type||'-')} ${x.blood_sugar_value?esc(x.blood_sugar_value)+' mg/dL':''}</td><td><span class="tag ${vitalClass(x)}">${esc(x.alert_level||'Normal')}</span></td><td>${esc(staffName(x.recorded_by))}<br><small>${new Date(x.recorded_at).toLocaleString('en-IN')}</small></td></tr>`}).join('');return modulePage('Vital Signs','Automatic abnormal-value alerts and clinical escalation',['Admin','Manager','Nurse'].includes(me.role)?'addVitals':'','Record Vitals',['Patient Name','ID','Room No.','Temperature','Pulse','Respiration','SpO₂','Sugar','Alert','Recorded By'],rows)}
function render_medicines(){return modulePage('Medicines','Medication schedule and administration',['Admin','Manager','Nurse'].includes(me.role)?'addMedicine':'','Add Medicine',['Patient','Medicine','Time','Status','Action'],meds.map(x=>`<tr><td>${esc(pname(x.patient_id))}</td><td>${esc(x.medicine)}</td><td>${esc(x.scheduled_time||'-')}</td><td><span class="tag ${x.status==='Given'?'green':x.status==='Pending'?'amber':'red'}">${esc(x.status)}</span></td><td>${x.status==='Pending'&&['Admin','Manager','Nurse'].includes(me.role)?`<button class="btn btn-secondary btn-small med-given" data-id="${x.id}">Mark Given</button>`:''}</td></tr>`).join(''))}
function render_food(){return modulePage('Food & Diet','Meal plan and consumption','addMeal','Record Meal',['Patient','Meal','Diet','Consumption','Employee'],meals.map(x=>`<tr><td>${esc(pname(x.patient_id))}</td><td>${esc(x.meal_type)}</td><td>${esc(x.diet_type||'-')}</td><td>${esc(x.consumption||'-')}</td><td>${esc(staffName(x.recorded_by))}</td></tr>`).join(''))}
function render_billing(){if(!['Admin','Manager','Accounts'].includes(me.role))return '<div class="notice">You do not have access to billing.</div>';const refs=[...new Set(patients.map(p=>p.referred_by).filter(Boolean))].sort();return `<div class="page-head"><div><h2>Billing</h2><div class="muted">Charges, payments, discounts and full bills</div></div><button class="btn btn-primary" id="addBilling">+ Add Transaction</button></div><div class="toolbar"><select id="billPatient"><option value="">All Patients</option>${patients.map(p=>`<option value="${p.id}">${esc(p.full_name)}</option>`).join('')}</select><select id="billRef"><option value="">All Referred By</option>${refs.map(r=>`<option>${esc(r)}</option>`).join('')}</select><select id="billRaised"><option value="">All Raised By</option>${profiles.map(p=>`<option value="${p.id}">${esc(p.full_name)}</option>`).join('')}</select><select id="billType"><option value="">All Types</option><option>Charge</option><option>Payment</option><option>Discount</option></select><input id="billFrom" type="date"><input id="billTo" type="date"></div><div class="table-wrap"><table><thead><tr><th>Patient</th><th>Type</th><th>Amount</th><th>Description</th><th>Payment Mode / Ref.</th><th>Discount Approval</th><th>Raised By</th><th>Time</th><th>Action</th></tr></thead><tbody id="billingRows">${billingRows(billing)}</tbody></table></div>`}
function billingRows(list){return list.map(x=>`<tr><td>${esc(pname(x.patient_id))}</td><td>${esc(x.transaction_type)}</td><td>₹${Number(x.amount).toLocaleString('en-IN')}</td><td>${esc(x.description||'-')}</td><td>${esc(x.payment_mode||'-')}<br><small>${esc(x.reference_no||x.receipt_no||'')}</small></td><td>${x.transaction_type==='Discount'?`<span class="tag ${x.discount_status==='Approved'?'green':x.discount_status==='Rejected'?'red':'amber'}">${esc(x.discount_status||'Pending')}</span><br><small>${esc(x.discount_reason||'')}</small>`:'-'}</td><td>${esc(staffName(x.recorded_by))}<br><small>${esc(profiles.find(p=>p.id===x.recorded_by)?.role||'')}</small></td><td>${new Date(x.recorded_at).toLocaleString('en-IN')}</td><td><div class="actions">${x.transaction_type==='Discount'&&x.discount_status==='Pending'&&['Admin','Manager'].includes(me.role)?`<button class="btn btn-secondary btn-small approve-discount" data-id="${x.id}">Approve</button>`:''}<button class="btn btn-secondary btn-small print-bill" data-id="${x.patient_id}">Full Bill</button></div></td></tr>`).join('')||'<tr><td colspan="9">No transactions found</td></tr>'}
function applyBillingFilters(){const pid=$('billPatient')?.value||'',ref=$('billRef')?.value||'',raised=$('billRaised')?.value||'',type=$('billType')?.value||'',from=$('billFrom')?.value,to=$('billTo')?.value;const list=billing.filter(x=>(!pid||x.patient_id===pid)&&(!ref||patients.find(p=>p.id===x.patient_id)?.referred_by===ref)&&(!raised||x.recorded_by===raised)&&(!type||x.transaction_type===type)&&(!from||new Date(x.recorded_at)>=new Date(from))&&(!to||new Date(x.recorded_at)<new Date(to+'T23:59:59')));$('billingRows').innerHTML=billingRows(list);bindBillingButtons()}
async function queueNotification(eventType,patientId,title,message){
 const p=patients.find(x=>x.id===patientId)||{}; const mobile=p.notification_mobile||p.reference_contact||null;
 if(!mobile)return;
 const channels=[];if(p.whatsapp_opt_in!==false)channels.push('WhatsApp');if(p.sms_opt_in===true)channels.push('SMS');
 for(const channel of channels){await db.from('notification_queue').insert({event_type:eventType,patient_id:patientId,channel,recipient:mobile,title,message,status:'Pending',created_by:me.id})}
}
function render_notifications(){
 const rows=notificationQueue.map(n=>`<tr>
  <td>${new Date(n.created_at).toLocaleString('en-IN')}</td>
  <td>${esc(n.event_type)}</td><td>${esc(pname(n.patient_id))}</td>
  <td>${esc(n.channel)}</td><td>${esc(n.recipient)}</td>
  <td class="notification-message">${esc(n.message)}</td>
  <td><span class="tag ${n.status==='Sent'?'green':n.status==='Failed'?'red':'amber'}">${esc(n.status)}</span>${n.sent_at?`<br><small>${new Date(n.sent_at).toLocaleString('en-IN')}</small>`:''}${n.error_message?`<br><small class="error-text">${esc(n.error_message)}</small>`:''}</td>
  <td><div class="actions">
   ${n.channel==='WhatsApp'?`<button class="btn btn-secondary btn-small wa-send" data-id="${n.id}">Open WhatsApp</button>`:''}
   ${['Pending','Failed'].includes(n.status)?`<button class="btn btn-primary btn-small notification-send-one" data-id="${n.id}">${n.status==='Failed'?'Retry':'Send'}</button>`:''}
  </div></td></tr>`).join('');
 return `<div class="page-head"><div><h2>Notifications</h2><div class="muted">Twilio WhatsApp/SMS delivery queue and audit log</div></div>
 <div class="actions"><button class="btn btn-secondary" id="queuePending">Queue Payment Reminders</button><button class="btn btn-primary" id="sendPendingNotifications">Send Pending Now</button></div></div>
 <div class="notice"><b>Twilio messaging:</b> Credentials are stored securely in Supabase Edge Function secrets. WhatsApp Sandbox messages can be sent only to numbers that joined the Sandbox. SMS requires a Twilio SMS-capable sender number.</div>
 <div class="table-wrap"><table><thead><tr><th>Date</th><th>Event</th><th>Patient</th><th>Channel</th><th>Recipient</th><th>Message</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows||'<tr><td colspan="8">No notifications queued</td></tr>'}</tbody></table></div>`}
async function queuePendingPaymentReminders(){try{for(const p of patients.filter(x=>Number(x.outstanding)>0)){await queueNotification('PAYMENT_PENDING',p.id,'Payment reminder',`Samara Care: Outstanding amount for ${p.full_name} is ₹${Number(p.outstanding).toLocaleString('en-IN')}. Please contact Accounts for details.`)}alert('Pending-payment reminders queued.')}catch(e){showError(e)}}
async function openWhatsAppNotification(id){const n=notificationQueue.find(x=>x.id===id);if(!n)return;const phone=String(n.recipient||'').replace(/\D/g,'');window.open(`https://wa.me/${phone.startsWith('91')?phone:'91'+phone}?text=${encodeURIComponent(n.message)}`,'_blank')}
async function invokeNotificationSender(ids){
 try{
  setSync('Sending...');
  const payload=ids?.length?{ids}:{mode:'pending'};
  const {data,error}=await db.functions.invoke('send-notifications',{body:payload});
  if(error)throw error;
  const sent=(data?.processed||[]).filter(x=>x.status==='Sent').length;
  const failed=(data?.processed||[]).filter(x=>x.status==='Failed').length;
  alert(`Messaging completed. Sent: ${sent}. Failed: ${failed}.`);
  await loadAll();render();
 }catch(e){showError(e)}finally{setSync('Live')}
}
async function sendPendingNotifications(){await invokeNotificationSender()}
async function sendOneNotification(id){await invokeNotificationSender([id])}

function render_employees(){
 if(me.role!=='Admin')return '<div class="notice">Employee profiles are restricted to the Administrator.</div>';
 return `<div class="page-head"><div><h2>Employees</h2><div class="muted">Administrator-only employee profiles, photographs and certificates</div></div><button class="btn btn-primary" id="addEmployee">+ Add Employee</button></div><div class="notice"><b>Confidential records:</b> Only the Administrator can view employee personal information, photographs and certificates.</div><div class="table-wrap"><table><thead><tr><th>Employee</th><th>Employee ID</th><th>Designation / Role</th><th>Mobile</th><th>Email</th><th>Status</th><th>Actions</th></tr></thead><tbody>${profiles.map(p=>`<tr><td><button class="employee-name-link employee-profile" data-id="${p.id}">${esc(p.full_name)}</button><br><small>${esc(p.login_id)}</small></td><td>${esc(p.employee_id||'-')}</td><td>${esc(p.designation||p.role)}<br><small>${esc(p.role)}</small></td><td>${esc(p.mobile||'-')}</td><td>${esc(p.auth_email||'-')}</td><td><span class="tag ${p.active?'green':'red'}">${p.active?'Active':'Inactive'}</span></td><td><div class="actions"><button class="btn btn-secondary btn-small employee-profile" data-id="${p.id}">Profile</button>${p.id!==me.id?`<button class="btn ${p.active?'btn-danger':'btn-secondary'} btn-small toggle-employee" data-id="${p.id}" data-active="${!p.active}">${p.active?'Disable':'Activate'}</button>`:''}</div></td></tr>`).join('')}</tbody></table></div>`
}
function dateInputValue(d){return new Date(d).toISOString().slice(0,10)}
function reportDateRange(){const today=dateInputValue(new Date());return {from:$('reportFrom')?.value||today,to:$('reportTo')?.value||today}}
function inDateRange(value,from,to){if(!value)return false;const d=new Date(value),a=new Date(from+'T00:00:00'),b=new Date(to+'T23:59:59.999');return d>=a&&d<=b}
function reportStats(from,to){
 const admissions=patients.filter(p=>inDateRange(p.admission_date||p.created_at,from,to));
 const discharges=patients.filter(p=>inDateRange(p.discharge_date,from,to));
 const periodCare=care.filter(x=>inDateRange(x.recorded_at,from,to));
 const periodVitals=vitals.filter(x=>inDateRange(x.recorded_at,from,to));
 const periodAlerts=clinicalAlerts.filter(x=>inDateRange(x.created_at,from,to));
 const periodIncidents=incidents.filter(x=>inDateRange(x.incident_at,from,to));
 const periodMeds=meds.filter(x=>inDateRange(x.created_at||x.administered_at,from,to));
 const periodBilling=billing.filter(x=>inDateRange(x.recorded_at,from,to));
 const charges=periodBilling.filter(x=>x.transaction_type==='Charge').reduce((a,x)=>a+Number(x.amount||0),0);
 const payments=periodBilling.filter(x=>x.transaction_type==='Payment').reduce((a,x)=>a+Number(x.amount||0),0);
 const discounts=periodBilling.filter(x=>x.transaction_type==='Discount'&&x.discount_status==='Approved').reduce((a,x)=>a+Number(x.amount||0),0);
 return {admissions,discharges,periodCare,periodVitals,periodAlerts,periodIncidents,periodMeds,periodBilling,charges,payments,discounts,outstanding:patients.reduce((a,p)=>a+Number(p.outstanding||0),0)}
}
function render_reports(){
 const today=dateInputValue(new Date());
 return `<div class="page-head"><div><h2>Reports</h2><div class="muted">Interactive operational, clinical and financial reporting</div></div><div class="actions"><button class="btn btn-secondary" id="dailyReport">Daily Report</button><button class="btn btn-primary" id="periodReport">Generate Period Report</button></div></div>
 <div class="report-filters card"><div class="field"><label>From</label><input id="reportFrom" type="date" value="${today}"></div><div class="field"><label>To</label><input id="reportTo" type="date" value="${today}"></div><div class="field"><label>Section</label><select id="reportSection"><option value="all">Complete Report</option><option value="admissions">Admissions & Discharges</option><option value="clinical">Clinical Alerts & Vitals</option><option value="care">Daily Care</option><option value="medicines">Medicines</option><option value="incidents">Incidents</option><option value="finance">Payments & Pending</option></select></div><div class="report-filter-actions"><button class="btn btn-secondary" id="previewReport">Preview</button><button class="btn btn-secondary" id="printGeneratedReport">Print / PDF</button></div></div>
 <div id="reportPreview">${reportPreviewHtml(today,today,'all')}</div>`
}
function reportMetric(label,value,detail,cls=''){return `<button class="card report-metric" data-report-detail="${detail}"><div class="label">${esc(label)}</div><div class="value ${cls}">${esc(value)}</div><div class="metric-link">View records →</div></button>`}
function reportPreviewHtml(from,to,section='all'){
 const s=reportStats(from,to), range=from===to?new Date(from+'T12:00:00').toLocaleDateString('en-IN',{dateStyle:'long'}):`${new Date(from+'T12:00:00').toLocaleDateString('en-IN')} to ${new Date(to+'T12:00:00').toLocaleDateString('en-IN')}`;
 const metrics=`<div class="cards report-cards">${reportMetric('New Admissions',s.admissions.length,'admissions')}${reportMetric('Discharges',s.discharges.length,'discharges')}${reportMetric('Clinical Alerts',s.periodAlerts.length,'alerts',s.periodAlerts.length?'bad':'ok')}${reportMetric('Open Incidents',s.periodIncidents.filter(x=>x.status!=='Closed').length,'incidents')}${reportMetric('Care Records',s.periodCare.length,'care')}${reportMetric('Medicines Given',s.periodMeds.filter(x=>x.status==='Given').length,'medicines','ok')}${reportMetric('Payments',`₹${s.payments.toLocaleString('en-IN')}`,'payments','ok')}${reportMetric('Pending',`₹${s.outstanding.toLocaleString('en-IN')}`,'pending','bad')}</div>`;
 const summary=`<div class="card report-summary"><div><h3>Management Summary</h3><p class="muted">${esc(range)}</p></div><div class="summary-grid"><span><b>Charges:</b> ₹${s.charges.toLocaleString('en-IN')}</span><span><b>Payments:</b> ₹${s.payments.toLocaleString('en-IN')}</span><span><b>Discounts:</b> ₹${s.discounts.toLocaleString('en-IN')}</span><span><b>Current Outstanding:</b> ₹${s.outstanding.toLocaleString('en-IN')}</span></div></div>`;
 return `<section class="generated-report" data-from="${from}" data-to="${to}" data-section="${section}"><div class="report-heading"><div><span class="eyebrow">SAMARA CARE ERP</span><h2>${from===to?'Daily Report':'Periodical Report'}</h2><p>${esc(range)}</p></div><div><b>Generated by:</b> ${esc(me.full_name)}<br><small>${new Date().toLocaleString('en-IN')}</small></div></div>${metrics}${summary}${reportSectionHtml(section,s)}</section>`
}
function reportSectionHtml(section,s){
 const parts=[];
 if(section==='all'||section==='admissions')parts.push(reportTable('Admissions & Discharges',['Type','Patient','ID','Room','Date'],[
  ...s.admissions.map(p=>['Admission',p.full_name,p.patient_code,p.room_bed||'-',p.admission_date||p.created_at]),
  ...s.discharges.map(p=>['Discharge',p.full_name,p.patient_code,p.room_bed||'-',p.discharge_date])
 ]));
 if(section==='all'||section==='clinical')parts.push(reportTable('Clinical Alerts & Abnormal Vitals',['Patient','Parameter / Reading','Severity','Status','Date'],[
  ...s.periodAlerts.map(x=>[pname(x.patient_id),`${x.parameter}: ${x.value} ${x.unit||''}`,x.severity,x.status,x.created_at]),
  ...s.periodVitals.filter(x=>x.alert_level&&x.alert_level!=='Normal').map(x=>[pname(x.patient_id),`Temp ${x.temperature??'-'}, Pulse ${x.pulse??'-'}, SpO₂ ${x.spo2??'-'}%`,x.alert_level,'Recorded',x.recorded_at])
 ]));
 if(section==='all'||section==='care')parts.push(reportTable('Daily Care Activity',['Patient','Activity','Status','Employee','Date'],s.periodCare.map(x=>[pname(x.patient_id),x.activity,x.status,staffName(x.recorded_by),x.recorded_at])));
 if(section==='all'||section==='medicines')parts.push(reportTable('Medicine Administration',['Patient','Medicine','Scheduled','Status','Recorded'],s.periodMeds.map(x=>[pname(x.patient_id),x.medicine,x.scheduled_time||'-',x.status,x.administered_at||x.created_at])));
 if(section==='all'||section==='incidents')parts.push(reportTable('Incidents & Issues',['No.','Patient','Type','Status','Date'],s.periodIncidents.map(x=>[x.incident_no,pname(x.patient_id),x.incident_type,x.status,x.incident_at])));
 if(section==='all'||section==='finance')parts.push(reportTable('Charges, Payments & Discounts',['Patient','Type','Amount','Description','Raised By','Date'],s.periodBilling.map(x=>[pname(x.patient_id),x.transaction_type,`₹${Number(x.amount||0).toLocaleString('en-IN')}`,x.description||'-',staffName(x.recorded_by),x.recorded_at])));
 if(section==='all'||section==='finance')parts.push(reportTable('Pending Payments',['Patient','Room','Referred By','Contact','Outstanding'],patients.filter(p=>Number(p.outstanding||0)>0).map(p=>[p.full_name,p.room_bed||'-',p.referred_by||'-',p.reference_contact||p.emergency_contact||'-',`₹${Number(p.outstanding).toLocaleString('en-IN')}`])));
 return parts.join('')
}
function reportTable(title,heads,rows){return `<div class="card report-table"><h3>${esc(title)}</h3><div class="table-wrap"><table><thead><tr>${heads.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map((v,i)=>`<td>${i===r.length-1&&String(v).match(/^\d{4}-\d{2}-\d{2}|T/)?new Date(v).toLocaleString('en-IN'):esc(v??'-')}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${heads.length}">No records for this period</td></tr>`}</tbody></table></div></div>`}
function patientOptions(){return patients.filter(x=>x.status==='Active').map(p=>`<option value="${p.id}">${esc(p.full_name)} · ${esc(p.room_bed||'-')}</option>`).join('')}
function modal(html){$('modalRoot').innerHTML=`<div class="modal"><div class="modal-card">${html}</div></div>`;document.querySelector('.close')?.addEventListener('click',closeModal)}function closeModal(){$('modalRoot').innerHTML=''}
function field(label,id,type='text',value=''){return `<div class="field"><label>${label}</label><input id="${id}" type="${type}" value="${esc(value)}"></div>`}function select(label,id,values){return `<div class="field"><label>${label}</label><select id="${id}">${values.map(v=>`<option>${esc(v)}</option>`).join('')}</select></div>`}function selectWithValue(label,id,values,value=''){return `<div class="field"><label>${label}</label><select id="${id}">${values.map(v=>`<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(v)}</option>`).join('')}</select></div>`}function patientSelect(id){return `<div class="field"><label>Patient</label><select id="${id}">${patientOptions()}</select></div>`}
function openPatient(){modal(`<div class="modal-head"><h3>Add Patient</h3><button class="close">×</button></div><div class="form-grid">${field('Full Name','p_name')}${field('Age','p_age','number')}${select('Gender','p_gender',['Male','Female','Other'])}<div class="field"><label>Room / Bed</label><select id="p_room"><option value="">Select room</option>${rooms.filter(r=>r.status==='Available'&&!patients.some(p=>p.room_bed===`${r.room_no}-${r.bed_no}`&&p.status==='Active')).map(r=>`<option>${esc(r.room_no)}-${esc(r.bed_no)}</option>`).join('')}</select></div>${field('Admission Date','p_date','date')}<div class="field"><label>Care Level</label><select id="p_care"><option>Independent</option><option selected>Assisted</option><option>High Dependency</option></select></div><div class="field full"><label>Diagnosis</label><textarea id="p_diag"></textarea></div>${field('Emergency Contact','p_contact')}${field('Referred By','p_referred')}${field('Reference Contact Number','p_reference_contact','tel')}<div class="full right"><button class="btn btn-primary" id="savePatient">Save Patient</button></div></div>`);$('savePatient').onclick=savePatient}
async function savePatient(){try{const code=`P${String(patients.length+1).padStart(4,'0')}`;const {error}=await db.from('patients').insert({patient_code:code,full_name:$('p_name').value.trim(),age:Number($('p_age').value)||null,gender:$('p_gender').value,room_bed:$('p_room').value.trim(),admission_date:$('p_date').value||null,diagnosis:$('p_diag').value.trim(),emergency_contact:$('p_contact').value.trim(),referred_by:$('p_referred').value.trim(),reference_contact:$('p_reference_contact').value.trim(),care_level:$('p_care').value,created_by:me.id});if(error)throw error;closeModal()}catch(e){showError(e)}}

function dashboardDetailRows(type){
 if(type==='beds')return rooms.map(r=>[`${r.room_no}-${r.bed_no}`,r.room_type||'-',r.status,patients.find(p=>p.room_bed===`${r.room_no}-${r.bed_no}`&&p.status==='Active')?.full_name||'-']);
 if(type==='occupied')return patients.filter(p=>p.status==='Active').map(p=>[p.full_name,p.patient_code,p.room_bed||'-',p.care_level||'-']);
 if(type==='critical'||type==='warnings'||type==='all-alerts')return clinicalAlerts.filter(a=>!['Resolved','Closed'].includes(a.status)&&(type==='all-alerts'||a.severity===(type==='critical'?'Critical':'Warning'))).map(a=>[pname(a.patient_id),a.parameter,`${a.value} ${a.unit||''}`,a.severity,a.status,new Date(a.created_at).toLocaleString('en-IN')]);
 if(type==='medicines')return meds.filter(x=>x.status==='Pending').map(x=>[pname(x.patient_id),x.medicine,x.scheduled_time||'-',x.status]);
 if(type==='outstanding')return patients.filter(p=>Number(p.outstanding||0)>0).map(p=>[p.full_name,p.room_bed||'-',p.reference_contact||p.emergency_contact||'-',`₹${Number(p.outstanding).toLocaleString('en-IN')}`]);
 if(type==='incidents')return incidents.filter(x=>x.status!=='Closed').map(x=>[x.incident_no,pname(x.patient_id),x.incident_type,x.status,new Date(x.incident_at).toLocaleString('en-IN')]);
 if(type==='activity')return [...care,...vitals].sort((a,b)=>new Date(b.recorded_at)-new Date(a.recorded_at)).slice(0,50).map(x=>[pname(x.patient_id),x.activity||`Vitals: Temp ${x.temperature||'-'}, Pulse ${x.pulse||'-'}, SpO₂ ${x.spo2||'-'}%`,staffName(x.recorded_by),new Date(x.recorded_at).toLocaleString('en-IN')]);
 return []
}
function openDashboardDetail(type){const meta={beds:['Room & Bed Details',['Room/Bed','Type','Status','Patient']],occupied:['Occupied Beds',['Patient','ID','Room','Care Level']],critical:['Critical Clinical Alerts',['Patient','Parameter','Value','Severity','Status','Date']],warnings:['Clinical Warnings',['Patient','Parameter','Value','Severity','Status','Date']],['all-alerts']:['All Open Clinical Alerts',['Patient','Parameter','Value','Severity','Status','Date']],medicines:['Pending Medicines',['Patient','Medicine','Scheduled Time','Status']],outstanding:['Pending Payments',['Patient','Room','Contact','Outstanding']],incidents:['Open Incidents',['Incident No.','Patient','Type','Status','Date']],activity:['Recent Care & Clinical Activity',['Patient','Details','Employee','Date']]};const [title,heads]=meta[type]||['Details',['Details']],rows=dashboardDetailRows(type);modal(`<div class="modal-head"><div><h3>${esc(title)}</h3><div class="muted">${rows.length} record(s)</div></div><button class="close">×</button></div><div class="modal-actions"><button class="btn btn-secondary" id="printDetail">Print / PDF</button></div>${reportTable('',heads,rows)}`);$('printDetail').onclick=()=>window.print()}
function updateReportPreview(){const {from,to}=reportDateRange(),section=$('reportSection')?.value||'all';if(from>to)return alert('From date cannot be after To date.');$('reportPreview').innerHTML=reportPreviewHtml(from,to,section)}
function openReportDetail(type){const {from,to}=reportDateRange(),s=reportStats(from,to);const map={admissions:['New Admissions',['Patient','ID','Room','Admission Date'],s.admissions.map(p=>[p.full_name,p.patient_code,p.room_bed||'-',p.admission_date||p.created_at])],discharges:['Discharges',['Patient','ID','Room','Discharge Date'],s.discharges.map(p=>[p.full_name,p.patient_code,p.room_bed||'-',p.discharge_date])],alerts:['Clinical Alerts',['Patient','Parameter','Value','Severity','Status','Date'],s.periodAlerts.map(x=>[pname(x.patient_id),x.parameter,`${x.value} ${x.unit||''}`,x.severity,x.status,x.created_at])],incidents:['Incidents',['No.','Patient','Type','Status','Date'],s.periodIncidents.map(x=>[x.incident_no,pname(x.patient_id),x.incident_type,x.status,x.incident_at])],care:['Care Records',['Patient','Activity','Status','Employee','Date'],s.periodCare.map(x=>[pname(x.patient_id),x.activity,x.status,staffName(x.recorded_by),x.recorded_at])],medicines:['Medicine Records',['Patient','Medicine','Status','Time'],s.periodMeds.map(x=>[pname(x.patient_id),x.medicine,x.status,x.administered_at||x.created_at])],payments:['Payments Received',['Patient','Amount','Mode','Reference','Received By','Date'],s.periodBilling.filter(x=>x.transaction_type==='Payment').map(x=>[pname(x.patient_id),`₹${Number(x.amount).toLocaleString('en-IN')}`,x.payment_mode||'-',x.reference_no||x.receipt_no||'-',staffName(x.recorded_by),x.recorded_at])],pending:['Outstanding Payments',['Patient','Room','Contact','Outstanding'],patients.filter(p=>Number(p.outstanding||0)>0).map(p=>[p.full_name,p.room_bed||'-',p.reference_contact||p.emergency_contact||'-',`₹${Number(p.outstanding).toLocaleString('en-IN')}`])]};const [title,heads,rows]=map[type]||['Report Details',['Details'],[]];modal(`<div class="modal-head"><div><h3>${esc(title)}</h3><div class="muted">${from} to ${to}</div></div><button class="close">×</button></div><div class="modal-actions"><button class="btn btn-secondary" id="printDetail">Print / PDF</button></div>${reportTable('',heads,rows)}`);$('printDetail').onclick=()=>window.print()}
function openSimple(kind){const forms={care:`${patientSelect('x_patient')}${select('Activity','x_a',['Oral Care','Bathing','Dress Change','Diaper Change','Feeding Assistance','Toileting','Position Change','Walking Support'])}${select('Status','x_s',['Completed','Pending','Patient Refused','Not Applicable'])}${field('Remarks','x_r')}`,vitals:`${patientSelect('x_patient')}${field('Temperature','x_temp','number')}${select('Temperature Unit','x_temp_unit',['°F','°C'])}${field('Pulse (beats/min)','x_pulse','number')}${field('Respiration (breaths/min)','x_resp','number')}${field('SpO₂ (%)','x_spo','number')}${select('Blood Sugar Type','x_sugar_type',['','FBS','PPBS','RBS'])}${field('Blood Sugar (mg/dL)','x_sugar','number')}<div class="field full"><label>Symptoms / Remarks</label><textarea id="x_remarks"></textarea></div>`,medicine:`${patientSelect('x_patient')}${field('Medicine','x_med')}${field('Scheduled Time','x_time','time')}${select('Status','x_s',['Pending','Given','Refused','Withheld'])}`,meal:`${patientSelect('x_patient')}${select('Meal','x_meal',['Breakfast','Lunch','Evening Snack','Dinner'])}${select('Diet','x_diet',['Normal','Diabetic','Soft','Liquid','Renal','High Protein'])}${select('Consumption','x_cons',['Fully Consumed','Partially Consumed','Refused','Not Served'])}`,billing:`${patientSelect('x_patient')}${select('Type','x_type',['Charge','Payment','Discount'])}${field('Amount (₹)','x_amount','number')}${field('Description','x_desc')}${select('Payment Mode','x_mode',['Cash','UPI','Bank Transfer','Card','Cheque','Other'])}${field('Transaction / Receipt Reference','x_ref')}${field('Discount Reason','x_discount_reason')}`};modal(`<div class="modal-head"><h3>New Entry</h3><button class="close">×</button></div><div class="form-grid">${forms[kind]}<div class="full right"><button class="btn btn-primary" id="saveSimple">Save</button></div></div>`);$('saveSimple').onclick=()=>saveSimple(kind)}
function assessVitals(v){
 const findings=[]; const tempF=v.temperature_unit==='°C'?(Number(v.temperature)*9/5+32):Number(v.temperature);
 if(v.temperature!==null&&!Number.isNaN(tempF)){if(tempF<95||tempF>=103)findings.push(['Temperature',v.temperature,v.temperature_unit,'Critical']);else if(tempF<96.8||tempF>=100.4)findings.push(['Temperature',v.temperature,v.temperature_unit,'Warning'])}
 if(v.pulse!==null){if(v.pulse<40||v.pulse>140)findings.push(['Pulse',v.pulse,'bpm','Critical']);else if(v.pulse<50||v.pulse>120)findings.push(['Pulse',v.pulse,'bpm','Warning'])}
 if(v.respiration!==null){if(v.respiration<8||v.respiration>30)findings.push(['Respiration',v.respiration,'/min','Critical']);else if(v.respiration<10||v.respiration>24)findings.push(['Respiration',v.respiration,'/min','Warning'])}
 if(v.spo2!==null){if(v.spo2<88)findings.push(['SpO₂',v.spo2,'%','Critical']);else if(v.spo2<92)findings.push(['SpO₂',v.spo2,'%','Warning'])}
 if(v.blood_sugar_value!==null){if(v.blood_sugar_value<54||v.blood_sugar_value>=400)findings.push([v.blood_sugar_type||'Blood Sugar',v.blood_sugar_value,'mg/dL','Critical']);else if(v.blood_sugar_value<70||v.blood_sugar_value>=250)findings.push([v.blood_sugar_type||'Blood Sugar',v.blood_sugar_value,'mg/dL','Warning'])}
 return findings;
}
async function saveSimple(k){try{let table,obj;if(k==='care'){table='care_records';obj={patient_id:$('x_patient').value,activity:$('x_a').value,status:$('x_s').value,remarks:$('x_r').value,recorded_by:me.id}}if(k==='vitals'){table='vital_signs';obj={patient_id:$('x_patient').value,temperature:$('x_temp').value===''?null:Number($('x_temp').value),temperature_unit:$('x_temp_unit').value,pulse:$('x_pulse').value===''?null:Number($('x_pulse').value),respiration:$('x_resp').value===''?null:Number($('x_resp').value),spo2:$('x_spo').value===''?null:Number($('x_spo').value),blood_sugar_type:$('x_sugar_type').value||null,blood_sugar_value:$('x_sugar').value===''?null:Number($('x_sugar').value),remarks:$('x_remarks').value,recorded_by:me.id};const findings=assessVitals(obj);obj.alert_level=findings.some(f=>f[3]==='Critical')?'Critical':findings.length?'Warning':'Normal';obj._findings=findings}if(k==='medicine'){table='medicine_records';obj={patient_id:$('x_patient').value,medicine:$('x_med').value,scheduled_time:$('x_time').value||null,status:$('x_s').value,recorded_by:me.id}}if(k==='meal'){table='meal_records';obj={patient_id:$('x_patient').value,meal_type:$('x_meal').value,diet_type:$('x_diet').value,consumption:$('x_cons').value,recorded_by:me.id}}if(k==='billing'){table='billing_transactions';const typ=$('x_type').value;obj={patient_id:$('x_patient').value,transaction_type:typ,amount:Number($('x_amount').value),description:$('x_desc').value,payment_mode:typ==='Payment'?$('x_mode').value:null,reference_no:$('x_ref').value,receipt_no:typ==='Payment'?`RCPT-${Date.now()}`:null,discount_reason:typ==='Discount'?$('x_discount_reason').value:null,discount_status:typ==='Discount'?(me.role==='Admin'||me.role==='Manager'?'Approved':'Pending'):null,discount_approved_by:typ==='Discount'&&(me.role==='Admin'||me.role==='Manager')?me.id:null,recorded_by:me.id}}const findings=obj._findings||[];delete obj._findings;const {data:inserted,error}=await db.from(table).insert(obj).select().single();if(error)throw error;if(k==='vitals'&&findings.length){for(const f of findings){await db.from('clinical_alerts').insert({patient_id:obj.patient_id,vital_sign_id:inserted.id,parameter:f[0],value:String(f[1]),unit:f[2],severity:f[3],status:'New',created_by:me.id});await queueNotification('ABNORMAL_VITAL',obj.patient_id,`${f[3]} ${f[0]} alert`,`${pname(obj.patient_id)} (${patients.find(p=>p.id===obj.patient_id)?.room_bed||'-'}): ${f[0]} ${f[1]} ${f[2]}. Recorded by ${me.full_name}.`)}}if(k==='billing'){const p=patients.find(x=>x.id===obj.patient_id);const delta=obj.transaction_type==='Charge'?obj.amount:obj.transaction_type==='Payment'?-obj.amount:obj.discount_status==='Approved'?-obj.amount:0;const newOutstanding=Math.max(0,Number(p.outstanding||0)+delta);const {error:pe}=await db.from('patients').update({outstanding:newOutstanding}).eq('id',p.id);if(pe)throw pe;if(obj.transaction_type==='Charge')await queueNotification('BILL_RAISED',obj.patient_id,'New charge added',`Samara Care: A charge of ₹${obj.amount.toLocaleString('en-IN')} has been added for ${p.full_name}. Current outstanding: ₹${newOutstanding.toLocaleString('en-IN')}.`);if(obj.transaction_type==='Payment')await queueNotification('PAYMENT_RECEIVED',obj.patient_id,'Payment received',`Samara Care: Payment of ₹${obj.amount.toLocaleString('en-IN')} received for ${p.full_name}. Balance outstanding: ₹${newOutstanding.toLocaleString('en-IN')}.`)}closeModal()}catch(e){showError(e)}}
function openRoomBed(id=''){const r=id?rooms.find(x=>x.id===id):{};modal(`<div class="modal-head"><h3>${id?'Edit':'Add'} Room / Bed</h3><button class="close">×</button></div><div class="form-grid">${field('Room Number','r_room','text',r.room_no||'')}${field('Bed Label','r_bed','text',r.bed_no||'A')}${select('Room Type','r_type',['Private','Twin Sharing','Triple Sharing','General'])}${field('Daily Rate (₹)','r_rate','number',r.daily_rate||0)}${select('Status','r_status',['Available','Reserved','Maintenance','Inactive'])}<div class="full right"><button class="btn btn-primary" id="saveRoom">Save</button></div></div>`);$('r_type').value=r.room_type||'Private';$('r_status').value=r.status||'Available';$('saveRoom').onclick=()=>saveRoomBed(id)}
async function saveRoomBed(id){try{const obj={room_no:$('r_room').value.trim(),bed_no:$('r_bed').value.trim(),room_type:$('r_type').value,daily_rate:Number($('r_rate').value)||0,status:$('r_status').value,updated_by:me.id};if(!obj.room_no||!obj.bed_no)throw new Error('Room number and bed label are required.');const q=id?db.from('rooms_beds').update(obj).eq('id',id):db.from('rooms_beds').insert(obj);const {error}=await q;if(error)throw error;closeModal()}catch(e){showError(e)}}
function openPaymentHistory(pid){const p=patients.find(x=>x.id===pid),rows=billing.filter(x=>x.patient_id===pid).sort((a,b)=>new Date(a.recorded_at)-new Date(b.recorded_at));let balance=0;const body=rows.map(x=>{const effective=x.transaction_type==='Charge'?Number(x.amount):x.transaction_type==='Payment'?-Number(x.amount):x.discount_status==='Approved'?-Number(x.amount):0;balance=Math.max(0,balance+effective);return `<tr><td>${new Date(x.recorded_at).toLocaleString('en-IN')}</td><td>${esc(x.transaction_type)}</td><td>${esc(x.description||'-')}</td><td>₹${Number(x.amount).toLocaleString('en-IN')}</td><td>${esc(staffName(x.recorded_by))}</td><td>₹${balance.toLocaleString('en-IN')}</td></tr>`}).join('');modal(`<div class="modal-head"><div><h3>${esc(p.full_name)} — Payment History</h3><div class="muted">${esc(p.patient_code)} · ${esc(p.referred_by||'No referral')}</div></div><button class="close">×</button></div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Amount</th><th>Raised By</th><th>Running Balance</th></tr></thead><tbody>${body||'<tr><td colspan="6">No transactions</td></tr>'}</tbody></table></div><div class="right" style="margin-top:12px"><button class="btn btn-primary" onclick="printFullBill('${pid}')">Print / PDF Full Bill</button></div>`)}
function printFullBill(pid){const p=patients.find(x=>x.id===pid),rows=billing.filter(x=>x.patient_id===pid).sort((a,b)=>new Date(a.recorded_at)-new Date(b.recorded_at)),charges=rows.filter(x=>x.transaction_type==='Charge').reduce((a,x)=>a+Number(x.amount),0),payments=rows.filter(x=>x.transaction_type==='Payment').reduce((a,x)=>a+Number(x.amount),0),discounts=rows.filter(x=>x.transaction_type==='Discount'&&x.discount_status==='Approved').reduce((a,x)=>a+Number(x.amount),0),net=Math.max(0,charges-payments-discounts);const w=window.open('','_blank');w.document.write(`<html><head><title>Full Bill - ${esc(p.full_name)}</title><style>body{font-family:Arial;padding:30px;color:#17201e}h1{color:#0b6656}table{width:100%;border-collapse:collapse;margin-top:15px}th,td{border:1px solid #bbb;padding:8px;text-align:left}.sum{width:420px;margin-left:auto;margin-top:20px}.sum td{font-weight:700}.muted{color:#666}.sign{margin-top:50px;display:flex;justify-content:space-between}@media print{button{display:none}}</style></head><body><h1>Samara Care</h1><h3>Full Bill with Charges, Payments and Discounts</h3><p><b>Patient:</b> ${esc(p.full_name)} &nbsp; <b>ID:</b> ${esc(p.patient_code)}<br><b>Room/Bed:</b> ${esc(p.room_bed||'-')} &nbsp; <b>Admission:</b> ${esc(p.admission_date||'-')}<br><b>Referred By:</b> ${esc(p.referred_by||'-')} &nbsp; <b>Reference Contact:</b> ${esc(p.reference_contact||'-')}</p><table><thead><tr><th>Date</th><th>Particulars</th><th>Type</th><th>Amount</th><th>Raised By</th><th>Discount Approval</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${new Date(x.recorded_at).toLocaleString('en-IN')}</td><td>${esc(x.description||'-')}</td><td>${esc(x.transaction_type)}</td><td>₹${Number(x.amount).toLocaleString('en-IN')}</td><td>${esc(staffName(x.recorded_by))} (${esc(profiles.find(q=>q.id===x.recorded_by)?.role||'')})</td><td>${x.transaction_type==='Discount'?`${esc(x.discount_status||'Pending')} by ${esc(staffName(x.discount_approved_by))}<br>${esc(x.discount_reason||'')}`:'-'}</td></tr>`).join('')}</tbody></table><table class="sum"><tr><td>Gross Charges</td><td>₹${charges.toLocaleString('en-IN')}</td></tr><tr><td>Approved Discounts</td><td>- ₹${discounts.toLocaleString('en-IN')}</td></tr><tr><td>Payments Received</td><td>- ₹${payments.toLocaleString('en-IN')}</td></tr><tr><td>Net Outstanding</td><td>₹${net.toLocaleString('en-IN')}</td></tr></table><p class="muted">Printed on ${new Date().toLocaleString('en-IN')} by ${esc(me.full_name)} (${esc(me.role)}). Confidential patient financial record.</p><div class="sign"><span>Prepared / Printed By</span><span>Approved By</span><span>Patient / Attendant</span></div><script>window.onload=()=>window.print()</script></body></html>`);w.document.close()}
async function approveDiscount(id){try{const x=billing.find(b=>b.id===id);const {error}=await db.from('billing_transactions').update({discount_status:'Approved',discount_approved_by:me.id,discount_approved_at:new Date().toISOString()}).eq('id',id);if(error)throw error;const p=patients.find(q=>q.id===x.patient_id);await db.from('patients').update({outstanding:Math.max(0,Number(p.outstanding||0)-Number(x.amount))}).eq('id',p.id)}catch(e){showError(e)}}
function bindBillingButtons(){document.querySelectorAll('.approve-discount').forEach(b=>b.onclick=()=>approveDiscount(b.dataset.id));document.querySelectorAll('.print-bill').forEach(b=>b.onclick=()=>printFullBill(b.dataset.id))}
function openEmployee(){modal(`<div class="modal-head"><h3>Create Employee</h3><button class="close">×</button></div><div class="form-grid">${field('Name','e_name')}${field('Employee ID','e_emp')}${field('Designation','e_designation')}${select('Role','e_role',['Admin','Manager','Nurse','Caregiver','Accounts','Kitchen'])}${field('Mobile','e_mobile')}${field('Emergency Contact','e_emergency')}${field('Date of Birth','e_dob','date')}${select('Gender','e_gender',['','Male','Female','Other'])}${field('Date of Joining','e_joining','date')}${field('Qualification','e_qualification')}${field('Login ID','e_login')}${field('Employee Email','e_email','email')}<div class="field full"><label>Address</label><textarea id="e_address"></textarea></div>${field('Temporary Password','e_password','password')}<div class="full notice"><b>Login:</b> The employee signs in using the Login ID. Personal records and certificates remain Administrator-only.</div><div class="full right"><button class="btn btn-primary" id="createEmployee">Create</button></div></div>`);$('createEmployee').onclick=createEmployee}
async function createEmployee(){const btn=$('createEmployee');btn.disabled=true;btn.textContent='Creating…';let tempClient;try{const login=$('e_login').value.trim().toLowerCase(),email=$('e_email').value.trim().toLowerCase(),password=$('e_password').value,name=$('e_name').value.trim();if(!login||!email||!password||!name)throw new Error('Name, Login ID, employee email and password are required.');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Enter a valid employee email address.');if(password.length<6)throw new Error('Password must contain at least 6 characters.');if(profiles.some(x=>x.login_id===login))throw new Error('That Login ID already exists.');if(profiles.some(x=>String(x.auth_email||'').toLowerCase()===email))throw new Error('That email address is already assigned to an employee.');tempClient=window.supabase.createClient(CFG.supabaseUrl,CFG.supabasePublishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:`samara-create-${Date.now()}`}});const {data,error}=await tempClient.auth.signUp({email,password,options:{data:{login_id:login,full_name:name}}});if(error)throw error;if(!data.user)throw new Error('Supabase did not create the employee account. Confirm that Email provider is enabled and Confirm email is disabled.');const {error:rpcError}=await db.rpc('samara_admin_save_employee',{p_user_id:data.user.id,p_login_id:login,p_auth_email:email,p_full_name:name,p_role:$('e_role').value,p_employee_id:$('e_emp').value,p_mobile:$('e_mobile').value,p_active:true});if(rpcError)throw rpcError;const {error:addressError}=await db.from('profiles').update({address:$('e_address').value.trim(),designation:$('e_designation').value.trim()||null,emergency_contact:$('e_emergency').value.trim()||null,date_of_birth:$('e_dob').value||null,gender:$('e_gender').value||null,date_of_joining:$('e_joining').value||null,qualification:$('e_qualification').value.trim()||null}).eq('id',data.user.id);if(addressError)throw addressError;await tempClient.auth.signOut();closeModal();await loadAll();render();alert('Employee created successfully. The employee can sign in using the Login ID from any authorised device.')}catch(e){showError(e)}finally{btn.disabled=false;btn.textContent='Create'}}

async function employeeSignedUrl(path){if(!path)return '';const {data,error}=await db.storage.from('patient-documents').createSignedUrl(path,900);if(error)throw error;return data.signedUrl}
async function openEmployeeProfile(id){
 if(me.role!=='Admin')return showError(new Error('Administrator access required.'));
 const e=profiles.find(x=>x.id===id);if(!e)return;
 const docs=employeeDocuments.filter(x=>x.employee_id===id);const photo=docs.find(x=>x.category==='Employee Photograph');let photoUrl='';try{photoUrl=await employeeSignedUrl(photo?.storage_path)}catch{}
 modal(`<div class="modal-head"><div><h3>Employee Profile</h3><div class="muted">Confidential Administrator-only record</div></div><button class="close">×</button></div><div class="employee-profile-hero"><div class="employee-photo-panel">${photoUrl?`<img src="${photoUrl}" class="employee-profile-photo" alt="${esc(e.full_name)}">`:`<div class="employee-photo-placeholder">${esc(e.full_name?.[0]||'E')}<small>No Photo</small></div>`}<div class="photo-direct-actions"><button class="btn btn-primary btn-small" id="employeeWebcam">📷 Webcam</button><button class="btn btn-secondary btn-small" id="employeeMobilePhoto">📱 Mobile Camera</button><button class="btn btn-secondary btn-small" id="employeeChoosePhoto">📁 Choose Photo</button></div><input class="hidden-file-input" id="employeeCameraInput" type="file" accept="image/*" capture="user"><input class="hidden-file-input" id="employeePhotoInput" type="file" accept="image/*"></div><div class="employee-summary"><h2>${esc(e.full_name)}</h2><p>${esc(e.designation||e.role)} · ${esc(e.employee_id||'No Employee ID')}</p><div class="summary-grid"><div><b>Role</b>${esc(e.role)}</div><div><b>Status</b>${e.active?'Active':'Inactive'}</div><div><b>Mobile</b>${esc(e.mobile||'-')}</div><div><b>Email</b>${esc(e.auth_email||'-')}</div><div><b>DOB / Gender</b>${esc(e.date_of_birth||'-')} / ${esc(e.gender||'-')}</div><div><b>Joining Date</b>${esc(e.date_of_joining||'-')}</div><div><b>Qualification</b>${esc(e.qualification||'-')}</div><div><b>Emergency Contact</b>${esc(e.emergency_contact||'-')}</div></div><div class="card" style="margin-top:12px"><b>Address</b><p>${esc(e.address||'-')}</p></div><div class="right" style="margin-top:12px"><button class="btn btn-primary" id="editEmployeeProfile">Edit Profile</button></div></div></div><div class="card employee-certificates" style="margin-top:18px"><div class="page-head"><div><h3>Certificates & Documents</h3><div class="muted">Qualification, registration, ID, experience and employment records</div></div><button class="btn btn-primary btn-small" id="uploadEmployeeDocument">+ Upload Certificate</button></div><div class="table-wrap"><table><thead><tr><th>Category</th><th>Title</th><th>Document Date</th><th>Remarks</th><th>Uploaded</th><th>Action</th></tr></thead><tbody>${docs.filter(d=>d.category!=='Employee Photograph').map(d=>`<tr><td>${esc(d.category)}</td><td>${esc(d.title)}</td><td>${esc(d.document_date||'-')}</td><td>${esc(d.remarks||'-')}</td><td>${new Date(d.uploaded_at).toLocaleString('en-IN')}</td><td><button class="btn btn-secondary btn-small view-employee-doc" data-path="${esc(d.storage_path)}">View</button></td></tr>`).join('')||'<tr><td colspan="6">No certificates uploaded</td></tr>'}</tbody></table></div></div>`,'employee-profile-modal');
 $('employeeWebcam').onclick=()=>openEmployeeWebcam(id);$('employeeMobilePhoto').onclick=()=>$('employeeCameraInput').click();$('employeeChoosePhoto').onclick=()=>$('employeePhotoInput').click();$('employeeCameraInput').onchange=()=>$('employeeCameraInput').files?.[0]&&uploadEmployeeFile(id,$('employeeCameraInput').files[0],'Employee Photograph','Employee Photograph');$('employeePhotoInput').onchange=()=>$('employeePhotoInput').files?.[0]&&uploadEmployeeFile(id,$('employeePhotoInput').files[0],'Employee Photograph','Employee Photograph');$('uploadEmployeeDocument').onclick=()=>openEmployeeDocument(id);$('editEmployeeProfile').onclick=()=>openEditEmployee(id);document.querySelectorAll('.view-employee-doc').forEach(b=>b.onclick=async()=>window.open(await employeeSignedUrl(b.dataset.path),'_blank'))
}
function openEditEmployee(id){const e=profiles.find(x=>x.id===id);if(!e)return;modal(`<div class="modal-head"><h3>Edit Employee Profile</h3><button class="close">×</button></div><div class="form-grid">${field('Name','ee_name','text',e.full_name||'')}${field('Employee ID','ee_emp','text',e.employee_id||'')}${field('Designation','ee_designation','text',e.designation||'')}${selectWithValue('Role','ee_role',['Admin','Manager','Nurse','Caregiver','Accounts','Kitchen'],e.role)}${field('Mobile','ee_mobile','text',e.mobile||'')}${field('Emergency Contact','ee_emergency','text',e.emergency_contact||'')}${field('Date of Birth','ee_dob','date',e.date_of_birth||'')}${selectWithValue('Gender','ee_gender',['','Male','Female','Other'],e.gender||'')}${field('Date of Joining','ee_joining','date',e.date_of_joining||'')}${field('Qualification','ee_qualification','text',e.qualification||'')}<div class="field full"><label>Address</label><textarea id="ee_address">${esc(e.address||'')}</textarea></div><div class="full right"><button class="btn btn-primary" id="saveEmployeeProfile">Save Profile</button></div></div>`);$('saveEmployeeProfile').onclick=async()=>{try{const {error}=await db.from('profiles').update({full_name:$('ee_name').value.trim(),employee_id:$('ee_emp').value.trim()||null,designation:$('ee_designation').value.trim()||null,role:$('ee_role').value,mobile:$('ee_mobile').value.trim()||null,emergency_contact:$('ee_emergency').value.trim()||null,date_of_birth:$('ee_dob').value||null,gender:$('ee_gender').value||null,date_of_joining:$('ee_joining').value||null,qualification:$('ee_qualification').value.trim()||null,address:$('ee_address').value.trim()||null}).eq('id',id);if(error)throw error;await loadAll();closeModal();alert('Employee profile updated successfully.');openEmployeeProfile(id)}catch(e){showError(e)}}}
function openEmployeeDocument(id){modal(`<div class="modal-head"><h3>Upload Employee Certificate</h3><button class="close">×</button></div><div class="form-grid">${select('Category','ed_category',['Educational Certificate','Professional Registration','Experience Certificate','Aadhaar / ID Proof','PAN','Employment Contract','Medical Fitness','Training Certificate','Other'])}${field('Document Title','ed_title')}${field('Document Date','ed_date','date')}<div class="field full"><label>Remarks</label><textarea id="ed_remarks"></textarea></div><div class="field full"><label>File</label><input id="ed_file" type="file" accept="image/*,.pdf,.doc,.docx"></div><div class="full right"><button class="btn btn-primary" id="saveEmployeeDocument">Upload</button></div></div>`);$('saveEmployeeDocument').onclick=async()=>{const f=$('ed_file').files?.[0];if(!f)return showError(new Error('Choose a certificate or document.'));await uploadEmployeeFile(id,f,$('ed_category').value,$('ed_title').value.trim()||$('ed_category').value,$('ed_date').value,$('ed_remarks').value.trim())}}
async function uploadEmployeeFile(id,file,category,title,documentDate='',remarks=''){try{const f=file.type.startsWith('image/')?await compressDocumentImage(file):file;if(f.size>15*1024*1024)throw new Error('File exceeds the 15 MB limit.');const safe=(f.name||`employee-file-${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g,'_'),path=`employees/${id}/${Date.now()}-${safe}`;const {error:up}=await db.storage.from('patient-documents').upload(path,f,{contentType:f.type||undefined});if(up)throw up;const {error}=await db.from('employee_documents').insert({employee_id:id,category,title,document_date:documentDate||new Date().toISOString().slice(0,10),storage_path:path,file_name:f.name||safe,mime_type:f.type||null,file_size:f.size,remarks:remarks||null,uploaded_by:me.id});if(error){await db.storage.from('patient-documents').remove([path]);throw error}await loadAll();closeModal();alert(category==='Employee Photograph'?'Employee photo uploaded successfully.':'Employee document uploaded successfully.');openEmployeeProfile(id)}catch(e){showError(e)}}
async function openEmployeeWebcam(id){if(!navigator.mediaDevices?.getUserMedia)return showError(new Error('Webcam is not available in this browser.'));modal(`<div class="modal-head"><h3>Capture Employee Photo</h3><button class="close">×</button></div><div class="patient-camera-capture"><video id="employeeWebcamVideo" autoplay playsinline></video><canvas id="employeeWebcamCanvas" class="hidden"></canvas><div class="camera-guide">Ask the employee to face the camera. Keep the face centred and use even lighting.</div><div class="right"><button class="btn btn-primary" id="captureEmployeePhoto">Capture & Upload</button></div></div>`);let stream;try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:1280}},audio:false});$('employeeWebcamVideo').srcObject=stream;const stop=()=>stream?.getTracks().forEach(t=>t.stop());document.querySelector('.modal .close').addEventListener('click',stop,{once:true});$('captureEmployeePhoto').onclick=async()=>{const v=$('employeeWebcamVideo'),c=$('employeeWebcamCanvas'),size=Math.min(v.videoWidth,v.videoHeight),sx=(v.videoWidth-size)/2,sy=(v.videoHeight-size)/2;c.width=700;c.height=700;c.getContext('2d').drawImage(v,sx,sy,size,size,0,0,700,700);const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.9));stop();if(blob)await uploadEmployeeFile(id,new File([blob],`employee-photo-${Date.now()}.jpg`,{type:'image/jpeg'}),'Employee Photograph','Employee Photograph')}}catch(e){showError(new Error('Camera permission was not granted or the webcam is unavailable.'))}}

async function toggleEmployee(id,active){try{const {error}=await db.rpc('samara_admin_set_employee_active',{p_user_id:id,p_active:active});if(error)throw error;await loadAll();render()}catch(e){showError(e)}}
function bindPageActions(){$('addPatient')?.addEventListener('click',openPatient);$('addCare')?.addEventListener('click',()=>openSimple('care'));$('addVitals')?.addEventListener('click',()=>openSimple('vitals'));$('addMedicine')?.addEventListener('click',()=>openSimple('medicine'));$('addMeal')?.addEventListener('click',()=>openSimple('meal'));$('addBilling')?.addEventListener('click',()=>openSimple('billing'));$('addEmployee')?.addEventListener('click',openEmployee);$('addRoomBed')?.addEventListener('click',()=>openRoomBed());document.querySelectorAll('.edit-room').forEach(b=>b.onclick=()=>openRoomBed(b.dataset.id));$('patientSearch')?.addEventListener('input',applyPatientFilters);$('patientRefFilter')?.addEventListener('change',applyPatientFilters);$('patientPayFilter')?.addEventListener('change',applyPatientFilters);document.querySelectorAll('.patient-profile').forEach(b=>b.onclick=()=>openPatientProfile(b.dataset.id));document.querySelectorAll('.patient-edit').forEach(b=>b.onclick=()=>openEditPatient(b.dataset.id));document.querySelectorAll('.patient-docs').forEach(b=>b.onclick=()=>openPatientProfile(b.dataset.id,true));document.querySelectorAll('.patient-history').forEach(b=>b.onclick=()=>openPaymentHistory(b.dataset.id));['billPatient','billRef','billRaised','billType','billFrom','billTo'].forEach(id=>$(id)?.addEventListener('change',applyBillingFilters));bindBillingButtons();$('printPatients')?.addEventListener('click',()=>window.print());$('printReport')?.addEventListener('click',()=>window.print());$('dailyReport')?.addEventListener('click',()=>{const t=dateInputValue(new Date());$('reportFrom').value=t;$('reportTo').value=t;updateReportPreview()});$('periodReport')?.addEventListener('click',updateReportPreview);$('previewReport')?.addEventListener('click',updateReportPreview);$('printGeneratedReport')?.addEventListener('click',()=>window.print());document.querySelectorAll('.employee-profile').forEach(b=>b.onclick=()=>openEmployeeProfile(b.dataset.id));document.querySelectorAll('.toggle-employee').forEach(b=>b.onclick=()=>toggleEmployee(b.dataset.id,b.dataset.active==='true'));$('queuePending')?.addEventListener('click',queuePendingPaymentReminders);$('sendPendingNotifications')?.addEventListener('click',sendPendingNotifications);document.querySelectorAll('.wa-send').forEach(b=>b.onclick=()=>openWhatsAppNotification(b.dataset.id));document.querySelectorAll('.notification-send-one').forEach(b=>b.onclick=()=>sendOneNotification(b.dataset.id));document.querySelectorAll('.med-given').forEach(b=>b.onclick=async()=>{const {error}=await db.from('medicine_records').update({status:'Given',administered_at:new Date().toISOString()}).eq('id',b.dataset.id);if(error)showError(error)})}

function bmiValue(p){const h=Number(p.height_cm),w=Number(p.weight_kg);return h&&w?(w/((h/100)**2)).toFixed(1):'-'}
function patientSummary(pid){const p=patients.find(x=>x.id===pid);if(!p)return '';const last=vitals.find(x=>x.patient_id===pid);return `<div class="summary-grid"><div><b>${esc(p.full_name)}</b><br><span class="muted">${esc(p.patient_code)} · Room ${esc(p.room_bed||'-')}</span></div><div><b>Height / Weight</b><br>${esc(p.height_cm||'-')} cm / ${esc(p.weight_kg||'-')} kg · BMI ${bmiValue(p)}</div><div><b>Diagnosis</b><br>${esc(p.diagnosis||'-')}</div><div><b>Latest Sugar</b><br>${last?.blood_sugar_value?`${esc(last.blood_sugar_type)} ${esc(last.blood_sugar_value)} mg/dL`:'-'}</div></div>`}
function render_patients(){const refs=[...new Set(patients.map(p=>p.referred_by).filter(Boolean))].sort();return `<div class="page-head"><div><h2>Patients</h2><div class="muted">Resident master, referral and hospital information</div></div><div class="actions">${['Admin','Manager','Nurse'].includes(me.role)?'<button class="btn btn-secondary" id="printPatients">Print</button><button class="btn btn-primary" id="addPatient">+ Add Patient</button>':''}</div></div><div class="toolbar"><input id="patientSearch" placeholder="Search patient, code, room, hospital or doctor"><select id="patientRefFilter"><option value="">All Referred By</option>${refs.map(r=>`<option>${esc(r)}</option>`).join('')}</select><select id="patientPayFilter"><option value="">All payment status</option><option value="due">Outstanding</option><option value="clear">No Outstanding</option></select></div><div class="table-wrap"><table><thead><tr><th>ID / Patient</th><th>Room</th><th>Height / Weight</th><th>Referral</th><th>Hospital / Doctor</th><th>Admission / Discharge</th><th>Outstanding</th><th>Actions</th></tr></thead><tbody id="patientRows">${patientRows(patients)}</tbody></table></div>`}
function patientRows(list){return list.map(p=>`<tr><td><b>${esc(p.full_name)}</b><br><small>${esc(p.patient_code)} · ${esc(p.age||'')} ${esc(p.gender||'')}</small></td><td>${esc(p.room_bed||'-')}</td><td>${esc(p.height_cm||'-')} cm<br>${esc(p.weight_kg||'-')} kg · BMI ${bmiValue(p)}</td><td>${esc(p.referred_by||'-')}<br><small>${esc(p.reference_contact||'-')}</small></td><td>${esc(p.hospital_name||'-')}<br><small>${esc(p.treating_doctor||'-')} · MR ${esc(p.hospital_mr_no||'-')}</small></td><td>${esc(p.hospital_admission_date||p.admission_date||'-')}<br><small>Discharge: ${esc(p.hospital_discharge_date||'-')}</small></td><td>₹${Number(p.outstanding||0).toLocaleString('en-IN')}</td><td><div class="actions"><button class="btn btn-secondary btn-small patient-profile" data-id="${p.id}">Profile</button>${['Admin','Manager','Nurse'].includes(me.role)?`<button class="btn btn-secondary btn-small patient-edit" data-id="${p.id}">Edit</button>`:''}<button class="btn btn-secondary btn-small patient-history" data-id="${p.id}">Payments</button><button class="btn btn-secondary btn-small patient-docs" data-id="${p.id}">Documents</button></div></td></tr>`).join('')||'<tr><td colspan="8">No patients found</td></tr>'}
function applyPatientFilters(){const q=($('patientSearch')?.value||'').toLowerCase(),ref=$('patientRefFilter')?.value||'',pay=$('patientPayFilter')?.value||'';const list=patients.filter(p=>(!q||[p.full_name,p.patient_code,p.room_bed,p.referred_by,p.hospital_name,p.treating_doctor,p.hospital_mr_no].some(v=>String(v||'').toLowerCase().includes(q)))&&(!ref||p.referred_by===ref)&&(!pay||(pay==='due'?Number(p.outstanding)>0:Number(p.outstanding)<=0)));$('patientRows').innerHTML=patientRows(list);bindPatientButtons()}
function openPatient(){modal(`<div class="modal-head"><h3>Add Patient</h3><button class="close">×</button></div><div class="form-grid">${field('Full Name','p_name')}${field('Age','p_age','number')}${select('Gender','p_gender',['Male','Female','Other'])}<div class="field"><label>Room / Bed</label><select id="p_room"><option value="">Select room</option>${rooms.filter(r=>r.status==='Available'&&!patients.some(p=>p.room_bed===`${r.room_no}-${r.bed_no}`&&p.status==='Active')).map(r=>`<option>${esc(r.room_no)}-${esc(r.bed_no)}</option>`).join('')}</select></div>${field('Height (cm)','p_height','number')}${field('Weight (kg)','p_weight','number')}${field('Facility Admission Date','p_date','date')}<div class="field"><label>Care Level</label><select id="p_care"><option>Independent</option><option selected>Assisted</option><option>High Dependency</option></select></div><div class="field full"><label>Diagnosis</label><textarea id="p_diag"></textarea></div>${field('Emergency Contact','p_contact')}${field('Referred By','p_referred')}${field('Reference Contact Number','p_reference_contact','tel')}${field('Hospital Name','p_hospital')}${field('Treating Doctor','p_doctor')}${field('Doctor Contact Number','p_doctor_contact','tel')}${field('Hospital MR No.','p_mr')}${field('Hospital Admission Date','p_hosp_adm','date')}${field('Hospital Discharge Date','p_hosp_dis','date')}<div class="field full"><label>Procedure / Surgery / Referral Remarks</label><textarea id="p_hosp_notes"></textarea></div><div class="full right"><button class="btn btn-primary" id="savePatient">Save Patient</button></div></div>`);$('savePatient').onclick=savePatient}
async function savePatient(){try{const code=`P${String(patients.length+1).padStart(4,'0')}`;const obj={patient_code:code,full_name:$('p_name').value.trim(),age:Number($('p_age').value)||null,gender:$('p_gender').value,room_bed:$('p_room').value.trim(),height_cm:Number($('p_height').value)||null,weight_kg:Number($('p_weight').value)||null,admission_date:$('p_date').value||null,diagnosis:$('p_diag').value.trim(),emergency_contact:$('p_contact').value.trim(),referred_by:$('p_referred').value.trim(),reference_contact:$('p_reference_contact').value.trim(),hospital_name:$('p_hospital').value.trim(),treating_doctor:$('p_doctor').value.trim(),doctor_contact:$('p_doctor_contact').value.trim(),hospital_mr_no:$('p_mr').value.trim(),hospital_admission_date:$('p_hosp_adm').value||null,hospital_discharge_date:$('p_hosp_dis').value||null,hospital_notes:$('p_hosp_notes').value.trim(),care_level:$('p_care').value,created_by:me.id};const {error}=await db.from('patients').insert(obj);if(error)throw error;closeModal()}catch(e){showError(e)}}
function openEditPatient(pid){
 const p=patients.find(x=>x.id===pid);if(!p)return;
 modal(`<div class="modal-head"><h3>Edit Patient</h3><button class="close">×</button></div><div class="form-grid">${field('Full Name','p_name','text',p.full_name||'')}${field('Age','p_age','number',p.age||'')}${select('Gender','p_gender',['Male','Female','Other'])}<div class="field"><label>Room / Bed</label><select id="p_room"><option value="">Select room</option>${rooms.map(r=>`<option value="${esc(r.room_no)}-${esc(r.bed_no)}">${esc(r.room_no)}-${esc(r.bed_no)}</option>`).join('')}</select></div>${field('Height (cm)','p_height','number',p.height_cm||'')}${field('Weight (kg)','p_weight','number',p.weight_kg||'')}${field('Facility Admission Date','p_date','date',p.admission_date||'')}<div class="field"><label>Care Level</label><select id="p_care"><option>Independent</option><option>Assisted</option><option>High Dependency</option></select></div><div class="field full"><label>Diagnosis</label><textarea id="p_diag">${esc(p.diagnosis||'')}</textarea></div>${field('Emergency Contact','p_contact','text',p.emergency_contact||'')}${field('Referred By','p_referred','text',p.referred_by||'')}${field('Reference Contact Number','p_reference_contact','tel',p.reference_contact||'')}${field('Hospital Name','p_hospital','text',p.hospital_name||'')}${field('Treating Doctor','p_doctor','text',p.treating_doctor||'')}${field('Doctor Contact Number','p_doctor_contact','tel',p.doctor_contact||'')}${field('Hospital MR No.','p_mr','text',p.hospital_mr_no||'')}${field('Hospital Admission Date','p_hosp_adm','date',p.hospital_admission_date||'')}${field('Hospital Discharge Date','p_hosp_dis','date',p.hospital_discharge_date||'')}<div class="field full"><label>Procedure / Surgery / Referral Remarks</label><textarea id="p_hosp_notes">${esc(p.hospital_notes||'')}</textarea></div><div class="full right"><button class="btn btn-primary" id="updatePatient">Save Changes</button></div></div>`);
 $('p_gender').value=p.gender||'Male';$('p_room').value=p.room_bed||'';$('p_care').value=p.care_level||'Assisted';$('updatePatient').onclick=()=>updatePatient(pid);
}
async function updatePatient(pid){
 try{const obj={full_name:$('p_name').value.trim(),age:Number($('p_age').value)||null,gender:$('p_gender').value,room_bed:$('p_room').value.trim(),height_cm:Number($('p_height').value)||null,weight_kg:Number($('p_weight').value)||null,admission_date:$('p_date').value||null,diagnosis:$('p_diag').value.trim(),emergency_contact:$('p_contact').value.trim(),referred_by:$('p_referred').value.trim(),reference_contact:$('p_reference_contact').value.trim(),hospital_name:$('p_hospital').value.trim(),treating_doctor:$('p_doctor').value.trim(),doctor_contact:$('p_doctor_contact').value.trim(),hospital_mr_no:$('p_mr').value.trim(),hospital_admission_date:$('p_hosp_adm').value||null,hospital_discharge_date:$('p_hosp_dis').value||null,hospital_notes:$('p_hosp_notes').value.trim(),care_level:$('p_care').value};const {error}=await db.from('patients').update(obj).eq('id',pid);if(error)throw error;closeModal();await loadAll();render();alert('Patient details updated successfully.')}catch(e){showError(e)}
}
async function openPatientProfile(pid,focusDocuments=false){
 const p=patients.find(x=>x.id===pid),last=vitals.find(x=>x.patient_id===pid);
 const photoDoc=documents.find(x=>x.patient_id===pid&&x.category==='Patient Photograph');
 let photoUrl='';
 if(photoDoc){
  try{const {data,error}=await db.storage.from('patient-documents').createSignedUrl(photoDoc.storage_path,900);if(!error)photoUrl=data.signedUrl}catch(e){console.warn('Patient photo could not be loaded',e)}
 }
 const initials=(p.full_name||'P').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();
 const photoHtml=photoUrl?`<img class="patient-profile-photo" src="${esc(photoUrl)}" alt="${esc(p.full_name)}" onclick="window.open('${esc(photoUrl)}','_blank')">`:`<div class="patient-photo-placeholder"><span>${esc(initials)}</span><small>No Photo</small></div>`;
 const canPhoto=['Admin','Manager','Nurse'].includes(me.role);
 const photoControls=canPhoto?`<div class="profile-photo-actions"><button type="button" class="btn btn-primary btn-small" id="profileTakePhoto">📷 Take New Photo</button><button type="button" class="btn btn-secondary btn-small" id="profileChoosePhoto">📁 Choose Photo</button><input id="profileCameraInput" class="hidden-file-input" type="file" accept="image/*" capture="user"><input id="profileFileInput" class="hidden-file-input" type="file" accept="image/*,.heic,.heif"><div id="profilePhotoStatus" class="muted profile-photo-status"></div></div>`:'';
 modal(`<div class="modal-head"><div><h3>Patient Profile</h3><div class="actions profile-header-actions">${canEdit?`<button class="btn btn-secondary btn-small" id="profileEditPatient">Edit Patient</button>`:''}<button class="btn btn-secondary btn-small" id="profileJumpDocuments">Documents</button></div></div><button class="close">×</button></div><div class="patient-profile-hero"><div class="patient-photo-wrap">${photoHtml}${photoControls}</div><div class="patient-profile-main">${patientSummary(pid)}</div></div><div class="grid2" style="margin-top:14px"><div class="card"><h3>Referral & Hospital</h3><p><b>Referred By:</b> ${esc(p.referred_by||'-')}<br><b>Reference Contact:</b> ${esc(p.reference_contact||'-')}<br><b>Hospital:</b> ${esc(p.hospital_name||'-')}<br><b>Doctor:</b> ${esc(p.treating_doctor||'-')} (${esc(p.doctor_contact||'-')})<br><b>MR No.:</b> ${esc(p.hospital_mr_no||'-')}<br><b>Hospital Admission:</b> ${esc(p.hospital_admission_date||'-')}<br><b>Hospital Discharge:</b> ${esc(p.hospital_discharge_date||'-')}</p></div><div class="card"><h3>Latest Clinical Reading</h3><p>${last?`Temperature: ${esc(last.temperature||'-')}<br>Pulse: ${esc(last.pulse||'-')}<br>Respiration: ${esc(last.respiration||'-')}<br>SpO₂: ${esc(last.spo2||'-')}%<br>Sugar: ${esc(last.blood_sugar_type||'-')} ${esc(last.blood_sugar_value||'-')} mg/dL`:'No vital signs recorded.'}</p></div></div>`);
 if(canPhoto){
  const camera=$('profileCameraInput'),file=$('profileFileInput');
  $('profileTakePhoto').onclick=()=>camera.click();
  $('profileChoosePhoto').onclick=()=>file.click();
  camera.onchange=()=>camera.files?.[0]&&uploadPatientPhoto(pid,camera.files[0]);
  file.onchange=()=>file.files?.[0]&&uploadPatientPhoto(pid,file.files[0]);
 }
}
function render_vitals(){return modulePage('Vital Signs','Bedside observations and blood sugar history',['Admin','Manager','Nurse'].includes(me.role)?'addVitals':'','Record Vitals',['Patient Name','ID','Room No.','Temperature','Pulse','Respiration','SpO₂','Sugar','Alert','Recorded By / Time'],vitals.map(x=>{const p=patients.find(q=>q.id===x.patient_id);return `<tr><td>${esc(p?.full_name||'-')}</td><td>${esc(p?.patient_code||'-')}</td><td>${esc(p?.room_bed||'-')}</td><td>${esc(x.temperature||'-')} ${esc(x.temperature_unit||'°F')}</td><td>${esc(x.pulse||'-')}</td><td>${esc(x.respiration||'-')}</td><td>${esc(x.spo2||'-')}%</td><td>${esc(x.blood_sugar_type||'-')} ${esc(x.blood_sugar_value||'-')} ${x.blood_sugar_value?'mg/dL':''}</td><td><span class="tag ${x.alert_level==='Critical'?'red':x.alert_level==='Warning'?'amber':'green'}">${esc(x.alert_level||'Normal')}</span></td><td>${esc(staffName(x.recorded_by))}<br><small>${new Date(x.recorded_at).toLocaleString('en-IN')}</small></td></tr>`}).join(''))}
function openSimple(kind){const forms={care:`${patientSelect('x_patient')}${select('Activity','x_a',['Oral Care','Bathing','Dress Change','Diaper Change','Feeding Assistance','Toileting','Position Change','Walking Support'])}${select('Status','x_s',['Completed','Pending','Patient Refused','Not Applicable'])}${field('Remarks','x_r')}`,vitals:`${patientSelect('x_patient')}${field('Temperature','x_temp','number')}${select('Temperature Unit','x_temp_unit',['°F','°C'])}${field('Pulse (beats/min)','x_pulse','number')}${field('Respiration (breaths/min)','x_resp','number')}${field('SpO₂ (%)','x_spo','number')}${select('Blood Sugar Type','x_sugar_type',['Not Taken','FBS','PPBS','RBS'])}${field('Blood Sugar (mg/dL)','x_sugar','number')}${field('Remarks','x_vremarks')}`,medicine:`${patientSelect('x_patient')}${field('Medicine','x_med')}${field('Scheduled Time','x_time','time')}${select('Status','x_s',['Pending','Given','Refused','Withheld'])}`,meal:`${patientSelect('x_patient')}${select('Meal','x_meal',['Breakfast','Lunch','Evening Snack','Dinner'])}${select('Diet','x_diet',['Normal','Diabetic','Soft','Liquid','Renal','High Protein'])}${select('Consumption','x_cons',['Fully Consumed','Partially Consumed','Refused','Not Served'])}`,billing:`${patientSelect('x_patient')}${select('Type','x_type',['Charge','Payment','Discount'])}${field('Amount (₹)','x_amount','number')}${field('Description','x_desc')}${select('Payment Mode','x_mode',['Cash','UPI','Bank Transfer','Card','Cheque','Other'])}${field('Transaction / Receipt Reference','x_ref')}${field('Discount Reason','x_discount_reason')}`};modal(`<div class="modal-head"><h3>New Entry</h3><button class="close">×</button></div><div class="form-grid">${forms[kind]}<div class="full right"><button class="btn btn-primary" id="saveSimple">Save</button></div></div>`);$('saveSimple').onclick=()=>saveSimple(kind)}
function assessVitals(v){
 const findings=[]; const tempF=v.temperature_unit==='°C'?(Number(v.temperature)*9/5+32):Number(v.temperature);
 if(v.temperature!==null&&!Number.isNaN(tempF)){if(tempF<95||tempF>=103)findings.push(['Temperature',v.temperature,v.temperature_unit,'Critical']);else if(tempF<96.8||tempF>=100.4)findings.push(['Temperature',v.temperature,v.temperature_unit,'Warning'])}
 if(v.pulse!==null){if(v.pulse<40||v.pulse>140)findings.push(['Pulse',v.pulse,'bpm','Critical']);else if(v.pulse<50||v.pulse>120)findings.push(['Pulse',v.pulse,'bpm','Warning'])}
 if(v.respiration!==null){if(v.respiration<8||v.respiration>30)findings.push(['Respiration',v.respiration,'/min','Critical']);else if(v.respiration<10||v.respiration>24)findings.push(['Respiration',v.respiration,'/min','Warning'])}
 if(v.spo2!==null){if(v.spo2<88)findings.push(['SpO₂',v.spo2,'%','Critical']);else if(v.spo2<92)findings.push(['SpO₂',v.spo2,'%','Warning'])}
 if(v.blood_sugar_value!==null){if(v.blood_sugar_value<54||v.blood_sugar_value>=400)findings.push([v.blood_sugar_type||'Blood Sugar',v.blood_sugar_value,'mg/dL','Critical']);else if(v.blood_sugar_value<70||v.blood_sugar_value>=250)findings.push([v.blood_sugar_type||'Blood Sugar',v.blood_sugar_value,'mg/dL','Warning'])}
 return findings;
}
async function saveSimple(k){try{let table,obj;if(k==='care'){table='care_records';obj={patient_id:$('x_patient').value,activity:$('x_a').value,status:$('x_s').value,remarks:$('x_r').value,recorded_by:me.id}}if(k==='vitals'){const spo=Number($('x_spo').value)||null,pulse=Number($('x_pulse').value)||null,resp=Number($('x_resp').value)||null,sugar=Number($('x_sugar').value)||null,temp=Number($('x_temp').value)||null;let alert='Normal';if((spo&&spo<92)||(sugar&&sugar<70)||(pulse&&(pulse<50||pulse>120))||(resp&&(resp<10||resp>24)))alert='Critical';else if((spo&&spo<95)||(sugar&&sugar>250))alert='Warning';table='vital_signs';obj={patient_id:$('x_patient').value,temperature:temp,temperature_unit:$('x_temp_unit').value,pulse,respiration:resp,spo2:spo,blood_sugar_type:$('x_sugar_type').value==='Not Taken'?null:$('x_sugar_type').value,blood_sugar_value:sugar,remarks:$('x_vremarks').value,alert_level:alert,recorded_by:me.id}}if(k==='medicine'){table='medicine_records';obj={patient_id:$('x_patient').value,medicine:$('x_med').value,scheduled_time:$('x_time').value||null,status:$('x_s').value,recorded_by:me.id}}if(k==='meal'){table='meal_records';obj={patient_id:$('x_patient').value,meal_type:$('x_meal').value,diet_type:$('x_diet').value,consumption:$('x_cons').value,recorded_by:me.id}}if(k==='billing'){table='billing_transactions';const typ=$('x_type').value;obj={patient_id:$('x_patient').value,transaction_type:typ,amount:Number($('x_amount').value),description:$('x_desc').value,payment_mode:typ==='Payment'?$('x_mode').value:null,reference_no:$('x_ref').value,receipt_no:typ==='Payment'?`RCPT-${Date.now()}`:null,discount_reason:typ==='Discount'?$('x_discount_reason').value:null,discount_status:typ==='Discount'?(me.role==='Admin'||me.role==='Manager'?'Approved':'Pending'):null,discount_approved_by:typ==='Discount'&&(me.role==='Admin'||me.role==='Manager')?me.id:null,recorded_by:me.id}}const findings=obj._findings||[];delete obj._findings;const {data:inserted,error}=await db.from(table).insert(obj).select().single();if(error)throw error;if(k==='vitals'&&findings.length){for(const f of findings){await db.from('clinical_alerts').insert({patient_id:obj.patient_id,vital_sign_id:inserted.id,parameter:f[0],value:String(f[1]),unit:f[2],severity:f[3],status:'New',created_by:me.id});await queueNotification('ABNORMAL_VITAL',obj.patient_id,`${f[3]} ${f[0]} alert`,`${pname(obj.patient_id)} (${patients.find(p=>p.id===obj.patient_id)?.room_bed||'-'}): ${f[0]} ${f[1]} ${f[2]}. Recorded by ${me.full_name}.`)}}if(k==='billing'){const p=patients.find(x=>x.id===obj.patient_id);const delta=obj.transaction_type==='Charge'?obj.amount:obj.transaction_type==='Payment'?-obj.amount:obj.discount_status==='Approved'?-obj.amount:0;const newOutstanding=Math.max(0,Number(p.outstanding||0)+delta);const {error:pe}=await db.from('patients').update({outstanding:newOutstanding}).eq('id',p.id);if(pe)throw pe;if(obj.transaction_type==='Charge')await queueNotification('BILL_RAISED',obj.patient_id,'New charge added',`Samara Care: A charge of ₹${obj.amount.toLocaleString('en-IN')} has been added for ${p.full_name}. Current outstanding: ₹${newOutstanding.toLocaleString('en-IN')}.`);if(obj.transaction_type==='Payment')await queueNotification('PAYMENT_RECEIVED',obj.patient_id,'Payment received',`Samara Care: Payment of ₹${obj.amount.toLocaleString('en-IN')} received for ${p.full_name}. Balance outstanding: ₹${newOutstanding.toLocaleString('en-IN')}.`)}closeModal()}catch(e){showError(e)}}
async function uploadPatientPhoto(pid,file){
 try{
  if(!file||!file.type.startsWith('image/'))throw new Error('Please select a photograph.');
  const status=$('profilePhotoStatus');if(status)status.textContent='Preparing and uploading photo…';
  let uploadFile=await compressDocumentImage(file);
  if(uploadFile.size>15*1024*1024)throw new Error('Photo exceeds the 15 MB limit.');
  const safe=(uploadFile.name||`patient-photo-${Date.now()}.jpg`).replace(/[^a-zA-Z0-9._-]/g,'_');
  const path=`${pid}/patient-photo/${Date.now()}-${safe}`;
  const {error:up}=await db.storage.from('patient-documents').upload(path,uploadFile,{upsert:false,contentType:uploadFile.type||'image/jpeg'});if(up)throw up;
  const {error}=await db.from('patient_documents').insert({patient_id:pid,category:'Patient Photograph',title:'Patient Photograph',document_date:new Date().toISOString().slice(0,10),storage_path:path,file_name:uploadFile.name||safe,mime_type:uploadFile.type||'image/jpeg',file_size:uploadFile.size,remarks:'Uploaded from Patient Profile',uploaded_by:me.id});
  if(error){await db.storage.from('patient-documents').remove([path]);throw error}
  if(status)status.textContent='Patient photo uploaded successfully.';
  await loadAll();
  alert('Patient photo uploaded successfully.');
  setTimeout(()=>openPatientProfile(pid),150);
 }catch(e){showError(e);const status=$('profilePhotoStatus');if(status)status.textContent='Upload failed.'}
}
function render_incidents(){const rows=incidents.map(x=>{const p=patients.find(q=>q.id===x.patient_id);return `<tr><td>${esc(x.incident_no)}</td><td>${esc(p?.full_name||'-')}<br><small>${esc(p?.patient_code||'')} · ${esc(p?.room_bed||'')}</small></td><td>${esc(x.incident_type)}</td><td>${new Date(x.incident_at).toLocaleString('en-IN')}</td><td>${esc(x.description)}</td><td>${x.doctor_informed?'Yes':'No'} / ${x.family_informed?'Yes':'No'}</td><td><span class="tag ${x.status==='Closed'?'green':'amber'}">${esc(x.status)}</span></td><td>${esc(staffName(x.reported_by))}</td></tr>`}).join('');return `<div class="page-head"><div><h2>Incident & Fall Register</h2><div class="muted">Falls, near-falls, injuries, medication errors and transfers</div></div><div class="actions">${['Admin','Manager','Nurse','Caregiver'].includes(me.role)?'<button class="btn btn-primary" id="addIncident">+ Report Incident</button>':''}${['Admin','Manager','Nurse'].includes(me.role)?'<button class="btn btn-secondary" id="printIncidents">Print / PDF</button>':''}</div></div><div class="table-wrap"><table><thead><tr><th>No.</th><th>Patient</th><th>Type</th><th>Date / Time</th><th>Description</th><th>Doctor / Family</th><th>Status</th><th>Reported By</th></tr></thead><tbody>${rows||'<tr><td colspan="8">No incidents recorded</td></tr>'}</tbody></table></div>`}
function openIncident(){modal(`<div class="modal-head"><h3>Report Incident</h3><button class="close">×</button></div><div class="form-grid">${patientSelect('i_patient')}${select('Incident Type','i_type',['Fall','Near Fall','Medication Error','Skin Tear','Pressure Injury','Aggressive Behaviour','Wandering','Equipment Incident','Food Incident','Emergency Hospital Transfer','Other'])}${field('Date & Time','i_time','datetime-local')}${field('Location','i_location')}<div class="field full"><label>Description</label><textarea id="i_desc"></textarea></div><div class="field full"><label>Immediate Action Taken</label><textarea id="i_action"></textarea></div>${field('Injury Details','i_injury')}${field('Witnesses','i_witness')}${select('Doctor Informed','i_doctor',['No','Yes'])}${select('Family Informed','i_family',['No','Yes'])}${select('Hospital Transfer','i_transfer',['No','Yes'])}${select('Status','i_status',['Open','Under Review','Closed'])}<div class="field full"><label>Corrective Action / Follow-up</label><textarea id="i_follow"></textarea></div><div class="full right"><button class="btn btn-primary" id="saveIncident">Save Incident</button></div></div>`);$('saveIncident').onclick=saveIncident}
async function saveIncident(){try{const no=`INC-${new Date().getFullYear()}-${String(incidents.length+1).padStart(4,'0')}`;const {error}=await db.from('incidents').insert({incident_no:no,patient_id:$('i_patient').value,incident_type:$('i_type').value,incident_at:$('i_time').value||new Date().toISOString(),location:$('i_location').value,description:$('i_desc').value,immediate_action:$('i_action').value,injury_details:$('i_injury').value,witnesses:$('i_witness').value,doctor_informed:$('i_doctor').value==='Yes',family_informed:$('i_family').value==='Yes',hospital_transfer:$('i_transfer').value==='Yes',corrective_action:$('i_follow').value,status:$('i_status').value,reported_by:me.id});if(error)throw error;closeModal()}catch(e){showError(e)}}
function render_documents(){return `<div class="page-head"><div><h2>Patient Documents</h2><div class="muted">Secure Supabase Storage for medical and administrative files</div></div>${['Admin','Manager','Nurse'].includes(me.role)?'<button class="btn btn-primary" id="addDocument">+ Upload Document</button>':''}</div><div class="toolbar"><select id="docPatientFilter"><option value="">All Patients</option>${patients.map(p=>`<option value="${p.id}">${esc(p.full_name)} · ${esc(p.patient_code)}</option>`).join('')}</select></div><div class="table-wrap"><table><thead><tr><th>Patient</th><th>Category</th><th>Title</th><th>Document Date</th><th>Uploaded By</th><th>Uploaded At</th><th>Action</th></tr></thead><tbody id="docRows">${documentRows(documents)}</tbody></table></div>`}
function documentRows(list){return list.map(x=>`<tr><td>${esc(pname(x.patient_id))}</td><td>${esc(x.category)}</td><td>${esc(x.title)}<br><small>${esc(x.remarks||'')}</small></td><td>${esc(x.document_date||'-')}</td><td>${esc(staffName(x.uploaded_by))}</td><td>${new Date(x.uploaded_at).toLocaleString('en-IN')}</td><td><button class="btn btn-secondary btn-small view-document" data-path="${esc(x.storage_path)}">View / Download</button></td></tr>`).join('')||'<tr><td colspan="7">No documents uploaded</td></tr>'}
function openDocument(pid='',presetCategory=''){
 const categories=['Patient Photograph','Aadhaar / ID Proof','Admission Form','Consent Form','Hospital Discharge Summary','Prescription','Investigation Report','Laboratory Report','X-ray','CT / MRI Report','Insurance Document','Advance Directive','Referral Letter','Bill','Receipt','Incident Photograph','Wound Photograph','Other'];
 modal(`<div class="modal-head"><h3>Upload / Capture Patient Document</h3><button class="close">×</button></div>
 <div class="form-grid">
  <div class="field"><label>Patient</label><select id="d_patient">${patients.map(p=>`<option value="${p.id}" ${p.id===pid?'selected':''}>${esc(p.full_name)} · ${esc(p.patient_code)}</option>`).join('')}</select></div>
  ${selectWithValue('Category','d_category',categories,presetCategory||'Patient Photograph')}
  ${field('Document Title','d_title')}${field('Document Date','d_date','date')}
  <div class="field full"><label>Add Photo or Document</label>
   <div class="capture-actions">
    <button type="button" class="btn btn-primary" id="takePhotoBtn">📷 Take Photo</button>
    <button type="button" class="btn btn-secondary" id="chooseFileBtn">📁 Choose Photo / PDF</button>
   </div>
   <input id="d_camera" class="hidden-file-input" type="file" accept="image/*" capture="environment">
   <input id="d_file" class="hidden-file-input" type="file" accept="image/*,.heic,.heif,.pdf,.doc,.docx" multiple>
   <div id="d_preview" class="upload-preview"><span class="muted">No file selected</span></div>
   <div class="muted upload-help">Patient photo: take a clear face photograph. Aadhaar and other documents: use the rear camera or select an existing photo/PDF. Multiple files may be selected.</div>
  </div>
  <div class="field full"><label>Remarks</label><textarea id="d_remarks"></textarea></div>
  <div class="full"><div id="uploadProgress" class="upload-progress hidden"><div id="uploadProgressBar"></div></div><div id="uploadStatus" class="muted"></div></div>
  <div class="full right"><button class="btn btn-primary" id="saveDocument" disabled>Upload Selected File(s)</button></div>
 </div>`);
 const camera=$('d_camera'),files=$('d_file'),category=$('d_category');
 const updateCapture=()=>camera.setAttribute('capture',category.value==='Patient Photograph'?'user':'environment');
 updateCapture(); category.addEventListener('change',updateCapture);
 $('takePhotoBtn').onclick=()=>camera.click();
 $('chooseFileBtn').onclick=()=>files.click();
 camera.onchange=()=>{if(camera.files?.length){files.value='';setDocumentSelection([...camera.files])}};
 files.onchange=()=>{if(files.files?.length){camera.value='';setDocumentSelection([...files.files])}};
 $('saveDocument').onclick=saveDocument;
}
let pendingDocumentFiles=[];
function setDocumentSelection(list){
 pendingDocumentFiles=list||[];
 const preview=$('d_preview');
 if(!pendingDocumentFiles.length){preview.innerHTML='<span class="muted">No file selected</span>';$('saveDocument').disabled=true;return}
 preview.innerHTML=pendingDocumentFiles.map((file,i)=>{
  const isImage=file.type.startsWith('image/');
  const url=isImage?URL.createObjectURL(file):'';
  return `<div class="preview-item">${isImage?`<img src="${url}" alt="Preview">`:'<div class="file-icon">PDF/DOC</div>'}<div><b>${esc(file.name||`Camera photo ${i+1}`)}</b><br><small>${formatFileSize(file.size)} · ${esc(file.type||'file')}</small></div></div>`
 }).join('');
 $('saveDocument').disabled=false;
 $('saveDocument').textContent=pendingDocumentFiles.length>1?`Upload ${pendingDocumentFiles.length} Files`:'Upload File';
}
function formatFileSize(bytes){if(bytes<1024)return `${bytes} B`;if(bytes<1048576)return `${(bytes/1024).toFixed(1)} KB`;return `${(bytes/1048576).toFixed(1)} MB`}
async function compressDocumentImage(file){
 if(!file.type.startsWith('image/')||/heic|heif/i.test(file.type)||file.size<1800000)return file;
 try{
  const bitmap=await createImageBitmap(file),max=1800,scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
  canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.84));
  return blob?new File([blob],(file.name||'photo').replace(/\.[^.]+$/, '')+'.jpg',{type:'image/jpeg',lastModified:Date.now()}):file;
 }catch{return file}
}
async function saveDocument(){
 const btn=$('saveDocument');
 if(!pendingDocumentFiles.length){showError(new Error('Take a photo or choose at least one file.'));return}
 const pid=$('d_patient').value,category=$('d_category').value,title=$('d_title').value.trim(),date=$('d_date').value||null,remarks=$('d_remarks').value;
 const progress=$('uploadProgress'),bar=$('uploadProgressBar'),status=$('uploadStatus');
 try{
  btn.disabled=true;progress.classList.remove('hidden');
  const batch=[...pendingDocumentFiles];
  for(let i=0;i<batch.length;i++){
   status.textContent=`Preparing file ${i+1} of ${batch.length}…`;bar.style.width=`${Math.round(i/batch.length*100)}%`;
   let file=await compressDocumentImage(batch[i]);
   if(file.size>15*1024*1024)throw new Error(`${file.name} exceeds the 15 MB limit.`);
   const safe=(file.name||`camera-${Date.now()}.jpg`).replace(/[^a-zA-Z0-9._-]/g,'_');
   const path=`${pid}/${Date.now()}-${i}-${safe}`;
   status.textContent=`Uploading file ${i+1} of ${batch.length}…`;
   const {error:up}=await db.storage.from('patient-documents').upload(path,file,{upsert:false,contentType:file.type||undefined});if(up)throw up;
   const rowTitle=title||(category==='Patient Photograph'?'Patient Photograph':file.name);
   const {error}=await db.from('patient_documents').insert({patient_id:pid,category,title:batch.length>1?`${rowTitle} (${i+1})`:rowTitle,document_date:date,storage_path:path,file_name:file.name,mime_type:file.type,file_size:file.size,remarks,uploaded_by:me.id});
   if(error){await db.storage.from('patient-documents').remove([path]);throw error}
   bar.style.width=`${Math.round((i+1)/batch.length*100)}%`;
  }
  status.textContent=`${batch.length} file(s) uploaded successfully.`;pendingDocumentFiles=[];await loadAll();setTimeout(()=>closeModal(),450);
 }catch(e){showError(e);status.textContent='Upload failed. Please try again.'}
 finally{btn.disabled=false;btn.textContent='Upload Selected File(s)'}
}
async function viewDocument(path){try{const {data,error}=await db.storage.from('patient-documents').createSignedUrl(path,300);if(error)throw error;window.open(data.signedUrl,'_blank')}catch(e){showError(e)}}
function openPatientDocuments(pid){openDocument(pid)}
function bindPatientButtons(){document.querySelectorAll('.patient-profile').forEach(b=>b.onclick=()=>openPatientProfile(b.dataset.id));document.querySelectorAll('.patient-edit').forEach(b=>b.onclick=()=>openEditPatient(b.dataset.id));document.querySelectorAll('.patient-docs').forEach(b=>b.onclick=()=>openPatientProfile(b.dataset.id,true));document.querySelectorAll('.patient-history').forEach(b=>b.onclick=()=>openPaymentHistory(b.dataset.id));document.querySelectorAll('.patient-profile').forEach(b=>b.onclick=()=>openPatientProfile(b.dataset.id));document.querySelectorAll('.patient-docs').forEach(b=>b.onclick=()=>openPatientDocuments(b.dataset.id))}
function bindPageActions(){$('addPatient')?.addEventListener('click',openPatient);$('addCare')?.addEventListener('click',()=>openSimple('care'));$('addVitals')?.addEventListener('click',()=>openSimple('vitals'));$('addMedicine')?.addEventListener('click',()=>openSimple('medicine'));$('addMeal')?.addEventListener('click',()=>openSimple('meal'));$('addIncident')?.addEventListener('click',openIncident);$('printIncidents')?.addEventListener('click',()=>window.print());$('addDocument')?.addEventListener('click',()=>openDocument());$('docPatientFilter')?.addEventListener('change',()=>{$('docRows').innerHTML=documentRows(documents.filter(x=>!$('docPatientFilter').value||x.patient_id===$('docPatientFilter').value));bindDocumentButtons()});$('addBilling')?.addEventListener('click',()=>openSimple('billing'));$('addEmployee')?.addEventListener('click',openEmployee);$('addRoomBed')?.addEventListener('click',()=>openRoomBed());document.querySelectorAll('.edit-room').forEach(b=>b.onclick=()=>openRoomBed(b.dataset.id));$('patientSearch')?.addEventListener('input',applyPatientFilters);$('patientRefFilter')?.addEventListener('change',applyPatientFilters);$('patientPayFilter')?.addEventListener('change',applyPatientFilters);bindPatientButtons();bindDocumentButtons();['billPatient','billRef','billRaised','billType','billFrom','billTo'].forEach(id=>$(id)?.addEventListener('change',applyBillingFilters));bindBillingButtons();$('printPatients')?.addEventListener('click',()=>window.print());$('printReport')?.addEventListener('click',()=>window.print());$('dailyReport')?.addEventListener('click',()=>{const t=dateInputValue(new Date());$('reportFrom').value=t;$('reportTo').value=t;updateReportPreview()});$('periodReport')?.addEventListener('click',updateReportPreview);$('previewReport')?.addEventListener('click',updateReportPreview);$('printGeneratedReport')?.addEventListener('click',()=>window.print());document.querySelectorAll('.employee-profile').forEach(b=>b.onclick=()=>openEmployeeProfile(b.dataset.id));document.querySelectorAll('.toggle-employee').forEach(b=>b.onclick=()=>toggleEmployee(b.dataset.id,b.dataset.active==='true'));$('queuePending')?.addEventListener('click',queuePendingPaymentReminders);$('sendPendingNotifications')?.addEventListener('click',sendPendingNotifications);document.querySelectorAll('.wa-send').forEach(b=>b.onclick=()=>openWhatsAppNotification(b.dataset.id));document.querySelectorAll('.notification-send-one').forEach(b=>b.onclick=()=>sendOneNotification(b.dataset.id));document.querySelectorAll('.med-given').forEach(b=>b.onclick=async()=>{const {error}=await db.from('medicine_records').update({status:'Given',administered_at:new Date().toISOString()}).eq('id',b.dataset.id);if(error)showError(error)})}
function bindDocumentButtons(){document.querySelectorAll('.view-document').forEach(b=>b.onclick=()=>viewDocument(b.dataset.path))}

async function changePassword(){const pw=prompt('Enter new password (minimum 6 characters):');if(!pw)return;if(pw.length<6)return alert('Password must contain at least 6 characters.');const {error}=await db.auth.updateUser({password:pw});if(error)showError(error);else alert('Password changed successfully.')}
async function logout(){if(channel)await db.removeChannel(channel);await db.auth.signOut();location.reload()}
document.addEventListener('click',e=>{const d=e.target.closest('[data-dashboard-detail]');if(d){e.preventDefault();openDashboardDetail(d.dataset.dashboardDetail);return}const r=e.target.closest('[data-report-detail]');if(r){e.preventDefault();openReportDetail(r.dataset.reportDetail)}});
$('loginBtn').onclick=login;$('loginPassword').onkeydown=e=>{if(e.key==='Enter')login()};$('logoutBtn').onclick=logout;$('passwordBtn').onclick=changePassword;$('mobileMenuBtn').onclick=toggleMobileMenu;$('navOverlay').onclick=closeMobileMenu;window.addEventListener('resize',()=>{if(window.innerWidth>700)closeMobileMenu()});
(async()=>{try{const {data}=await db.auth.getSession();if(data.session){me=await getProfile(data.session.user.id);await enterApp()}}catch(e){console.error(e);await db.auth.signOut()}})();


window.printFullBill=printFullBill;

/* ================= V21 CLINICAL + DOCUMENT CAMERA UPGRADE ================= */
function bmiCategoryValue(height,weight){
 const h=Number(height),w=Number(weight);if(!h||!w)return {value:'-',category:'-'};
 const bmi=w/((h/100)**2);let category='Normal';
 if(bmi<18.5)category='Underweight';else if(bmi>=25&&bmi<30)category='Overweight';else if(bmi>=30)category='Obese';
 return {value:bmi.toFixed(1),category};
}
function patientRows(list){return list.map(p=>`<tr><td>${esc(p.patient_code)}</td><td><b>${esc(p.full_name)}</b><br><small>${esc(p.age||'')} ${p.gender?'· '+esc(p.gender):''}</small></td><td>${esc(p.room_bed||'-')}</td><td>${esc(p.diagnosis||'-')}</td><td>${esc(p.referred_by||'-')}</td><td>${esc(p.reference_contact||'-')}</td><td><span class="tag">${esc(p.care_level||'-')}</span></td><td>₹${Number(p.outstanding||0).toLocaleString('en-IN')}</td><td><div class="actions"><button class="btn btn-secondary btn-small patient-profile" data-id="${p.id}">Profile</button>${['Admin','Manager','Nurse'].includes(me.role)?`<button class="btn btn-secondary btn-small patient-edit" data-id="${p.id}">Edit</button><button class="btn btn-secondary btn-small patient-docs" data-id="${p.id}">Documents</button>`:''}<button class="btn btn-secondary btn-small patient-history" data-id="${p.id}">Payment</button></div></td></tr>`).join('')||'<tr><td colspan="9">No patients found</td></tr>'}
function bindPatientButtons(){
 document.querySelectorAll('.patient-profile').forEach(b=>b.onclick=()=>openPatientProfile(b.dataset.id));document.querySelectorAll('.patient-edit').forEach(b=>b.onclick=()=>openEditPatient(b.dataset.id));document.querySelectorAll('.patient-docs').forEach(b=>b.onclick=()=>openPatientProfile(b.dataset.id,true));document.querySelectorAll('.patient-history').forEach(b=>b.onclick=()=>openPaymentHistory(b.dataset.id));
 document.querySelectorAll('.patient-profile').forEach(b=>b.onclick=()=>openPatientProfile(b.dataset.id));
 document.querySelectorAll('.patient-edit').forEach(b=>b.onclick=()=>openPatient(b.dataset.id));
 document.querySelectorAll('.patient-docs').forEach(b=>b.onclick=()=>openPatientDocumentsPanel(b.dataset.id));
}
function openPatient(id=''){
 const p=id?patients.find(x=>x.id===id):{};const editing=!!id;
 modal(`<div class="modal-head"><h3>${editing?'Edit':'Add'} Patient</h3><button class="close">×</button></div><div class="form-grid">
 ${field('Full Name','p_name','text',p.full_name||'')}${field('Age','p_age','number',p.age||'')}${selectWithValue('Gender','p_gender',['Male','Female','Other'],p.gender||'Male')}
 <div class="field"><label>Room / Bed</label><select id="p_room"><option value="">Select room</option>${rooms.filter(r=>r.status==='Available'||`${r.room_no}-${r.bed_no}`===p.room_bed).map(r=>`<option ${`${r.room_no}-${r.bed_no}`===p.room_bed?'selected':''}>${esc(r.room_no)}-${esc(r.bed_no)}</option>`).join('')}</select></div>
 ${field('Height (cm)','p_height','number',p.height_cm||'')}${field('Weight (kg)','p_weight','number',p.weight_kg||'')}
 <div class="field"><label>BMI</label><input id="p_bmi" readonly value="${bmiCategoryValue(p.height_cm,p.weight_kg).value} (${bmiCategoryValue(p.height_cm,p.weight_kg).category})"></div>
 ${field('Facility Admission Date','p_date','date',p.admission_date||'')}${selectWithValue('Care Level','p_care',['Independent','Assisted','High Dependency'],p.care_level||'Assisted')}
 <div class="field full"><label>Diagnosis</label><textarea id="p_diag">${esc(p.diagnosis||'')}</textarea></div>
 ${field('Emergency Contact','p_contact','text',p.emergency_contact||'')}${field('Referred By','p_referred','text',p.referred_by||'')}${field('Reference Contact Number','p_reference_contact','tel',p.reference_contact||'')}
 ${field('Hospital Name','p_hospital','text',p.hospital_name||'')}${field('Treating Doctor','p_doctor','text',p.treating_doctor||'')}${field('Doctor Contact Number','p_doctor_contact','tel',p.doctor_contact||'')}${field('Hospital MR No.','p_mr','text',p.hospital_mr_no||'')}
 ${field('Hospital Admission Date','p_hosp_adm','date',p.hospital_admission_date||'')}${field('Hospital Discharge Date','p_hosp_dis','date',p.hospital_discharge_date||'')}
 <div class="field full"><label>Procedure / Surgery / Referral Remarks</label><textarea id="p_hosp_notes">${esc(p.hospital_notes||'')}</textarea></div>
 <div class="full right"><button class="btn btn-primary" id="savePatient">${editing?'Update':'Save'} Patient</button></div></div>`);
 const calc=()=>{const b=bmiCategoryValue($('p_height').value,$('p_weight').value);$('p_bmi').value=`${b.value} (${b.category})`};$('p_height').oninput=calc;$('p_weight').oninput=calc;
 $('savePatient').onclick=()=>savePatient(id);
}
async function savePatient(id=''){
 try{
  const obj={full_name:$('p_name').value.trim(),age:Number($('p_age').value)||null,gender:$('p_gender').value,room_bed:$('p_room').value.trim(),height_cm:Number($('p_height').value)||null,weight_kg:Number($('p_weight').value)||null,admission_date:$('p_date').value||null,diagnosis:$('p_diag').value.trim(),emergency_contact:$('p_contact').value.trim(),referred_by:$('p_referred').value.trim(),reference_contact:$('p_reference_contact').value.trim(),hospital_name:$('p_hospital').value.trim(),treating_doctor:$('p_doctor').value.trim(),doctor_contact:$('p_doctor_contact').value.trim(),hospital_mr_no:$('p_mr').value.trim(),hospital_admission_date:$('p_hosp_adm').value||null,hospital_discharge_date:$('p_hosp_dis').value||null,hospital_notes:$('p_hosp_notes').value.trim(),care_level:$('p_care').value};
  if(!obj.full_name)throw new Error('Patient name is required.');
  let q;if(id)q=db.from('patients').update(obj).eq('id',id);else{obj.patient_code=`P${String(patients.length+1).padStart(4,'0')}`;obj.created_by=me.id;q=db.from('patients').insert(obj)}
  const {error}=await q;if(error)throw error;closeModal();await loadAll();render();alert(id?'Patient details updated successfully.':'Patient added successfully.');
 }catch(e){showError(e)}
}
function render_vitals(){return modulePage('Vital Signs','Blood pressure, temperature, pulse, respiration, SpO₂, sugar and pain score',['Admin','Manager','Nurse'].includes(me.role)?'addVitals':'','Record Vitals',['Patient Name','ID','Room No.','Blood Pressure','Temperature','Pulse','Respiration','SpO₂','Sugar','Pain','Alert','Recorded By / Time'],vitals.map(x=>{const p=patients.find(q=>q.id===x.patient_id);return `<tr><td>${esc(p?.full_name||'-')}</td><td>${esc(p?.patient_code||'-')}</td><td>${esc(p?.room_bed||'-')}</td><td>${x.systolic_bp||x.diastolic_bp?`${esc(x.systolic_bp||'-')}/${esc(x.diastolic_bp||'-')} mmHg`:'-'}</td><td>${esc(x.temperature||'-')} ${esc(x.temperature_unit||'°F')}</td><td>${esc(x.pulse||'-')}</td><td>${esc(x.respiration||'-')}</td><td>${esc(x.spo2||'-')}%</td><td>${esc(x.blood_sugar_type||'-')} ${esc(x.blood_sugar_value||'-')} ${x.blood_sugar_value?'mg/dL':''}</td><td>${x.pain_score??'-'}/10</td><td><span class="tag ${x.alert_level==='Critical'?'red':x.alert_level==='Warning'?'amber':'green'}">${esc(x.alert_level||'Normal')}</span></td><td>${esc(staffName(x.recorded_by))}<br><small>${new Date(x.recorded_at).toLocaleString('en-IN')}</small></td></tr>`}).join(''))}
function openSimple(kind){const forms={care:`${patientSelect('x_patient')}${select('Activity','x_a',['Oral Care','Bathing','Dress Change','Diaper Change','Feeding Assistance','Toileting','Position Change','Walking Support'])}${select('Status','x_s',['Completed','Pending','Patient Refused','Not Applicable'])}${field('Remarks','x_r')}`,vitals:`${patientSelect('x_patient')}${field('Systolic BP (mmHg)','x_sys','number')}${field('Diastolic BP (mmHg)','x_dia','number')}${field('Temperature','x_temp','number')}${select('Temperature Unit','x_temp_unit',['°F','°C'])}${field('Pulse (beats/min)','x_pulse','number')}${field('Respiration (breaths/min)','x_resp','number')}${field('SpO₂ (%)','x_spo','number')}${select('Blood Sugar Type','x_sugar_type',['Not Taken','FBS','PPBS','RBS'])}${field('Blood Sugar (mg/dL)','x_sugar','number')}${field('Pain Score (0–10)','x_pain','number')}<div class="field full"><label>Remarks / Action Taken</label><textarea id="x_vremarks"></textarea></div>`,medicine:`${patientSelect('x_patient')}${field('Medicine','x_med')}${field('Scheduled Time','x_time','time')}${select('Status','x_s',['Pending','Given','Refused','Withheld'])}`,meal:`${patientSelect('x_patient')}${select('Meal','x_meal',['Breakfast','Lunch','Evening Snack','Dinner'])}${select('Diet','x_diet',['Normal','Diabetic','Soft','Liquid','Renal','High Protein'])}${select('Consumption','x_cons',['Fully Consumed','Partially Consumed','Refused','Not Served'])}`,billing:`${patientSelect('x_patient')}${select('Type','x_type',['Charge','Payment','Discount'])}${field('Amount (₹)','x_amount','number')}${field('Description','x_desc')}${select('Payment Mode','x_mode',['Cash','UPI','Bank Transfer','Card','Cheque','Other'])}${field('Transaction / Receipt Reference','x_ref')}${field('Discount Reason','x_discount_reason')}`};modal(`<div class="modal-head"><h3>New Entry</h3><button class="close">×</button></div><div class="form-grid">${forms[kind]}<div class="full right"><button class="btn btn-primary" id="saveSimple">Save</button></div></div>`);$('saveSimple').onclick=()=>saveSimple(kind)}
async function saveSimple(k){
 try{let table,obj,findings=[];
  if(k==='care'){table='care_records';obj={patient_id:$('x_patient').value,activity:$('x_a').value,status:$('x_s').value,remarks:$('x_r').value,recorded_by:me.id}}
  if(k==='vitals'){
   const num=id=>$(id).value===''?null:Number($(id).value),sys=num('x_sys'),dia=num('x_dia'),temp=num('x_temp'),pulse=num('x_pulse'),resp=num('x_resp'),spo=num('x_spo'),sugar=num('x_sugar'),pain=num('x_pain');let alert='Normal';
   if((sys&&(sys<80||sys>180))||(dia&&(dia<50||dia>120))||(spo&&spo<92)||(sugar&&sugar<70)||(pulse&&(pulse<50||pulse>120))||(resp&&(resp<10||resp>24))||(pain!=null&&pain>=8))alert='Critical';
   else if((sys&&(sys<90||sys>160))||(dia&&(dia<60||dia>100))||(spo&&spo<95)||(sugar&&sugar>250)||(pain!=null&&pain>=5))alert='Warning';
   table='vital_signs';obj={patient_id:$('x_patient').value,systolic_bp:sys,diastolic_bp:dia,temperature:temp,temperature_unit:$('x_temp_unit').value,pulse,respiration:resp,spo2:spo,blood_sugar_type:$('x_sugar_type').value==='Not Taken'?null:$('x_sugar_type').value,blood_sugar_value:sugar,pain_score:pain,remarks:$('x_vremarks').value,alert_level:alert,recorded_by:me.id};
   const checks=[['Blood Pressure',sys&&dia?`${sys}/${dia}`:null,'mmHg',alert],['SpO₂',spo,'%',spo&&spo<92?'Critical':spo&&spo<95?'Warning':null],['Pulse',pulse,'bpm',pulse&&(pulse<50||pulse>120)?'Critical':null],['Respiration',resp,'/min',resp&&(resp<10||resp>24)?'Critical':null],['Blood Sugar',sugar,'mg/dL',sugar&&sugar<70?'Critical':sugar&&sugar>250?'Warning':null],['Pain Score',pain,'/10',pain>=8?'Critical':pain>=5?'Warning':null]];findings=checks.filter(x=>x[1]!=null&&x[3]);
  }
  if(k==='medicine'){table='medicine_records';obj={patient_id:$('x_patient').value,medicine:$('x_med').value,scheduled_time:$('x_time').value||null,status:$('x_s').value,recorded_by:me.id}}
  if(k==='meal'){table='meal_records';obj={patient_id:$('x_patient').value,meal_type:$('x_meal').value,diet_type:$('x_diet').value,consumption:$('x_cons').value,recorded_by:me.id}}
  if(k==='billing'){table='billing_transactions';const typ=$('x_type').value;obj={patient_id:$('x_patient').value,transaction_type:typ,amount:Number($('x_amount').value),description:$('x_desc').value,payment_mode:typ==='Payment'?$('x_mode').value:null,reference_no:$('x_ref').value,receipt_no:typ==='Payment'?`RCPT-${Date.now()}`:null,discount_reason:typ==='Discount'?$('x_discount_reason').value:null,discount_status:typ==='Discount'?(me.role==='Admin'||me.role==='Manager'?'Approved':'Pending'):null,discount_approved_by:typ==='Discount'&&(me.role==='Admin'||me.role==='Manager')?me.id:null,recorded_by:me.id}}
  const {data:inserted,error}=await db.from(table).insert(obj).select().single();if(error)throw error;
  if(k==='vitals'&&findings.length){for(const f of findings){await db.from('clinical_alerts').insert({patient_id:obj.patient_id,vital_sign_id:inserted.id,parameter:f[0],value:String(f[1]),unit:f[2],severity:f[3],status:'New',created_by:me.id});if(typeof queueNotification==='function')await queueNotification('ABNORMAL_VITAL',obj.patient_id,`${f[3]} ${f[0]} alert`,`${pname(obj.patient_id)}: ${f[0]} ${f[1]} ${f[2]}.`)}}
  if(k==='billing'){const p=patients.find(x=>x.id===obj.patient_id);const delta=obj.transaction_type==='Charge'?obj.amount:obj.transaction_type==='Payment'?-obj.amount:obj.discount_status==='Approved'?-obj.amount:0;const newOutstanding=Math.max(0,Number(p.outstanding||0)+delta);await db.from('patients').update({outstanding:newOutstanding}).eq('id',p.id)}
  closeModal();await loadAll();render();
 }catch(e){showError(e)}
}
function openEditPatient(pid){
 const p=patients.find(x=>x.id===pid);if(!p)return;
 modal(`<div class="modal-head"><h3>Edit Patient</h3><button class="close">×</button></div><div class="form-grid">${field('Full Name','p_name','text',p.full_name||'')}${field('Age','p_age','number',p.age||'')}${select('Gender','p_gender',['Male','Female','Other'])}<div class="field"><label>Room / Bed</label><select id="p_room"><option value="">Select room</option>${rooms.map(r=>`<option value="${esc(r.room_no)}-${esc(r.bed_no)}">${esc(r.room_no)}-${esc(r.bed_no)}</option>`).join('')}</select></div>${field('Height (cm)','p_height','number',p.height_cm||'')}${field('Weight (kg)','p_weight','number',p.weight_kg||'')}${field('Facility Admission Date','p_date','date',p.admission_date||'')}<div class="field"><label>Care Level</label><select id="p_care"><option>Independent</option><option>Assisted</option><option>High Dependency</option></select></div><div class="field full"><label>Diagnosis</label><textarea id="p_diag">${esc(p.diagnosis||'')}</textarea></div>${field('Emergency Contact','p_contact','text',p.emergency_contact||'')}${field('Referred By','p_referred','text',p.referred_by||'')}${field('Reference Contact Number','p_reference_contact','tel',p.reference_contact||'')}${field('Hospital Name','p_hospital','text',p.hospital_name||'')}${field('Treating Doctor','p_doctor','text',p.treating_doctor||'')}${field('Doctor Contact Number','p_doctor_contact','tel',p.doctor_contact||'')}${field('Hospital MR No.','p_mr','text',p.hospital_mr_no||'')}${field('Hospital Admission Date','p_hosp_adm','date',p.hospital_admission_date||'')}${field('Hospital Discharge Date','p_hosp_dis','date',p.hospital_discharge_date||'')}<div class="field full"><label>Procedure / Surgery / Referral Remarks</label><textarea id="p_hosp_notes">${esc(p.hospital_notes||'')}</textarea></div><div class="full right"><button class="btn btn-primary" id="updatePatient">Save Changes</button></div></div>`);
 $('p_gender').value=p.gender||'Male';$('p_room').value=p.room_bed||'';$('p_care').value=p.care_level||'Assisted';$('updatePatient').onclick=()=>updatePatient(pid);
}
async function updatePatient(pid){
 try{const obj={full_name:$('p_name').value.trim(),age:Number($('p_age').value)||null,gender:$('p_gender').value,room_bed:$('p_room').value.trim(),height_cm:Number($('p_height').value)||null,weight_kg:Number($('p_weight').value)||null,admission_date:$('p_date').value||null,diagnosis:$('p_diag').value.trim(),emergency_contact:$('p_contact').value.trim(),referred_by:$('p_referred').value.trim(),reference_contact:$('p_reference_contact').value.trim(),hospital_name:$('p_hospital').value.trim(),treating_doctor:$('p_doctor').value.trim(),doctor_contact:$('p_doctor_contact').value.trim(),hospital_mr_no:$('p_mr').value.trim(),hospital_admission_date:$('p_hosp_adm').value||null,hospital_discharge_date:$('p_hosp_dis').value||null,hospital_notes:$('p_hosp_notes').value.trim(),care_level:$('p_care').value};const {error}=await db.from('patients').update(obj).eq('id',pid);if(error)throw error;closeModal();await loadAll();render();alert('Patient details updated successfully.')}catch(e){showError(e)}
}
async function openPatientProfile(pid,focusDocuments=false){
 const p=patients.find(x=>x.id===pid);if(!p)return;const last=vitals.find(x=>x.patient_id===pid),photoDoc=documents.find(x=>x.patient_id===pid&&x.category==='Patient Photograph');let photoUrl='';
 if(photoDoc){try{const {data}=await db.storage.from('patient-documents').createSignedUrl(photoDoc.storage_path,900);photoUrl=data?.signedUrl||''}catch{}}
 const docs=documents.filter(x=>x.patient_id===pid&&x.category!=='Patient Photograph').slice(0,6),b=bmiCategoryValue(p.height_cm,p.weight_kg),canEdit=['Admin','Manager','Nurse'].includes(me.role);
 modal(`<div class="modal-head"><div><h3>Patient Profile</h3><div class="actions profile-header-actions">${canEdit?`<button class="btn btn-secondary btn-small" id="profileEditPatient">Edit Patient</button>`:''}<button class="btn btn-secondary btn-small" id="profileJumpDocuments">Documents</button></div></div><button class="close">×</button></div><div class="patient-profile-hero"><div class="patient-photo-wrap">${photoUrl?`<img class="patient-profile-photo" src="${photoUrl}" alt="Patient photo">`:`<div class="patient-photo-placeholder">${esc((p.full_name||'P')[0])}<small>No Photo</small></div>`}${canEdit?`<div class="photo-direct-actions"><button class="btn btn-primary btn-small" id="profileTakePhoto">📷 Take Photo</button><button class="btn btn-secondary btn-small" id="profileChoosePhoto">📁 Choose Photo</button></div><input type="file" id="profileCameraInput" accept="image/*" capture="user" class="hidden-file-input"><input type="file" id="profileFileInput" accept="image/*" class="hidden-file-input">`:''}</div><div class="patient-profile-main"><div class="summary-grid"><div><b>${esc(p.full_name)}</b><br><span class="muted">${esc(p.patient_code)} · Room ${esc(p.room_bed||'-')}</span></div><div><b>Height / Weight / BMI</b><br>${esc(p.height_cm||'-')} cm / ${esc(p.weight_kg||'-')} kg · ${b.value} (${b.category})</div><div><b>Diagnosis</b><br>${esc(p.diagnosis||'-')}</div><div><b>Latest Sugar</b><br>${last?.blood_sugar_value?`${esc(last.blood_sugar_type)} ${esc(last.blood_sugar_value)} mg/dL`:'-'}</div></div></div></div>
 <div class="grid2" style="margin-top:14px"><div class="card"><h3>Referral & Hospital</h3><p><b>Referred By:</b> ${esc(p.referred_by||'-')}<br><b>Reference Contact:</b> ${esc(p.reference_contact||'-')}<br><b>Hospital:</b> ${esc(p.hospital_name||'-')}<br><b>Doctor:</b> ${esc(p.treating_doctor||'-')} (${esc(p.doctor_contact||'-')})<br><b>MR No.:</b> ${esc(p.hospital_mr_no||'-')}<br><b>Hospital Admission:</b> ${esc(p.hospital_admission_date||'-')}<br><b>Hospital Discharge:</b> ${esc(p.hospital_discharge_date||'-')}</p></div><div class="card"><h3>Latest Clinical Reading</h3><p>${last?`BP: ${last.systolic_bp||'-'}/${last.diastolic_bp||'-'} mmHg<br>Temperature: ${esc(last.temperature||'-')}<br>Pulse: ${esc(last.pulse||'-')}<br>Respiration: ${esc(last.respiration||'-')}<br>SpO₂: ${esc(last.spo2||'-')}%<br>Sugar: ${esc(last.blood_sugar_type||'-')} ${esc(last.blood_sugar_value||'-')} mg/dL<br>Pain: ${last.pain_score??'-'}/10`:'No vital signs recorded.'}</p></div></div>
 <div class="card patient-documents-section" id="patientDocumentsSection" style="margin-top:14px"><div class="page-head"><div><h3>Patient Documents</h3><div class="muted">Aadhaar, discharge summary, prescriptions and other records</div></div>${canEdit?`<div class="actions"><button class="btn btn-primary btn-small" id="profileTakeDocument">📷 Camera / Webcam</button><button class="btn btn-secondary btn-small" id="profileChooseDocument">📁 Upload File / PDF</button></div>`:''}</div><div class="table-wrap"><table><thead><tr><th>Category</th><th>Title</th><th>Date</th><th>Action</th></tr></thead><tbody>${docs.map(d=>`<tr><td>${esc(d.category)}</td><td>${esc(d.title)}</td><td>${esc(d.document_date||'-')}</td><td><button class="btn btn-secondary btn-small profile-view-doc" data-path="${esc(d.storage_path)}">View</button></td></tr>`).join('')||'<tr><td colspan="4">No documents uploaded</td></tr>'}</tbody></table></div></div>`);
 document.querySelector('.modal-card')?.classList.add('patient-profile-modal');$('profileJumpDocuments').onclick=()=>$('patientDocumentsSection')?.scrollIntoView({behavior:'smooth',block:'start'});if(canEdit)$('profileEditPatient').onclick=()=>openEditPatient(pid);if(focusDocuments)setTimeout(()=>$('patientDocumentsSection')?.scrollIntoView({behavior:'smooth',block:'start'}),80);
 if(canEdit){$('profileTakePhoto').onclick=()=>$('profileCameraInput').click();$('profileChoosePhoto').onclick=()=>$('profileFileInput').click();$('profileCameraInput').onchange=()=>$('profileCameraInput').files?.[0]&&uploadPatientPhoto(pid,$('profileCameraInput').files[0]);$('profileFileInput').onchange=()=>$('profileFileInput').files?.[0]&&uploadPatientPhoto(pid,$('profileFileInput').files[0]);$('profileChooseDocument').onclick=()=>openDocument(pid,'Aadhaar / ID Proof');$('profileTakeDocument').onclick=()=>openWebCameraDocument(pid)}
 document.querySelectorAll('.profile-view-doc').forEach(b=>b.onclick=()=>viewDocument(b.dataset.path));
}
let webcamStream=null;
async function openWebCameraDocument(pid){
 try{
  if(!navigator.mediaDevices?.getUserMedia){openDocument(pid,'Aadhaar / ID Proof');return}
  webcamStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
  modal(`<div class="modal-head"><h3>Camera / Webcam Capture</h3><button class="close" id="cameraClose">×</button></div><div class="camera-capture"><video id="webcamVideo" autoplay playsinline></video><canvas id="webcamCanvas" class="hidden"></canvas><div class="field"><label>Document Category</label><select id="webcamCategory"><option>Aadhaar / ID Proof</option><option>Hospital Discharge Summary</option><option>Prescription</option><option>Investigation Report</option><option>Consent Form</option><option>Referral Letter</option><option>Other</option></select></div><div class="actions"><button class="btn btn-primary" id="captureWebcam">Capture & Upload</button><button class="btn btn-secondary" id="cancelWebcam">Cancel</button></div><div id="webcamStatus" class="muted"></div></div>`);
  $('webcamVideo').srcObject=webcamStream;const stop=()=>{webcamStream?.getTracks().forEach(t=>t.stop());webcamStream=null;closeModal()};$('cameraClose').onclick=stop;$('cancelWebcam').onclick=stop;
  $('captureWebcam').onclick=async()=>{const v=$('webcamVideo'),c=$('webcamCanvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9));if(!blob)return;const file=new File([blob],`camera-${Date.now()}.jpg`,{type:'image/jpeg'});$('webcamStatus').textContent='Uploading captured document…';await uploadCapturedDocument(pid,file,$('webcamCategory').value);stop()};
 }catch(e){showError(new Error('Camera access was not available. Please allow camera permission or use Choose File.'));openDocument(pid,'Aadhaar / ID Proof')}
}
async function uploadCapturedDocument(pid,file,category){
 const f=await compressDocumentImage(file),safe=f.name.replace(/[^a-zA-Z0-9._-]/g,'_'),path=`${pid}/${Date.now()}-${safe}`;const {error:up}=await db.storage.from('patient-documents').upload(path,f,{contentType:f.type});if(up)throw up;const {error}=await db.from('patient_documents').insert({patient_id:pid,category,title:category,document_date:new Date().toISOString().slice(0,10),storage_path:path,file_name:f.name,mime_type:f.type,file_size:f.size,remarks:'Captured using device camera/webcam',uploaded_by:me.id});if(error)throw error;await loadAll();alert('Document captured and uploaded successfully.')
}
/* ================= END V21 ================= */

/* ================= V2.1.1 PATIENT ADD/EDIT + PROFILE WEBCAM FIX ================= */
(function installPatientActionDelegation(){
  if(window.__samaraPatientActionDelegation)return;
  window.__samaraPatientActionDelegation=true;
  document.addEventListener('click',function(event){
    const button=event.target.closest('button');
    if(!button)return;
    if(button.id==='addPatient'){
      event.preventDefault();event.stopImmediatePropagation();openPatient();return;
    }
    if(button.classList.contains('patient-edit')){
      event.preventDefault();event.stopImmediatePropagation();openPatient(button.dataset.id);return;
    }
    if(button.classList.contains('patient-docs')){
      event.preventDefault();event.stopImmediatePropagation();openPatientProfile(button.dataset.id,true);return;
    }
    if(button.classList.contains('patient-profile')){
      event.preventDefault();event.stopImmediatePropagation();openPatientProfile(button.dataset.id,false);return;
    }
    if(button.classList.contains('patient-history')){
      event.preventDefault();event.stopImmediatePropagation();openPaymentHistory(button.dataset.id);return;
    }
  },true);
})();

let patientPhotoWebcamStream=null;
async function openPatientPhotoWebcam(patientId){
  try{
    if(!navigator.mediaDevices?.getUserMedia){
      alert('Webcam is not available in this browser. Please use Choose Photo.');
      return;
    }
    patientPhotoWebcamStream=await navigator.mediaDevices.getUserMedia({
      video:{facingMode:{ideal:'user'},width:{ideal:1280},height:{ideal:720}},audio:false
    });
    modal(`<div class="modal-head"><div><h3>Take Patient Photo</h3><div class="muted">Position the patient in front of the camera.</div></div><button class="close" id="patientCamClose">×</button></div>
      <div class="camera-capture patient-camera-capture">
        <video id="patientCamVideo" autoplay playsinline muted></video>
        <canvas id="patientCamCanvas" class="hidden"></canvas>
        <div class="camera-guide">Keep the face centred and ensure good lighting.</div>
        <div class="actions right"><button class="btn btn-secondary" id="patientCamCancel">Cancel</button><button class="btn btn-primary" id="patientCamCapture">Capture & Upload</button></div>
        <div id="patientCamStatus" class="muted"></div>
      </div>`);
    const video=$('patientCamVideo');video.srcObject=patientPhotoWebcamStream;
    const stop=()=>{patientPhotoWebcamStream?.getTracks().forEach(t=>t.stop());patientPhotoWebcamStream=null;closeModal()};
    $('patientCamClose').onclick=stop;$('patientCamCancel').onclick=stop;
    $('patientCamCapture').onclick=async()=>{
      try{
        const canvas=$('patientCamCanvas');
        if(!video.videoWidth||!video.videoHeight)throw new Error('Camera is still starting. Please wait a moment and try again.');
        const size=Math.min(video.videoWidth,video.videoHeight);
        const sx=(video.videoWidth-size)/2,sy=(video.videoHeight-size)/2;
        canvas.width=900;canvas.height=900;
        canvas.getContext('2d').drawImage(video,sx,sy,size,size,0,0,900,900);
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.88));
        if(!blob)throw new Error('Unable to capture photograph.');
        $('patientCamStatus').textContent='Uploading patient photo…';
        const file=new File([blob],`patient-photo-${Date.now()}.jpg`,{type:'image/jpeg'});
        await uploadPatientPhoto(patientId,file);
        patientPhotoWebcamStream?.getTracks().forEach(t=>t.stop());patientPhotoWebcamStream=null;
      }catch(error){showError(error)}
    };
  }catch(error){
    showError(new Error('Unable to access the camera. Allow camera permission in the browser, then try again.'));
  }
}

const originalOpenPatientProfileV21=openPatientProfile;
openPatientProfile=async function(patientId,focusDocuments=false){
  await originalOpenPatientProfileV21(patientId,focusDocuments);
  const takePhoto=$('profileTakePhoto');
  if(takePhoto){
    takePhoto.textContent='📷 Mobile Camera';
    const webcamButton=document.createElement('button');
    webcamButton.type='button';webcamButton.id='profileWebcamPhoto';webcamButton.className='btn btn-secondary btn-small';webcamButton.textContent='🖥 Webcam Photo';
    takePhoto.parentElement.insertBefore(webcamButton,takePhoto.nextSibling);
    webcamButton.onclick=()=>openPatientPhotoWebcam(patientId);
  }
};
/* ================= END V2.1 FIX ================= */


/* ================= V3.1 CARE RECORDS + RESIDENT TIMELINE ================= */
let nursingNotes=[],shiftHandovers=[],marRecords=[],specialistNotes=[];

(function registerV31Pages(){
  const additions={
    Admin:['nursing','mar','timeline'],
    Manager:['nursing','mar','timeline'],
    Nurse:['nursing','mar','timeline'],
    Caregiver:['nursing','timeline']
  };
  Object.entries(additions).forEach(([role,pages])=>{
    rolePages[role]=rolePages[role]||[];
    pages.forEach(p=>{if(!rolePages[role].includes(p))rolePages[role].push(p)});
  });
  Object.assign(labels,{
    nursing:'Nursing & Handover',
    mar:'Medication Administration',
    timeline:'Resident Timeline'
  });
  Object.assign(navIcons,{nursing:'✎',mar:'☷',timeline:'↕'});
})();

const loadAllBeforeV31=loadAll;
loadAll=async function(){
  await loadAllBeforeV31();
  const results=await Promise.all([
    db.from('clinical_notes').select('*').order('recorded_at',{ascending:false}).limit(300),
    db.from('shift_handovers').select('*').order('recorded_at',{ascending:false}).limit(300),
    db.from('medication_administration').select('*').order('scheduled_at',{ascending:false}).limit(400),
    db.from('care_specialist_notes').select('*').order('recorded_at',{ascending:false}).limit(300)
  ]);
  const error=results.find(r=>r.error)?.error;
  if(error){
    console.warn('V3.1 tables are not ready:',error.message);
    nursingNotes=[];shiftHandovers=[];marRecords=[];specialistNotes=[];
    return;
  }
  [nursingNotes,shiftHandovers,marRecords,specialistNotes]=results.map(r=>r.data||[]);
};

function v31PatientOptions(selected=''){
  return patients.map(p=>`<option value="${esc(p.id)}" ${String(p.id)===String(selected)?'selected':''}>${esc(p.full_name)} · ${esc(p.patient_code||'')} · ${esc(p.room_no||'')}</option>`).join('');
}
function v31DateTime(value){
  if(!value)return '—';
  try{return new Date(value).toLocaleString('en-IN')}catch{return esc(value)}
}
function v31PageHead(title,subtitle,actions=''){
  return `<div class="page-head"><div><h2>${esc(title)}</h2><div class="muted">${esc(subtitle)}</div></div><div class="actions">${actions}</div></div>`;
}

function render_nursing(){
  const notes=nursingNotes.slice(0,100).map(n=>`<tr><td>${v31DateTime(n.recorded_at)}</td><td>${esc(pname(n.patient_id))}</td><td>${esc(n.note_type)}</td><td>${esc(n.note_text)}</td><td>${esc(n.observations||'—')}</td><td>${esc(staffName(n.recorded_by))}</td></tr>`).join('');
  const handovers=shiftHandovers.slice(0,100).map(h=>`<tr><td>${v31DateTime(h.recorded_at)}</td><td>${esc(pname(h.patient_id))}</td><td>${esc(h.shift)}</td><td><span class="tag ${h.priority==='Urgent'?'red':h.priority==='High'?'amber':'green'}">${esc(h.priority)}</span></td><td>${esc(h.summary)}</td><td>${esc(h.pending_tasks||'—')}</td><td>${esc(staffName(h.recorded_by))}</td></tr>`).join('');
  return `${v31PageHead('Nursing & Shift Handover','Daily nursing documentation and continuity-of-care records',
    `<button class="btn btn-secondary" id="addHandoverV31">+ Shift Handover</button><button class="btn btn-primary" id="addNursingV31">+ Nursing Note</button>`)}
  <div class="section-card"><div class="section-title"><h3>Nursing Notes</h3><button class="btn btn-secondary btn-small" onclick="window.print()">Print</button></div>
  <div class="table-wrap"><table><thead><tr><th>Date/Time</th><th>Patient</th><th>Type</th><th>Note</th><th>Observations</th><th>Recorded By</th></tr></thead><tbody>${notes||'<tr><td colspan="6">No nursing notes recorded.</td></tr>'}</tbody></table></div></div>
  <div class="section-card"><div class="section-title"><h3>Shift Handover</h3></div>
  <div class="table-wrap"><table><thead><tr><th>Date/Time</th><th>Patient</th><th>Shift</th><th>Priority</th><th>Summary</th><th>Pending Tasks</th><th>Recorded By</th></tr></thead><tbody>${handovers||'<tr><td colspan="7">No handover records.</td></tr>'}</tbody></table></div></div>`;
}

function openNursingNoteV31(){
  modal(`<div class="modal-head"><div><h3>Add Nursing Note</h3><div class="muted">Permanent clinical record</div></div><button class="close">×</button></div>
  <div class="form-grid">
   <div class="field"><label>Patient</label><select id="v31NPatient">${v31PatientOptions()}</select></div>
   ${selectWithValue('Note Type','v31NType',['General Observation','Doctor Round','Physiotherapy','Wound Care','Behaviour','Nutrition','Sleep','Elimination','Other'],'General Observation')}
   <div class="field span-2"><label>Nursing Note</label><textarea id="v31NText" rows="5"></textarea></div>
   <div class="field span-2"><label>Observations / Follow-up</label><textarea id="v31NObs" rows="3"></textarea></div>
  </div><div class="actions right"><button class="btn btn-secondary close-v31">Cancel</button><button class="btn btn-primary" id="saveNursingV31">Save Note</button></div>`);
  document.querySelector('.close-v31').onclick=closeModal;
  $('saveNursingV31').onclick=async()=>{
    try{
      const note_text=$('v31NText').value.trim();
      if(!note_text)throw new Error('Enter the nursing note.');
      const {error}=await db.from('clinical_notes').insert({
        patient_id:$('v31NPatient').value,note_type:$('v31NType').value,note_text,
        observations:$('v31NObs').value.trim()||null,recorded_by:me.id
      });
      if(error)throw error;closeModal();await loadAll();render();alert('Nursing note saved successfully.');
    }catch(e){showError(e)}
  };
}
function openHandoverV31(){
  modal(`<div class="modal-head"><div><h3>Add Shift Handover</h3><div class="muted">Record pending care and risks for the next shift</div></div><button class="close">×</button></div>
  <div class="form-grid">
   <div class="field"><label>Patient</label><select id="v31HPatient">${v31PatientOptions()}</select></div>
   ${selectWithValue('Shift','v31HShift',['Morning','Afternoon','Night'],'Morning')}
   ${selectWithValue('Priority','v31HPriority',['Routine','High','Urgent'],'Routine')}
   <div class="field span-2"><label>Handover Summary</label><textarea id="v31HSummary" rows="4"></textarea></div>
   <div class="field span-2"><label>Pending Tasks / Follow-up</label><textarea id="v31HTasks" rows="3"></textarea></div>
  </div><div class="actions right"><button class="btn btn-secondary close-v31">Cancel</button><button class="btn btn-primary" id="saveHandoverV31">Save Handover</button></div>`);
  document.querySelector('.close-v31').onclick=closeModal;
  $('saveHandoverV31').onclick=async()=>{
    try{
      const summary=$('v31HSummary').value.trim();if(!summary)throw new Error('Enter the handover summary.');
      const {error}=await db.from('shift_handovers').insert({
        patient_id:$('v31HPatient').value,shift:$('v31HShift').value,priority:$('v31HPriority').value,
        summary,pending_tasks:$('v31HTasks').value.trim()||null,recorded_by:me.id
      });
      if(error)throw error;closeModal();await loadAll();render();alert('Shift handover saved successfully.');
    }catch(e){showError(e)}
  };
}

function render_mar(){
 const rows=marRecords.slice(0,200).map(r=>`<tr><td>${v31DateTime(r.scheduled_at)}</td><td>${esc(pname(r.patient_id))}</td><td><b>${esc(r.medicine_name)}</b><br><small>${esc(r.dose||'')} ${esc(r.route||'')}</small></td><td><span class="tag ${r.status==='Given'?'green':r.status==='Missed'?'red':'amber'}">${esc(r.status)}</span></td><td>${v31DateTime(r.administered_at)}</td><td>${esc(r.remarks||'—')}</td><td>${esc(staffName(r.recorded_by))}</td></tr>`).join('');
 return `${v31PageHead('Medication Administration Record','Scheduled, administered, withheld and missed doses',
 `<button class="btn btn-secondary" id="printMarV31">Print MAR</button><button class="btn btn-primary" id="addMarV31">+ Record Medication</button>`)}
 <div class="table-wrap"><table><thead><tr><th>Scheduled</th><th>Patient</th><th>Medicine</th><th>Status</th><th>Administered</th><th>Remarks</th><th>Recorded By</th></tr></thead><tbody>${rows||'<tr><td colspan="7">No MAR records.</td></tr>'}</tbody></table></div>`;
}
function openMarV31(){
 const now=new Date();now.setMinutes(now.getMinutes()-now.getTimezoneOffset());const dt=now.toISOString().slice(0,16);
 modal(`<div class="modal-head"><div><h3>Medication Administration</h3><div class="muted">Record each dose without overwriting history</div></div><button class="close">×</button></div>
 <div class="form-grid">
  <div class="field"><label>Patient</label><select id="v31MPatient">${v31PatientOptions()}</select></div>
  ${field('Medicine','v31MMedicine')}
  ${field('Dose','v31MDose')}
  ${selectWithValue('Route','v31MRoute',['Oral','IV','IM','SC','Topical','Inhalation','Other'],'Oral')}
  <div class="field"><label>Scheduled At</label><input id="v31MScheduled" type="datetime-local" value="${dt}"></div>
  ${selectWithValue('Status','v31MStatus',['Given','Pending','Withheld','Missed','Refused'],'Given')}
  <div class="field span-2"><label>Remarks / Reason</label><textarea id="v31MRemarks" rows="3"></textarea></div>
 </div><div class="actions right"><button class="btn btn-secondary close-v31">Cancel</button><button class="btn btn-primary" id="saveMarV31">Save MAR</button></div>`);
 document.querySelector('.close-v31').onclick=closeModal;
 $('saveMarV31').onclick=async()=>{
  try{
   const medicine_name=$('v31MMedicine').value.trim();if(!medicine_name)throw new Error('Enter medicine name.');
   const status=$('v31MStatus').value;
   const {error}=await db.from('medication_administration').insert({
    patient_id:$('v31MPatient').value,medicine_name,dose:$('v31MDose').value.trim()||null,
    route:$('v31MRoute').value,scheduled_at:new Date($('v31MScheduled').value).toISOString(),
    administered_at:status==='Given'?new Date().toISOString():null,status,
    remarks:$('v31MRemarks').value.trim()||null,recorded_by:me.id
   });
   if(error)throw error;closeModal();await loadAll();render();alert('Medication administration saved.');
  }catch(e){showError(e)}
 };
}

function timelineEventsV31(patientId){
 const events=[];
 vitals.filter(x=>x.patient_id===patientId).forEach(x=>events.push({at:x.recorded_at,type:'Vital Signs',title:`BP ${x.systolic_bp||'-'}/${x.diastolic_bp||'-'} · SpO₂ ${x.spo2||'-'}% · Sugar ${x.sugar_value||'-'}`,by:staffName(x.recorded_by)}));
 care.filter(x=>x.patient_id===patientId).forEach(x=>events.push({at:x.recorded_at,type:'Daily Care',title:x.care_type||x.notes||'Care recorded',by:staffName(x.recorded_by)}));
 incidents.filter(x=>x.patient_id===patientId).forEach(x=>events.push({at:x.incident_at,type:'Incident',title:`${x.incident_type}: ${x.description||''}`,by:staffName(x.recorded_by)}));
 documents.filter(x=>x.patient_id===patientId).forEach(x=>events.push({at:x.uploaded_at,type:'Document',title:`${x.category}: ${x.title||x.file_name||''}`,by:staffName(x.uploaded_by)}));
 billing.filter(x=>x.patient_id===patientId).forEach(x=>events.push({at:x.recorded_at,type:'Billing',title:`${x.transaction_type} ₹${Number(x.amount||0).toLocaleString('en-IN')}`,by:staffName(x.recorded_by)}));
 nursingNotes.filter(x=>x.patient_id===patientId).forEach(x=>events.push({at:x.recorded_at,type:x.note_type,title:x.note_text,by:staffName(x.recorded_by)}));
 shiftHandovers.filter(x=>x.patient_id===patientId).forEach(x=>events.push({at:x.recorded_at,type:`${x.shift} Handover`,title:x.summary,by:staffName(x.recorded_by)}));
 marRecords.filter(x=>x.patient_id===patientId).forEach(x=>events.push({at:x.administered_at||x.scheduled_at,type:'MAR',title:`${x.medicine_name} ${x.dose||''} — ${x.status}`,by:staffName(x.recorded_by)}));
 specialistNotes.filter(x=>x.patient_id===patientId).forEach(x=>events.push({at:x.recorded_at,type:x.note_type,title:`${x.title||''} ${x.notes||''}`,by:staffName(x.recorded_by)}));
 return events.sort((a,b)=>new Date(b.at)-new Date(a.at));
}
function render_timeline(){
 const pid=patients[0]?.id||'';
 const options=v31PatientOptions(pid);
 return `${v31PageHead('Resident Timeline','One chronological view of clinical, care, incident, document and financial events',
 `<button class="btn btn-secondary" id="printTimelineV31">Print / PDF</button>`)}
 <div class="timeline-filter card"><div class="field"><label>Patient</label><select id="timelinePatientV31">${options}</select></div><div class="field"><label>Event Type</label><select id="timelineTypeV31"><option value="all">All Events</option><option>Vital Signs</option><option>Daily Care</option><option>Incident</option><option>Document</option><option>Billing</option><option>MAR</option></select></div></div>
 <div id="timelineBodyV31">${renderTimelineBodyV31(pid,'all')}</div>`;
}
function renderTimelineBodyV31(patientId,type='all'){
 const rows=timelineEventsV31(patientId).filter(e=>type==='all'||e.type===type);
 return `<div class="resident-timeline">${rows.map(e=>`<article class="timeline-entry"><div class="timeline-dot"></div><div class="timeline-card"><div class="timeline-meta"><b>${esc(e.type)}</b><span>${v31DateTime(e.at)}</span></div><div>${esc(e.title)}</div><small class="muted">Recorded by ${esc(e.by)}</small></div></article>`).join('')||'<div class="empty-state">No timeline events for this patient.</div>'}</div>`;
}
function refreshTimelineV31(){
 const pid=$('timelinePatientV31')?.value,type=$('timelineTypeV31')?.value||'all';
 if($('timelineBodyV31'))$('timelineBodyV31').innerHTML=renderTimelineBodyV31(pid,type);
}

const bindPageActionsBeforeV31=bindPageActions;
bindPageActions=function(){
 bindPageActionsBeforeV31();
 $('addNursingV31')?.addEventListener('click',openNursingNoteV31);
 $('addHandoverV31')?.addEventListener('click',openHandoverV31);
 $('addMarV31')?.addEventListener('click',openMarV31);
 $('printMarV31')?.addEventListener('click',()=>window.print());
 $('timelinePatientV31')?.addEventListener('change',refreshTimelineV31);
 $('timelineTypeV31')?.addEventListener('change',refreshTimelineV31);
 $('printTimelineV31')?.addEventListener('click',()=>window.print());
};
/* ================= END V3.1 ================= */


/* ================= V3.2 CLINICAL INTELLIGENCE ================= */
let carePlans=[],riskAssessments=[],doctorNotes=[],nutritionAssessments=[];

(function registerV32Pages(){
  const additions={
    Admin:['clinical-intelligence'],
    Manager:['clinical-intelligence'],
    Nurse:['clinical-intelligence']
  };
  Object.entries(additions).forEach(([role,pages])=>{
    rolePages[role]=rolePages[role]||[];
    pages.forEach(p=>{if(!rolePages[role].includes(p))rolePages[role].push(p)});
  });
  labels['clinical-intelligence']='Clinical Intelligence';
  navIcons['clinical-intelligence']='◆';
})();

const loadAllBeforeV32=loadAll;
loadAll=async function(){
  await loadAllBeforeV32();
  const results=await Promise.all([
    db.from('care_plans').select('*').order('updated_at',{ascending:false}).limit(300),
    db.from('risk_assessments').select('*').order('assessed_at',{ascending:false}).limit(500),
    db.from('doctor_visit_notes').select('*').order('visit_at',{ascending:false}).limit(300),
    db.from('nutrition_assessments').select('*').order('assessed_at',{ascending:false}).limit(300)
  ]);
  const error=results.find(r=>r.error)?.error;
  if(error){
    console.warn('V3.2 tables are not ready:',error.message);
    carePlans=[];riskAssessments=[];doctorNotes=[];nutritionAssessments=[];
    return;
  }
  [carePlans,riskAssessments,doctorNotes,nutritionAssessments]=results.map(r=>r.data||[]);
};

function calcMorseScoreV32(){
  const fall=Number($('morseFallHistory')?.value||0);
  const diagnosis=Number($('morseSecondaryDiagnosis')?.value||0);
  const aid=Number($('morseAmbulatoryAid')?.value||0);
  const iv=Number($('morseIvTherapy')?.value||0);
  const gait=Number($('morseGait')?.value||0);
  const mental=Number($('morseMentalStatus')?.value||0);
  return fall+diagnosis+aid+iv+gait+mental;
}
function morseLevelV32(score){return score>=45?'High':score>=25?'Moderate':'Low'}
function calcBradenScoreV32(){
  return ['bradenSensory','bradenMoisture','bradenActivity','bradenMobility','bradenNutrition','bradenFriction']
    .reduce((sum,id)=>sum+Number($(id)?.value||0),0);
}
function bradenLevelV32(score){return score<=9?'Very High':score<=12?'High':score<=14?'Moderate':score<=18?'At Risk':'Low'}
function painLevelV32(score){return score>=7?'Severe':score>=4?'Moderate':score>=1?'Mild':'No Pain'}

function latestRiskForPatientV32(patientId,type){
  return riskAssessments.find(r=>r.patient_id===patientId&&r.assessment_type===type);
}
function render_clinical_intelligence(){
  const highFall=patients.filter(p=>['High'].includes(latestRiskForPatientV32(p.id,'Morse Fall Scale')?.risk_level)).length;
  const highBraden=patients.filter(p=>['High','Very High'].includes(latestRiskForPatientV32(p.id,'Braden Scale')?.risk_level)).length;
  const severePain=patients.filter(p=>['Severe'].includes(latestRiskForPatientV32(p.id,'Pain Assessment')?.risk_level)).length;
  const activePlans=carePlans.filter(p=>p.status==='Active').length;

  const riskRows=riskAssessments.slice(0,120).map(r=>`<tr>
   <td>${new Date(r.assessed_at).toLocaleString('en-IN')}</td>
   <td>${esc(pname(r.patient_id))}</td>
   <td>${esc(r.assessment_type)}</td>
   <td>${esc(r.score)}</td>
   <td><span class="tag ${['High','Very High','Severe'].includes(r.risk_level)?'red':r.risk_level==='Moderate'?'amber':'green'}">${esc(r.risk_level)}</span></td>
   <td>${esc(staffName(r.assessed_by))}</td>
   <td>${esc(r.remarks||'—')}</td></tr>`).join('');

  const doctorRows=doctorNotes.slice(0,80).map(n=>`<tr>
   <td>${new Date(n.visit_at).toLocaleString('en-IN')}</td>
   <td>${esc(pname(n.patient_id))}</td>
   <td>${esc(n.doctor_name)}</td>
   <td>${esc(n.clinical_findings)}</td>
   <td>${esc(n.advice||'—')}</td>
   <td>${esc(n.next_review_date||'—')}</td></tr>`).join('');

  return `<div class="page-head"><div><h2>Clinical Intelligence</h2><div class="muted">Structured risk assessments, care plans and doctor reviews</div></div>
   <div class="actions"><button class="btn btn-secondary" id="printClinicalV32">Print / PDF</button><button class="btn btn-primary" id="addAssessmentV32">+ Assessment</button></div></div>
   <div class="metrics clinical-metrics-v32">
    ${metric('High Fall Risk',highFall,'Morse Scale','red','')}
    ${metric('Pressure Ulcer Risk',highBraden,'Braden Scale','red','')}
    ${metric('Severe Pain',severePain,'Immediate review','red','')}
    ${metric('Active Care Plans',activePlans,'Current plans','','')}
   </div>
   <div class="actions clinical-actions-v32">
    <button class="btn btn-secondary" id="addCarePlanV32">+ Care Plan</button>
    <button class="btn btn-secondary" id="addDoctorNoteV32">+ Doctor Visit Note</button>
    <button class="btn btn-secondary" id="addNutritionV32">+ Nutrition Assessment</button>
   </div>
   <div class="section-card"><div class="section-title"><h3>Recent Risk Assessments</h3></div>
    <div class="table-wrap"><table><thead><tr><th>Date</th><th>Patient</th><th>Assessment</th><th>Score</th><th>Risk</th><th>Assessed By</th><th>Remarks</th></tr></thead><tbody>${riskRows||'<tr><td colspan="7">No assessments recorded.</td></tr>'}</tbody></table></div>
   </div>
   <div class="section-card"><div class="section-title"><h3>Doctor Visit Notes</h3></div>
    <div class="table-wrap"><table><thead><tr><th>Visit</th><th>Patient</th><th>Doctor</th><th>Findings</th><th>Advice</th><th>Next Review</th></tr></thead><tbody>${doctorRows||'<tr><td colspan="6">No doctor visit notes.</td></tr>'}</tbody></table></div>
   </div>`;
}

function openAssessmentV32(){
  modal(`<div class="modal-head"><div><h3>Clinical Risk Assessment</h3><div class="muted">Morse, Braden or Pain Assessment</div></div><button class="close">×</button></div>
   <div class="form-grid">
    <div class="field"><label>Patient</label><select id="riskPatientV32">${v31PatientOptions()}</select></div>
    <div class="field"><label>Assessment Type</label><select id="riskTypeV32"><option>Morse Fall Scale</option><option>Braden Scale</option><option>Pain Assessment</option></select></div>
   </div>
   <div id="riskFormV32"></div>
   <div class="actions right"><button class="btn btn-secondary close-v32">Cancel</button><button class="btn btn-primary" id="saveRiskV32">Save Assessment</button></div>`);
  document.querySelector('.close-v32').onclick=closeModal;
  const renderRiskForm=()=>{
    const t=$('riskTypeV32').value;
    if(t==='Morse Fall Scale'){
      $('riskFormV32').innerHTML=`<div class="form-grid">
       ${selectWithValue('History of Falling','morseFallHistory',['0','25'],'0')}
       ${selectWithValue('Secondary Diagnosis','morseSecondaryDiagnosis',['0','15'],'0')}
       ${selectWithValue('Ambulatory Aid','morseAmbulatoryAid',['0','15','30'],'0')}
       ${selectWithValue('IV / Heparin Lock','morseIvTherapy',['0','20'],'0')}
       ${selectWithValue('Gait / Transfer','morseGait',['0','10','20'],'0')}
       ${selectWithValue('Mental Status','morseMentalStatus',['0','15'],'0')}
       <div class="field span-2"><label>Remarks</label><textarea id="riskRemarksV32" rows="3"></textarea></div></div>`;
    }else if(t==='Braden Scale'){
      $('riskFormV32').innerHTML=`<div class="form-grid">
       ${selectWithValue('Sensory Perception','bradenSensory',['1','2','3','4'],'4')}
       ${selectWithValue('Moisture','bradenMoisture',['1','2','3','4'],'4')}
       ${selectWithValue('Activity','bradenActivity',['1','2','3','4'],'4')}
       ${selectWithValue('Mobility','bradenMobility',['1','2','3','4'],'4')}
       ${selectWithValue('Nutrition','bradenNutrition',['1','2','3','4'],'4')}
       ${selectWithValue('Friction & Shear','bradenFriction',['1','2','3'],'3')}
       <div class="field span-2"><label>Remarks</label><textarea id="riskRemarksV32" rows="3"></textarea></div></div>`;
    }else{
      $('riskFormV32').innerHTML=`<div class="form-grid">
       <div class="field"><label>Pain Score (0–10)</label><input id="painScoreV32" type="number" min="0" max="10" value="0"></div>
       <div class="field"><label>Location</label><input id="painLocationV32"></div>
       <div class="field"><label>Nature</label><input id="painNatureV32" placeholder="Sharp, dull, burning..."></div>
       <div class="field span-2"><label>Intervention / Remarks</label><textarea id="riskRemarksV32" rows="3"></textarea></div></div>`;
    }
  };
  $('riskTypeV32').onchange=renderRiskForm;renderRiskForm();

  $('saveRiskV32').onclick=async()=>{
    try{
      const type=$('riskTypeV32').value;let score=0,level='',details={};
      if(type==='Morse Fall Scale'){score=calcMorseScoreV32();level=morseLevelV32(score)}
      else if(type==='Braden Scale'){score=calcBradenScoreV32();level=bradenLevelV32(score)}
      else{
        score=Number($('painScoreV32').value||0);level=painLevelV32(score);
        details={location:$('painLocationV32').value.trim(),nature:$('painNatureV32').value.trim()};
      }
      const {error}=await db.from('risk_assessments').insert({
        patient_id:$('riskPatientV32').value,assessment_type:type,score,risk_level:level,
        details,remarks:$('riskRemarksV32').value.trim()||null,assessed_by:me.id
      });
      if(error)throw error;closeModal();await loadAll();render();alert(`${type} saved. Score: ${score}. Risk: ${level}.`);
    }catch(e){showError(e)}
  };
}

function openCarePlanV32(){
  modal(`<div class="modal-head"><div><h3>Resident Care Plan</h3></div><button class="close">×</button></div>
   <div class="form-grid">
    <div class="field"><label>Patient</label><select id="cpPatientV32">${v31PatientOptions()}</select></div>
    ${selectWithValue('Status','cpStatusV32',['Active','On Hold','Completed'],'Active')}
    <div class="field span-2"><label>Problems / Needs</label><textarea id="cpProblemsV32" rows="3"></textarea></div>
    <div class="field span-2"><label>Goals</label><textarea id="cpGoalsV32" rows="3"></textarea></div>
    <div class="field span-2"><label>Interventions</label><textarea id="cpInterventionsV32" rows="4"></textarea></div>
    <div class="field span-2"><label>Evaluation / Review</label><textarea id="cpEvaluationV32" rows="3"></textarea></div>
   </div><div class="actions right"><button class="btn btn-secondary close-v32">Cancel</button><button class="btn btn-primary" id="saveCarePlanV32">Save Care Plan</button></div>`);
  document.querySelector('.close-v32').onclick=closeModal;
  $('saveCarePlanV32').onclick=async()=>{
    try{
      const {error}=await db.from('care_plans').insert({
        patient_id:$('cpPatientV32').value,status:$('cpStatusV32').value,
        problems:$('cpProblemsV32').value.trim(),goals:$('cpGoalsV32').value.trim(),
        interventions:$('cpInterventionsV32').value.trim(),evaluation:$('cpEvaluationV32').value.trim()||null,
        created_by:me.id,updated_by:me.id
      });
      if(error)throw error;closeModal();await loadAll();render();alert('Care plan saved.');
    }catch(e){showError(e)}
  };
}

function openDoctorNoteV32(){
  const today=new Date().toISOString().slice(0,10);
  modal(`<div class="modal-head"><div><h3>Doctor Visit Note</h3></div><button class="close">×</button></div>
   <div class="form-grid">
    <div class="field"><label>Patient</label><select id="docPatientV32">${v31PatientOptions()}</select></div>
    ${field('Doctor Name','docNameV32')}
    <div class="field span-2"><label>Clinical Findings</label><textarea id="docFindingsV32" rows="4"></textarea></div>
    <div class="field span-2"><label>Advice / Treatment</label><textarea id="docAdviceV32" rows="4"></textarea></div>
    <div class="field"><label>Next Review Date</label><input id="docReviewV32" type="date" value="${today}"></div>
   </div><div class="actions right"><button class="btn btn-secondary close-v32">Cancel</button><button class="btn btn-primary" id="saveDoctorV32">Save Note</button></div>`);
  document.querySelector('.close-v32').onclick=closeModal;
  $('saveDoctorV32').onclick=async()=>{
    try{
      const {error}=await db.from('doctor_visit_notes').insert({
        patient_id:$('docPatientV32').value,doctor_name:$('docNameV32').value.trim(),
        clinical_findings:$('docFindingsV32').value.trim(),advice:$('docAdviceV32').value.trim()||null,
        next_review_date:$('docReviewV32').value||null,recorded_by:me.id
      });
      if(error)throw error;closeModal();await loadAll();render();alert('Doctor visit note saved.');
    }catch(e){showError(e)}
  };
}

function openNutritionV32(){
  modal(`<div class="modal-head"><div><h3>Nutrition Assessment</h3></div><button class="close">×</button></div>
   <div class="form-grid">
    <div class="field"><label>Patient</label><select id="nutPatientV32">${v31PatientOptions()}</select></div>
    ${selectWithValue('Appetite','nutAppetiteV32',['Good','Fair','Poor'],'Good')}
    ${selectWithValue('Swallowing','nutSwallowV32',['Normal','Mild Difficulty','Severe Difficulty'],'Normal')}
    ${selectWithValue('Diet Type','nutDietV32',['Regular','Diabetic','Renal','Soft','Liquid','Tube Feed','Other'],'Regular')}
    <div class="field"><label>Weight Loss (kg)</label><input id="nutWeightLossV32" type="number" step="0.1" min="0"></div>
    <div class="field span-2"><label>Recommendations</label><textarea id="nutRecommendationsV32" rows="4"></textarea></div>
   </div><div class="actions right"><button class="btn btn-secondary close-v32">Cancel</button><button class="btn btn-primary" id="saveNutritionV32">Save Assessment</button></div>`);
  document.querySelector('.close-v32').onclick=closeModal;
  $('saveNutritionV32').onclick=async()=>{
    try{
      const {error}=await db.from('nutrition_assessments').insert({
        patient_id:$('nutPatientV32').value,appetite:$('nutAppetiteV32').value,
        swallowing:$('nutSwallowV32').value,diet_type:$('nutDietV32').value,
        weight_loss_kg:Number($('nutWeightLossV32').value||0),
        recommendations:$('nutRecommendationsV32').value.trim()||null,assessed_by:me.id
      });
      if(error)throw error;closeModal();await loadAll();render();alert('Nutrition assessment saved.');
    }catch(e){showError(e)}
  };
}

const bindPageActionsBeforeV32=bindPageActions;
bindPageActions=function(){
  bindPageActionsBeforeV32();
  $('addAssessmentV32')?.addEventListener('click',openAssessmentV32);
  $('addCarePlanV32')?.addEventListener('click',openCarePlanV32);
  $('addDoctorNoteV32')?.addEventListener('click',openDoctorNoteV32);
  $('addNutritionV32')?.addEventListener('click',openNutritionV32);
  $('printClinicalV32')?.addEventListener('click',()=>window.print());
};
/* ================= END V3.2 ================= */
