(async()=>{
 await window.loomReady;
 const $=id=>document.getElementById(id),client=new URLSearchParams(location.search).get('view')==='client';
 const forbidden=new Set(['studyPreset','material','fibre','reset','copy','apiKey','exportProject','importProject','projectFile','textFontUpload']);
 const entries=[...document.querySelectorAll('aside input[id],aside select[id],aside textarea[id],aside button[id]')].filter(e=>!forbidden.has(e.id)&&e.type!=='password'&&e.type!=='hidden'&&!e.closest('#palette')&&!e.id.startsWith('ai'));
 entries.unshift(document.getElementById('families'),document.getElementById('palette'));
 const label=e=>({families:'Palette selection',palette:'Edit palette colours'}[e.id])||document.querySelector(`label[for="${e.id}"]`)?.textContent?.trim()||e.closest('label')?.textContent?.trim()||e.textContent?.trim()||e.id;
 const defaults=window.loomSharedStudy?.allowed||['pattern','seed','exportSize','exportPng','exportSvg'];
 const snapshot=()=>({state:window.loom.getState(),values:Object.fromEntries(entries.filter(e=>e.type!=='file'&&['INPUT','SELECT','TEXTAREA'].includes(e.tagName)).map(e=>[e.id,e.type==='checkbox'?e.checked:e.value]))});
 const compress=async obj=>{const stream=new Blob([JSON.stringify(obj)]).stream().pipeThrough(new CompressionStream('gzip'));const bytes=new Uint8Array(await new Response(stream).arrayBuffer());let str='';for(const b of bytes)str+=String.fromCharCode(b);return btoa(str).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
 const unpack=async str=>{const bytes=Uint8Array.from(atob(str.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));return JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text())};
 if(client){
 document.documentElement.classList.add('client-mode');
 try{
 const config=await unpack(location.hash.slice(1));if(config.version!==1||!Array.isArray(config.allowed))throw Error('Invalid client link');
 await window.loom.setState(config.state);for(const [id,v] of Object.entries(config.values||{})){const e=$(id);if(e&&e.type!=='file'&&e.type!=='password'){if(e.type==='checkbox')e.checked=!!v;else e.value=v}}
 window.clientLock=()=>{for(const [id,v] of Object.entries({...config.state.controls,...config.values})){if(config.allowed.includes(id))continue;const e=$(id);if(e&&e.type!=='file'&&e.type!=='password'){if(e.type==='checkbox')e.checked=!!v;else e.value=v}}};window.loom.render();
 const aside=document.createElement('aside');aside.className='client-controls';
 const originalSections=[...document.querySelectorAll('main>aside>.section')];
 const groups=new Map();
 for(const name of ['Colour','Weave','Pattern','Images','Export']){
  const section=document.createElement(name==='Colour'?'section':'details');section.className='client-section'+(name==='Export'?' client-output':'');
  const heading=document.createElement(name==='Colour'?'h3':'summary');heading.textContent=name;section.append(heading);
  const content=document.createElement('div');content.className='client-section-content';section.append(content);groups.set(name,{section,content});aside.append(section);
 }
 for(const e of entries){
  if(!config.allowed.includes(e.id))continue;
  const index=originalSections.indexOf(e.closest('.section'));
  const name=['complexity','scale'].includes(e.id)?'Pattern':index===0?'Colour':index===1?'Weave':index===3?'Images':index>=4?'Export':'Pattern';
  const row=document.createElement('div');row.className='client-field';
  if(e.tagName!=='BUTTON'){const l=document.createElement('label');l.htmlFor=e.id;l.textContent=label(e);row.append(l)}
  row.append(e);if(e.type==='range'){const v=document.createElement('output');v.textContent=e.value;e.addEventListener('input',()=>v.textContent=e.value);row.append(v)}groups.get(name).content.append(row);
 }
 for(const [name,{section,content}] of groups){if(!content.children.length){if(name==='Colour'){const note=document.createElement('p');note.className='hints';note.textContent='Palette set by the studio.';content.append(note)}else section.hidden=true}}
 const hide=$('hideUI');hide.classList.add('client-hide-ui');document.body.append(hide);
 document.querySelector('main').prepend(aside);for(const id of ['previewDensity','previewImageAmount']){const e=$(id);if(e){e.disabled=true;e.closest('.preview-adjustments')?.remove();e.parentElement.style.display='none'}}
 const old=document.querySelector('aside:not(.client-controls)');old.hidden=true;
 document.addEventListener('keydown',e=>{if(e.key==='Escape'||(e.key.toLowerCase()==='h'&&!e.target.closest('input,textarea,select')))return;if(!e.target.closest('.client-controls')){e.stopImmediatePropagation();e.preventDefault()}},true);
 document.querySelector('header h1').textContent='looki weave creator';
 }catch(e){document.body.textContent='This client link is incomplete. Ask the studio admin for a new link.'}
 return;
 }
 return;
 let allowed;try{allowed=JSON.parse(localStorage.getItem('loom-client-tools'))||defaults}catch{allowed=defaults}
 const launch=document.createElement('button');launch.textContent='Share client view';launch.className='primary';document.querySelector('.header-actions').prepend(launch);
 const dialog=document.createElement('dialog');dialog.className='client-config';const heading=document.createElement('h2');heading.textContent='Share client view';dialog.append(heading);
 const note=document.createElement('p');note.textContent='Use the Client tick boxes beside each sidebar parameter to choose what clients can change. Unchecked parameters stay locked to this setup. Sign-in is currently off.';dialog.append(note);
 const checks=[];for(const e of entries){const row=document.createElement('label'),check=document.createElement('input');row.className='client-inline-permission';check.type='checkbox';check.checked=allowed.includes(e.id);check.dataset.control=e.id;check.setAttribute('aria-label','Show '+label(e)+' to clients');row.title='Checked: clients can change this. Unchecked: locked to your setup.';row.append(check,document.createTextNode('Client'));const heading=document.querySelector(`label[for="${e.id}"]`);if(heading){heading.insertAdjacentElement('afterend',row)}else{e.insertAdjacentElement('beforebegin',row)}checks.push(check);check.addEventListener('change',()=>{allowed=checks.filter(c=>c.checked).map(c=>c.dataset.control);localStorage.setItem('loom-client-tools',JSON.stringify(allowed))})}
 const output=document.createElement('textarea');output.readOnly=true;output.placeholder='Your client link will appear here';dialog.append(output);
 const status=document.createElement('p');status.setAttribute('role','status');dialog.append(status);
 const make=document.createElement('button');make.textContent='Create client link';make.className='primary';make.onclick=async()=>{make.disabled=true;try{allowed=checks.filter(c=>c.checked).map(c=>c.dataset.control);localStorage.setItem('loom-client-tools',JSON.stringify(allowed));const encoded=await compress({version:1,allowed,...snapshot()});output.value=location.origin+location.pathname+'?view=client#'+encoded;status.textContent='Link ready. It contains a snapshot of this setup; create a new link after changing the locked settings.'}catch(e){status.textContent='Could not create link: '+e.message}finally{make.disabled=false}};
 const copy=document.createElement('button');copy.textContent='Copy link';copy.onclick=async()=>{if(!output.value)return;try{await navigator.clipboard.writeText(output.value);status.textContent='Client link copied.'}catch{output.select();status.textContent='Select and copy the link above.'}};
 const preview=document.createElement('button');preview.textContent='Preview client';preview.onclick=()=>{if(output.value)window.open(output.value,'_blank','noopener')};
 const close=document.createElement('button');close.textContent='Close';close.onclick=()=>dialog.close();dialog.append(make,copy,preview,close);document.body.append(dialog);launch.onclick=()=>dialog.showModal();
})();

