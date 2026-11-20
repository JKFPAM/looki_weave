// Photographic treatment uses a solid stitch silhouette, without yarn styling.
function solidPhotoCell(g,photo,base,x,y,w,h,r){
 g.save();g.beginPath();g.moveTo(x+r,y);g.lineTo(x+w-r,y);g.quadraticCurveTo(x+w,y,x+w,y+r);g.lineTo(x+w,y+h-r);g.quadraticCurveTo(x+w,y+h,x+w-r,y+h);g.lineTo(x+r,y+h);g.quadraticCurveTo(x,y+h,x,y+h-r);g.lineTo(x,y+r);g.quadraticCurveTo(x,y,x+r,y);g.closePath();
 g.fillStyle=base;g.fill();g.globalAlpha*=photo.amount;g.fillStyle=photo.pattern;g.fill();g.restore();
}
// Fill the loop's interior but retain its actual outer yarn contour.
function solidPhotoKnit(g,photo,base,c,rib,i,j,seed){
 const el=id=>document.getElementById(id),density=+el('density').value,mat=el('material').value;
 const nx=(i+.5)/density,ny=(j+.5)/density,col=nx<.44?0:nx<.72?1:2;
 const local=((ny+[.035,0,.06][col])%.29+.29)%.29,seam=rib&&(local<.026||local>.27);
 const noise=Math.abs(Math.sin(i*127.1+j*311.7+seed));
 const rx=c*(rib?(col===1?.114:.099):.3811),ry=c*(seam?.606:rib?.79:.7395);
 const width=c*(rib?.58:.50)*(+el('yarnWidth').value/92)*(mat==='linen'?.90+noise*.20:mat==='wool'?1.06:1);
 g.save();g.lineCap='round';g.lineJoin='round';g.lineWidth=width;
 g.beginPath();g.moveTo(-rx,-ry*.76);g.bezierCurveTo(-rx*.8,-ry*.12,-rx*.65,ry*.78,0,ry*.72);g.bezierCurveTo(rx*.65,ry*.78,rx*.8,-ry*.12,rx,-ry*.76);
 g.fillStyle=g.strokeStyle=base;g.fill();g.stroke();g.globalAlpha*=photo.amount;g.fillStyle=g.strokeStyle=photo.pattern;g.fill();g.stroke();g.restore();
}
function drawCrossing(g,base,x,y,t,over,i,j,seed,leading=true,trailing=true){
 const solid=window.loomPhoto?.paint(g,i,j,false);if(solid){solidPhotoCell(g,solid,base,x,y,t+.5,t+.5,0);return}
 g.save();const boundary=i===0||j===0||i===+document.getElementById('density').value*2-1||j===+document.getElementById('density').value*2-1;
 if(boundary){const r=t*.28;g.beginPath();g.moveTo(x+r,y);g.lineTo(x+t-r,y);g.quadraticCurveTo(x+t,y,x+t,y+r);g.lineTo(x+t,y+t-r);g.quadraticCurveTo(x+t,y+t,x+t-r,y+t);g.lineTo(x+r,y+t);g.quadraticCurveTo(x,y+t,x,y+t-r);g.lineTo(x,y+r);g.quadraticCurveTo(x,y,x+r,y);g.closePath();g.clip()}
 const $=id=>document.getElementById(id),rel=+$('relief').value/100,detail=+$('fibre').value/100,mat=$('material').value;
 const hash=(a,b)=>{const v=Math.sin(a*127.1+b*311.7+seed)*43758.5453;return v-Math.floor(v)},jitter=hash(i,j);
 const components=base.startsWith('rgb')?(base.match(/[\d.]+/g)||[]).slice(0,3).map(Number):[1,3,5].map(n=>parseInt(base.slice(n,n+2),16));
 const tone=v=>'rgb('+components.map(n=>Math.round(Math.max(0,Math.min(255,v>0?n+(255-n)*v:n*(1+v))))).join(',')+')';
 const strandNoise=hash(over?i:0,over?0:j);const variation=mat==='linen'?(strandNoise-.5)*.12:mat==='wool'?(strandNoise-.5)*.07:(strandNoise-.5)*.025;
 const width=+$('yarnWidth').value/100*(mat==='linen'?.94+jitter*.06:1),gap=(1-width)*t/2;
 const shadow=+document.getElementById('threadShadow').value/100;g.fillStyle=tone(-.85*shadow);g.fillRect(x,y,t+.5,t+.5);
 // Underpassing yarn remains visible between the raised strands.
 g.fillStyle=tone(-.45*shadow);g.fillRect(x+gap*.45,y+gap*.45,t-gap*.9+.3,t-gap*.9+.3);
 const grad=over?g.createLinearGradient(x,y,x+t,y):g.createLinearGradient(x,y,x,y+t);
 const gloss=mat==='silk'?1.35:mat==='wool'?.65:mat==='linen'?.7:1;
 grad.addColorStop(0,tone(-.38*rel+variation));grad.addColorStop(.18,tone(-.06*rel+variation));grad.addColorStop(mat==='silk'?.36:.42,tone(.30*rel*gloss+variation));grad.addColorStop(.67,tone(.08*rel+variation));grad.addColorStop(1,tone(-.43*rel+variation));g.fillStyle=grad;
 if(over)g.fillRect(x+gap,y,t-2*gap,t+.35);else g.fillRect(x,y+gap,t+.35,t-2*gap);
 const photo=window.loomPhoto?.paint(g,i,j,false);if(photo){g.save();g.globalAlpha*=photo.amount;g.fillStyle=photo.pattern;if(over)g.fillRect(x+gap,y,t-2*gap,t+.35);else g.fillRect(x,y+gap,t+.35,t-2*gap);g.restore()}
 // Fine twisted filaments run along the strand, rather than a generic noise layer.
 if(detail>0){g.save();g.beginPath();g.rect(x+gap,y+gap,t-2*gap,t-2*gap);g.clip();const strands=Math.max(2,Math.round((mat==='wool'?9:6)*detail));g.lineWidth=Math.max(.32,t*.018);for(let k=0;k<strands;k++){const pos=(k+.5)/strands*t;g.strokeStyle=k%2?tone(-.17*detail):tone(.22*detail);g.globalAlpha=.35+detail*.4;g.beginPath();for(let z=0;z<=4;z++){const a=z/4*t,b=pos+Math.sin((z/4+(over?j:i))*.85*Math.PI*2)*t*.06;if(z===0)g.moveTo(x+(over?b:a),y+(over?a:b));else g.lineTo(x+(over?b:a),y+(over?a:b))}g.stroke()}if(mat==='linen'&&jitter>.86){g.globalAlpha=.3;g.fillStyle=tone(.2);g.fillRect(x+t*.32,y+t*.25,t*.17,t*.45)}g.restore()}
 // Contact shadow at the crossing makes the over/under structure read clearly.
 g.fillStyle='rgba(15,18,12,'+(.14*rel)+')';if(over){if(leading)g.fillRect(x+gap,y,t-2*gap,t*.09);if(trailing)g.fillRect(x+gap,y+t*.91,t-2*gap,t*.09)}else{if(leading)g.fillRect(x,y+gap,t*.09,t-2*gap);if(trailing)g.fillRect(x+t*.91,y+gap,t*.09,t-2*gap)}
g.restore();
}
const knitSprites=new Map();let knitSpriteKey='';
function drawKnitStitch(g,base,c,rib,i,j,seed,texture){
 if(window.loomVectorExport||window.loomPhoto){paintKnitStitch(g,base,c,rib,i,j,seed,texture);return}
 const ids=['density','relief','fibre','material','threadShadow','yarnWidth'],values=ids.map(id=>document.getElementById(id).value),settings=values.join('|')+'|'+c+'|'+texture;
 if(settings!==knitSpriteKey){knitSprites.clear();knitSpriteKey=settings}
 const col=(i+.5)/+values[0]<.44?0:(i+.5)/+values[0]<.72?1:2,ny=(j+.5)/+values[0],local=((ny+[.035,0,.06][col])%.29+.29)%.29,seam=local<.026||local>.27;
 const key=[base,rib,col,seam,values[3]==='linen'?i+','+j+','+seed:''].join('|');let sprite=knitSprites.get(key);
 if(!sprite){const size=Math.ceil(c*4),canvas=document.createElement('canvas');canvas.width=canvas.height=size;const context=canvas.getContext('2d');context.translate(size/2,size/2);paintKnitStitch(context,base,c,rib,i,j,seed,texture);sprite={canvas,size};if(knitSprites.size<512)knitSprites.set(key,sprite)}
 g.drawImage(sprite.canvas,-sprite.size/2,-sprite.size/2);
}
function paintKnitStitch(g,base,c,rib,i,j,seed,texture){
 const solid=window.loomPhoto?.paint(g,i,j,true);if(solid){solidPhotoKnit(g,solid,base,c,rib,i,j,seed);return}
 const rel=+document.getElementById('relief').value/100,detail=+document.getElementById('fibre').value/100,mat=document.getElementById('material').value,shadow=+document.getElementById('threadShadow').value/100;
 const noise=Math.abs(Math.sin(i*127.1+j*311.7+seed));
 const gloss=mat==='silk'?1.5:mat==='wool'?.6:mat==='linen'?.75:1;

 const rgb=base.startsWith('rgb')?base.match(/[\d.]+/g).slice(0,3).map(Number):[1,3,5].map(n=>parseInt(base.slice(n,n+2),16));
 const tone=v=>'rgb('+rgb.map(n=>Math.round(v<0?n*(1+v):n+(255-n)*v)).join(',')+')';
 const density=+document.getElementById('density').value,nx=(i+.5)/density,ny=(j+.5)/density,col=nx<.44?0:nx<.72?1:2;
 const local=((ny+[.035,0,.06][col])%.29+.29)%.29,seam=rib&&(local<.026||local>.27);
 const rx=c*(rib?(col===1?.114:.099):.3811),ry=c*(seam?.606:rib?.79:.7395),width=c*(rib?.58:.50)*(+document.getElementById('yarnWidth').value/92)*(mat==='linen'?.90+noise*.20:mat==='wool'?1.06:1);
 if(texture&&shadow){g.fillStyle=tone(-.65*shadow);g.beginPath();g.ellipse(0,0,rx*1.12,ry*.98,0,0,Math.PI*2);g.fill()}
 g.lineCap='round';g.lineJoin='round';g.strokeStyle=base;g.lineWidth=width;g.shadowColor='rgba(0,0,0,'+(shadow*.55)+')';g.shadowBlur=c*.12*shadow;g.shadowOffsetY=c*.10*shadow;
 g.beginPath();g.moveTo(-rx,-ry*.76);g.bezierCurveTo(-rx*.8,-ry*.12,-rx*.65,ry*.78,0,ry*.72);g.bezierCurveTo(rx*.65,ry*.78,rx*.8,-ry*.12,rx,-ry*.76);g.stroke();
 g.shadowColor='transparent';g.shadowBlur=0;g.shadowOffsetY=0;
 const photo=window.loomPhoto?.paint(g,i,j,true);if(photo){g.save();g.globalAlpha*=photo.amount;g.strokeStyle=photo.pattern;g.stroke();g.restore()}
 if(texture){g.strokeStyle=tone(.35*rel*gloss);g.lineWidth=c*.065;g.beginPath();g.moveTo(-rx*.9,-ry*.76);g.bezierCurveTo(-rx*.78,ry*.04,-rx*.5,ry*.68,0,ry*.66);g.stroke();g.strokeStyle=tone(-.26*rel);g.lineWidth=c*.06;g.beginPath();g.moveTo(rx*.88,-ry*.74);g.bezierCurveTo(rx*.66,ry*.08,rx*.48,ry*.66,0,ry*.69);g.stroke()}
 if(texture&&detail){g.save();g.globalAlpha=detail*(mat==='wool'?.55:.3);g.lineWidth=c*(mat==='silk'?.009:.014);g.strokeStyle=tone(.15*gloss);for(let k=0;k<Math.ceil(detail*6);k++){const x=(k/6-.5)*rx*1.5;g.beginPath();g.moveTo(x,-ry*.6);g.quadraticCurveTo(x+(mat==='linen'?Math.sin(i+j+k)*c*.06:0),0,x*.2,ry*.6);g.stroke()}g.restore()}
 if(seam){g.strokeStyle=tone(-.30);g.lineWidth=c*.08;g.beginPath();g.moveTo(-c*.5,c*.32);g.lineTo(c*.5,c*.32);g.stroke()}
}