// Camera capture and social export framing are added after the studio is ready.
(async()=>{
 const $=id=>document.getElementById(id), status=$('status');
 const imageUpload=$('imageUpload'),imageSection=imageUpload?.closest('.section');
 const exportButton=$('exportPng'),exportSection=exportButton?.closest('.section');
 if(!imageSection||!exportSection)return;
 // The standalone live camera controller owns the camera controls.
 const format=document.createElement('select');format.id='exportFormat';format.innerHTML='<option value="square">Square · 1:1</option><option value="portrait" selected>Portrait · 9:16 (vertical)</option><option value="landscape">Landscape · 16:9</option>';
 const formatLabel=document.createElement('label');formatLabel.htmlFor='exportFormat';formatLabel.textContent='Output format';exportSection.prepend(formatLabel,format);
 const size=() => Math.max(1,+$('exportSize').value||1024);
 const dims=()=>{const s=size(),f=format.value;return f==='portrait'?{width:s,height:Math.round(s*16/9)}:f==='landscape'?{width:Math.round(s*16/9),height:s}:{width:s,height:s}};
 $('exportPng').onclick=()=>{const source=window.loomLive?.active ? window.loomLive.canvas : $('art'),out=document.createElement('canvas'),d=dims(),g=out.getContext('2d');out.width=d.width;out.height=d.height;g.fillStyle='#10130e';g.fillRect(0,0,d.width,d.height);const scale=Math.max(d.width/source.width,d.height/source.height),w=source.width*scale,h=source.height*scale;g.drawImage(source,(d.width-w)/2,(d.height-h)/2,w,h);out.toBlob(blob=>{if(!blob)return;const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='looki-weave-'+format.value+'-'+d.width+'x'+d.height+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);if(status)status.textContent='PNG exported at '+d.width+' × '+d.height+' px.'},'image/png')};
})();