(()=>{'use strict';
const families={Blue:['#A9C7DA','#758995','#1600FF','#C1E7FA','#219EFF','#426B86','#0F5481','#92BCD7','#2183BE','#9BF0FF','#AAECFA','#6BCBFC','#C6F2FC','#28C8F5','#50BCF5','#29B1EE','#A3E6FA','#C9F5FB','#5CC3FA','#0BA9FD','#86D7F5','#5DB8E4','#90E9F9','#D5F7FF'],Green:['#8D9B4F','#D0D6B5','#D7FF00','#DDE4AF','#56D83A','#9FD58A','#478838','#AAC497','#8FFC65','#B9EB81','#DFF8BD','#C9FBA5','#DFF66C','#A5E889','#CCF59B','#ECFFBC','#8FE869','#E0F9C9','#BCFFA6','#348C13','#A3F15D','#C7EF9C','#95BA1E','#DEFA7D'],Red:['#681919','#C99394','#FF2750','#7D4644','#530F10','#CD8886','#84372F','#FB716B','#FDC4AF','#9C2B2B','#DF9995','#FF3F64','#AA5552','#801E1D','#470000','#D10000','#FF0000','#8A0000','#BB0808','#510000','#E34540','#FF8B76','#A94B47','#EEC0AF'],Yellow:['#FFF5A0','#FCFBE7','#FFDD00','#EDECD1','#FF9B00','#FFC071','#FFE5C0','#FFDA60','#FFFFB8','#FAF9EA','#FFFA69','#FFF5AA','#FFCF00','#E7E57D','#FFFAAB','#FFA200','#FFB800','#FFF066','#F9E84A','#FFEF00','#FAF1B0','#FFE34B','#FFB64C','#FFFFD1'],'Reference Neutral':['#FAFAF6','#FE6E00','#C8C5FF','#D9D7C7','#161313','#000000']};
families['Brand palette']=families['Reference Neutral'];delete families['Reference Neutral'];delete families.Yellow;
let active='Brand palette', palette=families.Blue.slice(),ctx=document.getElementById('art').getContext('2d');let uploadedImages=[],imagePlacements=[],imageNames=[];let selectedImage=0,renderRevision=0,protectedColours=[];let imageLayers=[];let imageCanvas=document.createElement('canvas');imageCanvas.width=imageCanvas.height=512;let imageContext=imageCanvas.getContext('2d',{willReadFrequently:true});const $=id=>document.getElementById(id);const controls=['count','pattern','density','complexity','scale','distribution','seed','texture'];const clamp=(a,l,h)=>Math.max(l,Math.min(h,a));function rng(s){return()=>{s=(Math.imul(1664525,s)+1013904223)|0;return ((s>>>0)/4294967296)}}function hex(rgb){return /^#[0-9a-f]{6}$/i.test(rgb)}function toRgb(h){if(h.startsWith('rgb'))return (h.match(/[\d.]+/g)||[]).slice(0,3).map(Number);h=h.replace('#','');return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]}function mix(a,b,t){let x=toRgb(a),y=toRgb(b);return 'rgb('+x.map((z,i)=>Math.round(z*(1-t)+y[i]*t)).join(',')+')'}function adjust(h,t){return mix(h,t>0?'#ffffff':'#000000',Math.abs(t))}
function defaultPlacement(index,total=1){return {x:total===1?.5:.27+(index%2)*.44,y:total===1?.5:.25+Math.floor(index/2)*.25,scale:total===1?.75:.65,rotation:total===1?0:[-12,9,-6,16,0][index%5],opacity:1,feather:0,visible:true}}
function cleanPlacement(p,index){const defaults=defaultPlacement(index);const out={};for(const [key,min,max] of [['x',-1,2],['y',-1,2],['scale',.05,3],['rotation',-180,180],['opacity',0,1],['feather',0,.45]])out[key]=Number.isFinite(Number(p?.[key]))?clamp(Number(p[key]),min,max):defaults[key];out.visible=p?.visible!==false;return out}
function updateImageSampling(){imageLayers=[];if(!uploadedImages.length)return;let w=512,h=512;for(const img of uploadedImages){imageContext.clearRect(0,0,w,h);const sc=Math.min(w/img.width,h/img.height);const fitW=img.width*sc,fitH=img.height*sc;imageContext.drawImage(img,(w-fitW)/2,(h-fitH)/2,fitW,fitH);imageLayers.push(imageContext.getImageData(0,0,w,h).data.slice())}}
function renderImagePreviews(){const strip=$('imagePreviewStrip');strip.innerHTML='';uploadedImages.forEach((img,idx)=>{const tile=document.createElement('button');tile.type='button';tile.className='preview-tile'+(idx===selectedImage?' selected':'');tile.setAttribute('aria-pressed',String(idx===selectedImage));tile.setAttribute('aria-label','Select image '+(idx+1));const el=document.createElement('img');el.className='image-preview';el.alt=imageNames[idx]||'Image '+(idx+1);el.src=img.src;const cap=document.createElement('span');cap.textContent=(idx+1)+' / '+(imageNames[idx]||'Image').slice(0,16);tile.append(el,cap);tile.onclick=()=>{selectedImage=idx;renderImagePreviews();document.dispatchEvent(new Event('loomselection'))};strip.append(tile)});document.dispatchEvent(new Event('loomselection'))}
function updateFocusOptions(){const sel=$('imageFocus');if(!sel)return;const prev=sel.value||'0';sel.innerHTML='<option value="0">All images equally</option>';uploadedImages.forEach((img,idx)=>{const opt=document.createElement('option');opt.value=String(idx+1);opt.textContent='Image '+(idx+1);sel.append(opt)});sel.value=[...sel.options].some(o=>o.value===prev)?prev:'0'}
function noise2(i,j,s){const raw=Math.sin((i*12.9898+j*78.233+s*0.137))*43758.5453;return raw-Math.floor(raw)}
function revealMask(i,j,density){const coverage=+$('imageReveal').value/100;if(coverage>=.999)return 1;if(coverage<=0)return 0;const mode=$('revealMode').value;const cx=(i+.5)/density-.5,cy=(j+.5)/density-.5;if(mode==='patches'){const seed=+$('seed').value;const field=(Math.sin(i/density*11+Math.cos(j/density*8+seed*.03)*1.8)+Math.cos(j/density*13+Math.sin(i/density*7+seed*.07)*1.5)+2)/4;return field<=coverage?1:0}if(mode==='center'){const dist=Math.sqrt(cx*cx+cy*cy)/0.7071;return dist<=coverage?1:0}if(mode==='vertical'){const wave=(Math.sin(((i/density)*Math.PI*4)+(+$('seed').value*.03))+1)/2;return wave<=coverage?1:0}if(mode==='horizontal'){const wave=(Math.sin(((j/density)*Math.PI*4)+(+$('seed').value*.03))+1)/2;return wave<=coverage?1:0}return noise2(i,j,+$('seed').value)<=coverage?1:0}
function sampleFromLayer(layer,xx,yy){const sx=Math.min(511,Math.floor(xx*512)),sy=Math.min(511,Math.floor(yy*512)),idx=(sy*512+sx)*4,alpha=layer[idx+3]/255;if(alpha<.03)return null;return {rgb:[layer[idx],layer[idx+1],layer[idx+2]],alpha}}
function mixedImageSample(i,j,density){if(!imageLayers.length)return null;const size=+$('imageScale').value/100;let xx=((i+.5)/density-.5)/size+.5-+$('imageOffsetX').value/200;let yy=((j+.5)/density-.5)/size+.5-+$('imageOffsetY').value/200;const repeat=$('imageRepeat').value;if(repeat!=='single'){const repeats=+$('repeatCount').value;xx*=repeats;yy*=repeats;const wrap=v=>{let unit=((v%1)+1)%1;return repeat==='mirror'&&Math.abs(Math.floor(v)%2)===1?1-unit:unit};xx=Math.min(.999999,wrap(xx));yy=Math.min(.999999,wrap(yy))}const mode=$('imageBlend').value;const sampled=imageLayers.map((layer,index)=>{const p=imagePlacements[index]||defaultPlacement(index);if(!p.visible||p.opacity<=0)return null;const a=-p.rotation*Math.PI/180,dx=xx-p.x,dy=yy-p.y;const lx=(dx*Math.cos(a)-dy*Math.sin(a))/p.scale+.5,ly=(dx*Math.sin(a)+dy*Math.cos(a))/p.scale+.5;if(lx<0||lx>=1||ly<0||ly>=1)return null;const sample=sampleFromLayer(layer,lx,ly);if(!sample)return null;let fade=1;if(p.feather>0){const im=uploadedImages[index],fw=Math.min(1,im.width/im.height),fh=Math.min(1,im.height/im.width),edge=Math.min((lx-(1-fw)/2)/fw,((1+fw)/2-lx)/fw,(ly-(1-fh)/2)/fh,((1+fh)/2-ly)/fh);fade=clamp(edge/p.feather,0,1);fade=fade*fade*(3-2*fade)}sample.alpha*=p.opacity*fade;return sample.alpha>.001?sample:null});const valid=sampled.filter(Boolean);if(!valid.length)return null;if(mode==='layers'){let alpha=0,rgb=[0,0,0];for(const sample of sampled){if(!sample)continue;const next=sample.alpha+alpha*(1-sample.alpha);rgb=rgb.map((v,k)=>(sample.rgb[k]*sample.alpha+v*alpha*(1-sample.alpha))/next);alpha=next}const focused=sampled[+$('imageFocus').value-1];if(focused){const weight=+$('imageFocusStrength').value/100*focused.alpha;rgb=rgb.map((v,k)=>v*(1-weight)+focused.rgb[k]*weight)}return {rgb:rgb.map(Math.round),alpha}}const focus=+$('imageFocus').value;const focusStrength=+$('imageFocusStrength').value/100;const focused=(focus>0&&sampled[focus-1])?sampled[focus-1]:null;const biasHit=focused&&noise2(i+7,j+11,+$('seed').value)<focusStrength*.72;if((mode==='alternate'||mode==='patchwork'||mode==='bands')&&biasHit)return focused;if(mode==='alternate')return valid[(i+j*2)%valid.length];if(mode==='patchwork')return valid[(Math.floor(i/4)+Math.floor(j/4)*2)%valid.length];if(mode==='bands')return valid[Math.min(valid.length-1,Math.floor(xx*valid.length))];let totalAlpha=0,sum=[0,0,0];sampled.forEach((s,idx)=>{if(!s)return;let weight=s.alpha;if(focus>0&&idx===focus-1)weight*=1+focusStrength*4;totalAlpha+=weight;for(let k=0;k<3;k++)sum[k]+=s.rgb[k]*weight});if(totalAlpha<=0)return null;return {rgb:sum.map(v=>Math.round(v/totalAlpha)),alpha:Math.min(1,totalAlpha/Math.max(1,valid.length))}}
function imageSample(i,j,density,cols,base){if($('imageMode').value==='photoMask')return base;const sample=mixedImageSample(i,j,density);const reveal=revealMask(i,j,density);if(!sample||!reveal||+$('imageAmount').value===0)return base;const rgb=sample.rgb,alpha=sample.alpha*reveal;const im='#'+rgb.map(x=>x.toString(16).padStart(2,'0')).join('');const protectedBase=protectedColours.some(index=>cols[index]&&cols[index].toLowerCase()===base.toLowerCase());const amount=+$('imageAmount').value/100*alpha*(protectedBase?1-+$('protectStrength').value/100:1),mode=$('imageMode').value;if(amount<=0)return base;let target=im;if(mode==='palette'){let best=Infinity;for(const colour of cols){const c=toRgb(colour);let distance=rgb.reduce((acc,v,k)=>acc+(v-c[k])**2,0);if(distance<best){best=distance;target=colour}}}if(mode==='wovenOriginal'){const threadMask=((i*3+j*5+Math.floor(i/2))%10)/10;return threadMask<amount?target:base}if(mode==='interlace'){let strand=((i+2*j+Math.floor(i/3))%4)/4;return strand<amount?mix(base,target,.85):base}if(mode==='original'){const threadMask=((i+j*2)%6)/6;return threadMask<amount?target:mix(base,target,Math.min(.35,amount*.35))}return mix(base,target,amount)}
// Original-resolution image layers are prepared once per placement change, not per thread.
// Extend edge pixels underneath complete stitches so the source rectangle never cuts a loop.
function extendPhotoEdges(source,pad){
 const out=document.createElement('canvas');out.width=out.height=source.width+pad*2;
 const g=out.getContext('2d',{willReadFrequently:true});g.drawImage(source,pad,pad);
 const image=g.getImageData(0,0,out.width,out.height),pixels=image.data,w=out.width,n=w*w;
 const distance=new Uint16Array(n);distance.fill(65535);const queue=new Int32Array(n);let head=0,tail=0;
 for(let k=0;k<n;k++)if(pixels[k*4+3]>16){distance[k]=0;queue[tail++]=k}
 while(head<tail){const k=queue[head++],d=distance[k]+1;if(d>pad)continue;const x=k%w;
  for(const next of [x?k-1:-1,x<w-1?k+1:-1,k>=w?k-w:-1,k<n-w?k+w:-1]){
   if(next<0||distance[next]!==65535)continue;distance[next]=d;queue[tail++]=next;
   if(pixels[next*4+3]<=16)for(let c=0;c<4;c++)pixels[next*4+c]=pixels[k*4+c];
  }
 }
 g.putImageData(image,0,0);return out;
}
let photoCacheKey='',photoSources=[];
function preparePhotoMask(W,density,cell,inset,indexes,cols,pattern){
 window.loomPhoto=null;
 if($('imageMode').value!=='photoMask'||!uploadedImages.length)return;
 const ids=['imageRepeat','repeatCount','imageScale','imageOffsetX','imageOffsetY'];
 const pad=Math.ceil(W/density*1.8);
 const key=JSON.stringify([W,density,imagePlacements,ids.map(id=>$(id).value),uploadedImages.map(im=>im.src)]);
 if(key!==photoCacheKey){
  photoCacheKey=key;photoSources=uploadedImages.map((im,k)=>{
   const out=document.createElement('canvas');out.width=out.height=W;const g=out.getContext('2d'),p=imagePlacements[k];if(!p.visible)return out;
   const tile=document.createElement('canvas');tile.width=tile.height=W;const t=tile.getContext('2d');
   t.translate(p.x*W,p.y*W);t.rotate(p.rotation*Math.PI/180);t.scale(p.scale,p.scale);
   const fit=Math.min(W/im.width,W/im.height),w=im.width*fit,h=im.height*fit;
   t.drawImage(im,-w/2,-h/2,w,h);
   if(p.feather){t.globalCompositeOperation='destination-in';const f=Math.min(w,h)*p.feather;for(const [x0,y0,x1,y1] of [[-w/2,0,-w/2+f,0],[w/2,0,w/2-f,0],[0,-h/2,0,-h/2+f],[0,h/2,0,h/2-f]]){const gr=t.createLinearGradient(x0,y0,x1,y1);gr.addColorStop(0,'transparent');gr.addColorStop(1,'white');t.fillStyle=gr;t.fillRect(-w/2,-h/2,w,h)}}
   const scale=+$('imageScale').value/100,repeat=$('imageRepeat').value,n=repeat==='single'?1:+$('repeatCount').value;
   g.translate(W*.5,W*.5);g.scale(scale,scale);g.translate(W*(-.5+ +$('imageOffsetX').value/200),W*(-.5+ +$('imageOffsetY').value/200));
   for(let y=0;y<n;y++)for(let x=0;x<n;x++){g.save();g.translate(x*W/n,y*W/n);g.scale(1/n,1/n);if(repeat==='mirror'){g.translate(x%2?W:0,y%2?W:0);g.scale(x%2?-1:1,y%2?-1:1)}g.drawImage(tile,0,0);g.restore()}return extendPhotoEdges(out,pad);
  });
 }
 const combined=document.createElement('canvas');combined.width=combined.height=W+pad*2;const cg=combined.getContext('2d');
 const average=$('imageBlend').value==='average';photoSources.forEach((src,k)=>{cg.globalAlpha=imagePlacements[k].opacity/(average?photoSources.length:1);cg.globalCompositeOperation=average?'lighter':'source-over';cg.drawImage(src,0,0)});cg.globalCompositeOperation='source-over';
 const focus=+$('imageFocus').value-1;if(photoSources[focus]){cg.globalAlpha=+$('imageFocusStrength').value/100*imagePlacements[focus].opacity;cg.drawImage(photoSources[focus],0,0)}
 const patterns=new WeakMap();
 window.loomPhoto={paint(g,i,j,knit,origin){
  const ci=knit?i:Math.floor(i/2),cj=knit?j:Math.floor(j/2),base=cols[indexes[cj]?.[ci]];
  const protectedBase=protectedColours.some(k=>cols[k]===base);
  const amount=+$('imageAmount').value/100*revealMask(ci,cj,density)*(protectedBase?1-+$('protectStrength').value/100:1);
  if(!amount||!mixedImageSample(ci,cj,density))return null;
  let entries=patterns.get(g);if(!entries){entries=new Map();patterns.set(g,entries)}
  const mode=$('imageBlend').value;let source=-1;
  if(['alternate','patchwork','bands'].includes(mode)){source=mode==='alternate'?(ci+cj*2)%photoSources.length:mode==='patchwork'?(Math.floor(ci/4)+Math.floor(cj/4)*2)%photoSources.length:Math.min(photoSources.length-1,Math.floor(ci/density*photoSources.length));}
  let paint=entries.get(source);if(!paint){paint=g.createPattern(source<0?combined:photoSources[source],'no-repeat');entries.set(source,paint)}
  const x=origin?origin.x:knit?inset+(i+.5+(j%2)*.5)*cell:0,y=origin?origin.y:knit?inset+(j+.48)*cell:0;
  paint.setTransform(new DOMMatrix().translate(inset-x-pad*cell*density/W,inset-y-pad*cell*density/W).scale(cell*density/W));
  return {pattern:paint,amount:amount*(source<0?1:imagePlacements[source].opacity)};
 }};
}
function paletteForCount(){return palette.slice(0,+$('count').value)}function rebuildPalette(){const n=+$('count').value;const box=$('palette');box.innerHTML='';for(let i=0;i<n;i++){let item=document.createElement('div');item.className='swatch';let picker=document.createElement('input');picker.type='color';picker.value=palette[i];picker.title='Colour '+(i+1);let txt=document.createElement('input');txt.type='text';txt.value=palette[i].toUpperCase();txt.maxLength=7;txt.setAttribute('aria-label','Hex colour '+(i+1));picker.addEventListener('input',()=>{palette[i]=picker.value;txt.value=palette[i].toUpperCase();render()});txt.addEventListener('change',()=>{let v=txt.value.trim();if(!v.startsWith('#'))v='#'+v;if(hex(v)){palette[i]=v;picker.value=v;render()}txt.value=palette[i].toUpperCase()});item.append(picker,txt);box.append(item)}}
function selectFamily(name){active=name;palette=Array.from({length:24},(_,i)=>families[name][i%families[name].length]);document.querySelectorAll('.family').forEach(e=>e.classList.toggle('active',e.dataset.family===name));rebuildPalette();render()}
for(let name of ['Brand palette','Green','Blue','Red']){let b=document.createElement('button');b.className='family';b.dataset.family=name;b.title=name;b.innerHTML='<span class="palette-dots">'+(name==='Brand palette'?[families[name][1],families[name][2],families[name][3],families[name][4]]:families[name].slice(0,4)).map(c=>'<i style="background:'+c+'"></i>').join('')+'</span><em>'+name+'</em>';if(name==='Brand palette')b.classList.add('brand-family');b.onclick=()=>selectFamily(name);$('families').append(b)}
function blendChannel(b,t,mode){if(mode==='multiply')return b*t/255;if(mode==='screen')return 255-(255-b)*(255-t)/255;if(mode==='overlay')return b<128?(2*b*t/255):(255-2*(255-b)*(255-t)/255);if(mode==='softlight'){b/=255;t/=255;return 255*((1-2*t)*b*b+2*t*b)}return t}function blendColour(base,target,opacity,mode){const b=toRgb(base),t=toRgb(target);return 'rgb('+b.map((bv,i)=>Math.round(bv*(1-opacity)+blendChannel(bv,t[i],mode)*opacity)).join(',')+')'}let wovenFontFace=null;let textPixels=null;let stripPixels=null;const textCanvas=document.createElement('canvas');textCanvas.width=textCanvas.height=1024;const textCtx=textCanvas.getContext('2d',{willReadFrequently:true});
function textLineWidth(line,size,tracking){textCtx.font='400 '+size+'px "'+(wovenFontFace?'WovenCustom':'Haffer')+'", Arial, sans-serif';let w=0;for(const c of line)w+=textCtx.measureText(c).width+tracking;return Math.max(0,w-tracking)}
function drawTrackedLine(line,x,y,size,tracking){const w=textLineWidth(line,size,tracking);let at=x-w/2;for(const c of line){textCtx.fillText(c,at,y);at+=textCtx.measureText(c).width+tracking}}
function updateTextSampling(){
 textPixels=null;stripPixels=null;
 if(!$('textEnabled').checked||!$('wovenText').value.trim())return;
 const W=1024,H=1024,stripMode=$('textStyle').value==='strips';
 textCtx.clearRect(0,0,W,H);
 const size=+$('textSize').value,tracking=+$('textSpacing').value;
 const font='400 '+size+'px "'+(wovenFontFace?'WovenCustom':'Haffer')+'", Arial, sans-serif';
 textCtx.font=font;textCtx.textBaseline='middle';
 if(stripMode){
   const lines=$('wovenText').value.split(/\n/).map(v=>v.trim()).filter(Boolean);
   if(!lines.length)return;
   const count=+$('stripCount').value,span=+$('stripWidth').value/100*W;
   const gap=+$('stripGap').value/100,bandH=Math.min(210,Math.max(52,Math.round(size*.58+34)));
   const step=bandH*(1+gap*2.1);
   const total=bandH+(count-1)*step,top=H*+$('textY').value/100-total/2;
   const x=W*+$('textX').value/100-span/2;
   const mask=document.createElement('canvas');mask.width=W;mask.height=H;
   const maskCtx=mask.getContext('2d',{willReadFrequently:true});
   for(let n=0;n<count;n++){
     const y=top+n*step;
     maskCtx.fillStyle='#ffffff';maskCtx.fillRect(x,y,span,bandH);
     let content=lines[n%lines.length];
     if(!/[“”"']/u.test(content))content='“'+content+'”';
     const needed=Math.max(1,textLineWidth(content,size,tracking));
     const fit=Math.min(1,(span-32)/needed,(bandH*.71)/size);
     textCtx.save();textCtx.beginPath();textCtx.rect(x,y,span,bandH);textCtx.clip();
     textCtx.translate(x+span/2,y+bandH/2);textCtx.scale(fit,fit);
     textCtx.font=font;textCtx.fillStyle='#ffffff';
     drawTrackedLine(content,0,0,size,tracking);
     textCtx.restore();
   }
   stripPixels=maskCtx.getImageData(0,0,W,H).data;
 }else{
  textCtx.save();textCtx.translate(W*+$('textX').value/100,H*+$('textY').value/100);
  textCtx.rotate(+$('textRotation').value*Math.PI/180);
  const lines=$('wovenText').value.split(/\n/).slice(0,5);
  const maxWidth=Math.max(...lines.map(l=>textLineWidth(l,size,tracking)),1);
  const fit=Math.min(1,960/maxWidth,930/(lines.length*size*1.12));
  textCtx.scale(fit,fit);textCtx.font=font;textCtx.fillStyle='#ffffff';
  const lineHeight=size*1.12;
  for(let i=0;i<lines.length;i++)drawTrackedLine(lines[i],0,(i-(lines.length-1)/2)*lineHeight,size,tracking);
  textCtx.restore();
 }
 textPixels=textCtx.getImageData(0,0,W,H).data;
}
function textSample(i,j,density,base,photo){
 if(!textPixels)return base;
 const xx=Math.min(1023,Math.max(0,Math.floor((i+.5)/density*1024)));
 const yy=Math.min(1023,Math.max(0,Math.floor((j+.5)/density*1024)));
 const idx=(yy*1024+xx)*4;
 const alpha=textPixels[idx+3]/255,style=$('textStyle').value;
 const amount=alpha*(+$('textStrength').value/100),strand=((i*3+j*2+Math.floor(j/3))%11)/11,c=$('textColor').value;
 if(style==='strips'){
  if(!stripPixels||stripPixels[idx+3]<20)return base;
  const band=blendColour(base,$('stripFill').value,+$('stripOpacity').value/100,'normal');
  return strand<amount?blendColour(band,c,Math.min(1,amount*.93),'normal'):band;
 }
 if(alpha<.04)return base;
 if(style==='photo')return photo?(strand<amount?photo:base):base;
 if(style==='cutout')return strand<amount?adjust(base,-.72):base;
 if(style==='blend')return blendColour(base,c,amount*.72,'softlight');
 return strand<amount?c:base;
}
$('textFontUpload').addEventListener('change',async e=>{const f=e.target.files&&e.target.files[0];if(!f)return;try{const face=new FontFace('WovenCustom',await f.arrayBuffer(),{style:'normal',weight:'400'});await face.load();if(wovenFontFace)document.fonts.delete(wovenFontFace);document.fonts.add(face);wovenFontFace=face;$('textFontStatus').textContent='Loaded '+f.name+' — custom font active';render()}catch(err){$('textFontStatus').textContent='Could not load font. Try an OTF, TTF or WOFF file.'}});
['textEnabled','wovenText','textStyle','textSize','textSpacing','textRotation','textX','textY','textStrength','textColor','stripCount','stripWidth','stripGap','stripOpacity','stripFill'].forEach(id=>$(id).addEventListener('input',render));
function updateRenderLabels(W,H,n,density,complex,scale,seed){$('threadShadowVal').textContent=$('threadShadow').value+'%';$('yarnWidthVal').textContent=$('yarnWidth').value+'%';$('reliefVal').textContent=$('relief').value+'%';$('repeatCountVal').textContent=$('repeatCount').value+' × '+$('repeatCount').value; $('countVal').textContent=n;$('densityVal').textContent=density;$('complexityVal').textContent=Math.round(complex*100)+'%';$('scaleVal').textContent=scale;$('seedVal').textContent=seed;$('previewName').textContent=($('studyName').value.trim()||active)+' / '+$('pattern').selectedOptions[0].text;$('meta').textContent=W+' × '+H+' px · '+n+' colours'+(uploadedImages.length?' · '+uploadedImages.length+' image'+(uploadedImages.length>1?'s':'')+' woven in':'');$('imageRevealVal').textContent=$('imageReveal').value+'%';$('imageFocusStrengthVal').textContent=$('imageFocusStrength').value+'%';$('imageAmountVal').textContent=$('imageAmount').value+'%';$('imageScaleVal').textContent=$('imageScale').value+'%';$('imageOffsetXVal').textContent=$('imageOffsetX').value+'%';$('imageOffsetYVal').textContent=$('imageOffsetY').value+'%';}
let pendingRender=0;function render(event){if(event instanceof Event){if(!pendingRender)pendingRender=requestAnimationFrame(()=>{pendingRender=0;render()});return}if(pendingRender){cancelAnimationFrame(pendingRender);pendingRender=0}window.clientLock?.();if(!['knit','twill','panelrib'].includes($('pattern').value))$('pattern').value='knit';const c=$('art'),W=c.width,H=c.height;let cols=paletteForCount(),n=cols.length,p=$('pattern').value,dist=$('distribution').value,density=+$('density').value,complex=+$('complexity').value/100,scale=+$('scale').value,seed=+$('seed').value,texture=$('texture').checked,rd=rng(seed);if(window.loomLive?.active&&!window.loomVectorExport&&event!==true){updateRenderLabels(W,H,n,density,complex,scale,seed);document.dispatchEvent(new Event('loomsettings'));return}updateTextSampling();ctx.clearRect(0,0,W,H);let cell=W/(density+3),edgeInset=cell*1.25;window.loomFrame={revision:++renderRevision,width:W,density,seed,pattern:p,texture,cells:[]};let indexes=Array.from({length:density},()=>Array(density).fill(0));let offset=Math.max(1,Math.round(scale/3));const randomGrid=Array.from({length:density},()=>Array.from({length:density},()=>Math.floor(rd()*n)));// Each arrangement has its own geometry; complexity changes its character, not its direction.
const islandCount=Math.max(4,Math.min(36,Math.round(density/scale*2))),islandRandom=rng(seed+819);
const islands=Array.from({length:islandCount},(_,k)=>({x:islandRandom()*density,y:islandRandom()*density,colour:k%n}));
function colourAt(i,j){
 if(dist.startsWith('legacy_')){
  let v;switch(dist.slice(7)){
   case 'horizontal':v=Math.floor(j/scale);break;
   case 'plaid':v=Math.floor(i/scale)+Math.floor(j/scale)*2;break;
   case 'patchwork':v=Math.floor(i/(scale*1.6))+Math.floor(j/(scale*1.6))*3;break;
   case 'random':v=randomGrid[j][i];break;
   case 'gradient':v=Math.floor((i+j)/(2*density)*n*2);break;
   default:v=Math.floor(i/scale);
  }
  const wobble=Math.sin((i+j*.32)*.37+seed)*complex*1.7;
  if(rd()<complex*.065)v+=Math.floor(rd()*n);
  return ((Math.floor(v+wobble)+n*1000)%n);
 }
 const x=i+.5-density/2,y=j+.5-density/2;
 const ripple=Math.sin(j/density*Math.PI*4+seed*.03)*complex*.6;
 let v=0;
 switch(dist){
 case 'horizontal':v=Math.floor(j/scale+Math.sin(i/density*Math.PI*4+seed*.03)*complex*.6);break;
 case 'plaid':v=Math.floor(i/scale)+Math.floor(j/scale)*2;break;
 case 'patchwork':v=Math.floor(i/(scale*1.6))+Math.floor(j/(scale*1.6))*3;break;
 case 'random':v=randomGrid[j][i];break;
 case 'gradient':v=Math.floor((i+j)/scale);break;
 case 'waves':v=Math.floor((j+Math.sin(i/density*Math.PI*2*(1+complex*2)+seed*.03)*scale*(1+complex*2))/scale);break;
 case 'rings':v=Math.floor((Math.hypot(x,y)+Math.sin(Math.atan2(y,x)*5+seed*.03)*complex*scale*.7)/scale);break;
 case 'checker':v=(Math.floor(i/scale)+Math.floor(j/scale))%2;break;
 case 'islands':{let closest=Infinity;const wx=i+Math.sin(j/density*12+seed*.03)*scale*complex,wy=j+Math.cos(i/density*12+seed*.02)*scale*complex;for(const island of islands){const d=(wx-island.x)**2+(wy-island.y)**2;if(d<closest){closest=d;v=island.colour}}break;}
 case 'radial':v=Math.floor((Math.atan2(y,x)+Math.PI)/(Math.PI*2)*Math.max(4,Math.round(density/scale))+Math.sin(Math.hypot(x,y)/density*8)*complex);break;
 default:v=Math.floor(i/scale+ripple);
 }
 if(dist!=='random'&&rd()<complex*.035)v+=Math.floor(rd()*n);
 return ((v%n)+n)%n;
}

for(let j=0;j<density;j++)for(let i=0;i<density;i++)indexes[j][i]=colourAt(i,j);
preparePhotoMask(W,density,cell,edgeInset,indexes,cols,p);const knit=['knit','panelrib'].includes(p);if(knit){ctx.fillStyle=cols[0];ctx.fillRect(edgeInset+cell*.6,edgeInset+cell*.4,cell*(density-1),cell*(density-1));if(p==='panelrib'){for(let j=0;j<density;j++)for(let i=0;i<density;i++){const original=cols[indexes[j][i]],photo=imageSample(i,j,density,cols,original),base=textSample(i,j,density,photo,photo!==original?photo:null);ctx.fillStyle=adjust(base,-.16-.30*(+$('threadShadow').value/100));ctx.beginPath();ctx.ellipse(edgeInset+(i+.5+(j%2)*.5)*cell,edgeInset+(j+.48)*cell,cell*.68,cell*.65,0,0,Math.PI*2);ctx.fill()}}for(let j=0;j<density;j++)for(let i=0;i<density;i++){const ci=(i+density)%density,cj=(j+density)%density,k=indexes[cj][ci];let base=cols[k];if(p==='fairisle'&&(((Math.floor(i/2)+Math.floor(j/2))%5===0)||((i+j+seed)%11===0)))base=cols[(k+offset)%n];const photoBase=imageSample(ci,cj,density,cols,base);base=textSample(ci,cj,density,photoBase,photoBase!==base?photoBase:null);ctx.save();ctx.translate(edgeInset+(i+.5+(j%2)*.5)*cell,edgeInset+(j+.48)*cell);if(i>=0&&j>=0&&i<density&&j<density)window.loomFrame.cells.push({type:'knit',x:edgeInset+(i+.5+(j%2)*.5)*cell,y:edgeInset+(j+.48)*cell,size:cell,base,rib:p==='panelrib',i,j});drawKnitStitch(ctx,base,cell,p==='panelrib',i,j,seed,texture);ctx.restore()}}

else{function isOver(i,j){switch(p){case 'twill':return ((i-j+density*8)%6)<3;case 'basket':return (Math.floor(i/3)+Math.floor(j/3))%2===0;case 'satin':return ((i*2+j*3+density*14)%7)===0;default:return (i+j)%2===0}}let threads= density*2;let thread=(W-2*edgeInset)/threads;let warped=[];let wefted=[];for(let z=0;z<threads;z++){warped.push(indexes[0][Math.floor(z/2)%density]);wefted.push(indexes[Math.floor(z/2)%density][0])}for(let j=0;j<threads;j++)for(let i=0;i<threads;i++){let wi=Math.floor(i/2)%density,wj=Math.floor(j/2)%density;let a=indexes[wj][wi],b=dist==='vertical'?((a+offset)%n):dist==='horizontal'?a:((a+Math.floor(j/(scale*2))+offset)%n);let over=isOver(i,j);let c1=over?cols[a]:cols[b],x=edgeInset+i*thread,y=edgeInset+j*thread;const photoBase=imageSample(wi,wj,density,cols,c1);c1=textSample(i,j,threads,photoBase,photoBase!==c1?photoBase:null);window.loomFrame.cells.push({type:'weave',x,y,size:thread,base:c1,over,i,j,leading:isOver(i-(over?0:1),j-(over?1:0))!==over,trailing:isOver(i+(over?0:1),j+(over?1:0))!==over});if(!texture&&!window.loomPhoto){ctx.fillStyle=c1;ctx.fillRect(x,y,thread+.4,thread+.4)}else{drawCrossing(ctx,c1,x,y,thread,over,i,j,seed,isOver(i-(over?0:1),j-(over?1:0))!==over,isOver(i+(over?0:1),j+(over?1:0))!==over)}}}

updateRenderLabels(W,H,n,density,complex,scale,seed);document.dispatchEvent(new Event('loomrender'))}
['protectStrength','imageRepeat','repeatCount','threadShadow','material','yarnWidth','relief','fibre','studyName','imageMode','imageBlend','imageFocus','imageFocusStrength','revealMode','imageReveal','imageAmount','imageScale','imageOffsetX','imageOffsetY'].forEach(id=>$(id).addEventListener('input',render));$('imageUpload').addEventListener('change',e=>{const files=Array.from(e.target.files||[]).slice(0,5-uploadedImages.length);if(!files.length&&uploadedImages.length>=5){$('status').textContent='Five images are already placed. Remove one to add another.';return}if(!files.length)return;if(files.some(file=>!file.type.startsWith('image/'))){$('status').textContent='Please select image files only.';return}Promise.all(files.map(file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('decode'));im.src=reader.result};reader.onerror=()=>reject(new Error('read'));reader.readAsDataURL(file)}))).then(images=>{const offset=uploadedImages.length;uploadedImages.push(...images);imageNames.push(...files.map(f=>f.name));imagePlacements.push(...images.map((im,k)=>defaultPlacement(offset+k,uploadedImages.length)));selectedImage=offset;$('imageUpload').value='';updateImageSampling();renderImagePreviews();updateFocusOptions();$('status').textContent=images.length+' image'+(images.length>1?'s':'')+' loaded. Use “Keep original image colours (woven in)” to preserve them while weaving them through the palette.';render()}).catch(()=>{$('status').textContent='One or more images could not be loaded.'})});$('removeImage').onclick=()=>{uploadedImages=[];imagePlacements=[];imageNames=[];selectedImage=0;imageLayers=[];$('imageUpload').value='';$('imagePreviewStrip').innerHTML='';updateFocusOptions();renderImagePreviews();$('status').textContent='Images removed.';render()};
$('count').addEventListener('input',()=>{rebuildPalette();render()});controls.filter(x=>x!=='count').forEach(id=>$(id).addEventListener('input',render));$('randomize').onclick=()=>{$('seed').value=1+Math.floor(Math.random()*9999);render()};$('shuffle').onclick=()=>{for(let i=palette.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[palette[i],palette[j]]=[palette[j],palette[i]]}rebuildPalette();render()};$('reset').onclick=()=>selectFamily(active);function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500)}function renderExport(){const c=$('art'),size=+$('exportSize').value;c.width=c.height=size;render(true);return c}function restorePreview(){const c=$('art');c.width=c.height=1024;render()}
$('exportPng').onclick=()=>{const c=renderExport();c.toBlob(b=>{if(b)download(b,'chromatic-loom-'+$('pattern').value+'-'+$('seed').value+'.png');restorePreview()})};$('exportSvg').onclick=()=>{const original=ctx;window.loomVectorExport=true;try{const recording=recordVectorContext(original);ctx=recording.context;render();download(new Blob([recording.svg($('art').width)],{type:'image/svg+xml'}),'chromatic-loom.svg');$('status').textContent=window.loomPhoto?'SVG exported with editable thread shapes and embedded photograph.':'Editable vector SVG exported.'}finally{window.loomVectorExport=false;ctx=original;restorePreview()}};$('copy').onclick=async()=>{let txt=paletteForCount().map(s=>s.toUpperCase()).join(', ');try{await navigator.clipboard.writeText(txt);$('status').textContent='Hex codes copied.'}catch(e){window.prompt('Copy hex codes',txt)}};
window.loom={sampleSource:(x,y)=>mixedImageSample(x*1024-.5,y*1024-.5,1024),render,getProtectedColours:()=>protectedColours.slice(),setProtectedColours(indices){protectedColours=[...new Set(indices.filter(i=>Number.isInteger(i)&&i>=0&&i<24))];render()},getImages:()=>uploadedImages.map((image,i)=>({image,placement:{...imagePlacements[i]},name:imageNames[i],index:i})),getSelected:()=>selectedImage,selectImage(index){selectedImage=clamp(index,0,Math.max(0,uploadedImages.length-1));renderImagePreviews()},setPlacement(index,patch){if(!uploadedImages[index])return;imagePlacements[index]=cleanPlacement({...imagePlacements[index],...patch},index);render();document.dispatchEvent(new Event('loomplacement'))},removeImage(index){uploadedImages.splice(index,1);imagePlacements.splice(index,1);imageNames.splice(index,1);selectedImage=Math.max(0,Math.min(selectedImage,uploadedImages.length-1));updateImageSampling();updateFocusOptions();renderImagePreviews();render()},moveImage(index,delta){const next=clamp(index+delta,0,uploadedImages.length-1);for(const arr of [uploadedImages,imagePlacements,imageNames]){const item=arr.splice(index,1)[0];arr.splice(next,0,item)}selectedImage=next;updateImageSampling();renderImagePreviews();updateFocusOptions();render()},getState:()=>({version:3,protectedColours:protectedColours.slice(),placements:imagePlacements.map(p=>({...p})),imageNames:imageNames.slice(),name:$('studyName').value,palette:palette.slice(),family:active,controls:Object.fromEntries([...document.querySelectorAll('aside input[id]:not([type=file]):not([type=color]):not([type=text]),aside select[id]')].filter(el=>el.id!=='studyPreset'&&el.type!=='password').map(el=>[el.id,el.type==='checkbox'?el.checked:el.value])),images:uploadedImages.map(im=>im.src)}),async setState(state){if(!state||!Array.isArray(state.palette)||state.palette.length<2||state.palette.length>24||!state.palette.every(hex))throw Error('Invalid study palette');const images=state.images||[];if(!Array.isArray(images)||images.length>5||images.some(src=>typeof src!=='string'||!/^data:image\/(png|jpe?g|webp|gif|avif|svg\+xml);/i.test(src)))throw Error('Invalid project images');const decoded=await Promise.all(images.map(src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('An image could not be decoded'));im.src=src})));protectedColours=Array.isArray(state.protectedColours)?state.protectedColours.filter(i=>Number.isInteger(i)&&i>=0&&i<24):[];palette=state.palette.slice();while(palette.length<24)palette.push(palette[palette.length%state.palette.length]);active=Object.hasOwn(families,state.family)?state.family:'Custom';for(const [id,value] of Object.entries(state.controls||{})){const el=$(id);if(!el||(!el.closest('aside')&&id!=='texture')||(el.type==='file'||el.type==='password')||!['INPUT','SELECT'].includes(el.tagName)||id==='studyName')continue;if(el.type==='checkbox')el.checked=!!value;else if(el.tagName==='SELECT'){if([...el.options].some(o=>o.value===String(value)))el.value=String(value)}else if(el.type==='range'){if(Number.isFinite(Number(value)))el.value=clamp(Number(value),Number(el.min),Number(el.max))}}$('studyName').value=String(state.name||'Untitled study').slice(0,80);uploadedImages=decoded;imagePlacements=decoded.map((im,i)=>cleanPlacement(state.placements?.[i],i));imageNames=decoded.map((im,i)=>String(state.imageNames?.[i]||'Image '+(i+1)).slice(0,120));selectedImage=0;updateImageSampling();renderImagePreviews();updateFocusOptions();if(state.controls&&state.controls.imageFocus)$('imageFocus').value=state.controls.imageFocus;document.querySelectorAll('.family').forEach(el=>el.classList.toggle('active',el.dataset.family===active));rebuildPalette();render()}};
window.loom.addImageSource=async(src,name='Camera capture')=>{if(uploadedImages.length>=5)throw Error('Five images are already placed. Remove one first.');const image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('The captured image could not be decoded'));im.src=src});uploadedImages.push(image);imageNames.push(name);imagePlacements.push(defaultPlacement(uploadedImages.length-1,uploadedImages.length));selectedImage=uploadedImages.length-1;updateImageSampling();renderImagePreviews();updateFocusOptions();render();$('status').textContent='Camera image added as a woven layer.';return image};window.loom.updateImageSource=async(index,src)=>{if(!uploadedImages[index])return;const image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('The live camera frame could not be decoded'));im.src=src});uploadedImages[index]=image;updateImageSampling();render()};
selectFamily('Brand palette')})();
