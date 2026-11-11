(() => {
  const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
  ctx.imageSmoothingEnabled=false;
  const ui={money:document.getElementById('money'),rep:document.getElementById('rep'),objective:document.getElementById('objective'),progress:document.getElementById('progressFill'),district:document.getElementById('districtLabel'),questShort:document.getElementById('questShort'),dialogue:document.getElementById('dialogue'),speaker:document.getElementById('speaker'),role:document.getElementById('speakerRole'),text:document.getElementById('dialogueText'),portrait:document.getElementById('portrait'),choices:document.getElementById('dialogueChoices'),toast:document.getElementById('toast')};
  const W=960,H=640,T=32;
  const defaults={x:240,y:178,money:35,rep:0,stage:0,medicine:false,poster:false,carisma:0,outfit:false,won:false,gigCount:0};
  let save={...defaults,...JSON.parse(localStorage.getItem('tonohouse-save')||'{}')};
  const player={x:save.x,y:save.y,face:'down',walk:0};
  const keys=new Set(), held=new Set();let dialogueTarget=null,lastEvent=performance.now(),toastTimer=0;
  const zones=[
    {name:'PLAZA DEL RELOJ',x:0,y:0,w:480,h:320}, {name:'UNIVERSIDAD VALLES',x:480,y:0,w:480,h:320},
    {name:'MERCADO DE LOS MILAGROS',x:0,y:320,w:480,h:320}, {name:'PARQUE LAS JACARANDAS',x:480,y:320,w:480,h:320}
  ];
  const npcs=[
    {id:'diego',name:'DIEGO ANDRE',role:'Amigo · cazatalentos',initial:'DA',x:270,y:170,color:'#4b91a1'},
    {id:'juan',name:'JUAN ANTONIO',role:'Amigo · boticario amateur',initial:'JA',x:700,y:500,color:'#8b77b0'},
    {id:'carlos',name:'JUAN CARLOS',role:'Marketing · gurú del volante',initial:'JC',x:180,y:470,color:'#e08c54'},
    {id:'prof',name:'PROF. MORA',role:'Docente · 42 años · fan de los concursos',initial:'PM',x:680,y:190,color:'#5477aa'},
    {id:'lola',name:'LOLA',role:'Dueña del kiosco · 31 años',initial:'LO',x:332,y:460,color:'#db7184'},
    {id:'tito',name:'TITO',role:'Vecino · 56 años · poeta de semáforo',initial:'TI',x:815,y:405,color:'#d19b46'}
  ];
  const landmarks=[
    {name:'CAFÉ LA PAUSA',x:70,y:50,w:108,h:65,color:'#d78961',sign:'CAFÉ'},
    {name:'AYUNTAMIENTO',x:300,y:45,w:120,h:72,color:'#dfb66f',sign:'MUNICIPIO'},
    {name:'BIBLIOTECA',x:560,y:45,w:112,h:66,color:'#b36a64',sign:'BIBLIOTECA'},
    {name:'UNIVERSIDAD',x:735,y:35,w:160,h:90,color:'#718fa5',sign:'CAMPUS'},
    {name:'PAPELERÍA',x:75,y:390,w:104,h:64,color:'#d99052',sign:'PAPELERÍA'},
    {name:'FARMACIA',x:280,y:390,w:115,h:64,color:'#83aa8a',sign:'BOTICA'},
    {name:'KIOSCO LOLA',x:45,y:535,w:98,h:54,color:'#c5707a',sign:'KIOSCO'},
    {name:'CASA CLUB',x:560,y:382,w:112,h:64,color:'#bc8965',sign:'CLUB VECINAL'},
    {name:'VIVERO',x:760,y:510,w:128,h:68,color:'#82a879',sign:'VIVERO'}
  ];
  const lot={x:400,y:205}; // solar libre en la plaza del reloj
  function persist(){save.x=player.x;save.y=player.y;localStorage.setItem('tonohouse-save',JSON.stringify(save));}
  function updateUI(){ui.money.textContent=save.money;ui.rep.textContent=save.rep;let goal,short,amount;
    if(save.stage===0){goal='Encuentra a Diego Andre en la plaza';short='Una idea brillante';amount=0}
    else if(save.stage===1){goal='Ve a la universidad y habla con la profe Mora';short='El primer gran evento';amount=18}
    else if(save.stage===2){goal='Busca a Juan Antonio en el parque';short='Un remedio peculiar';amount=38}
    else if(save.stage===3){goal='Encuentra a Juan Carlos en el mercado';short='La ciudad se entera';amount=58}
    else if(save.stage===4){goal=`Reúne ¢350 y visita el solar de la plaza (tienes ¢${save.money})`;short='Un lugar propio';amount=Math.min(96,60+Math.floor(save.money/350*36))}
    else {goal='La Toño House está abierta: ¡haz de anfitrión!';short='¡Gran inauguración!';amount=100}
    ui.objective.textContent=goal;ui.questShort.textContent=short;ui.progress.style.width=amount+'%';
    ui.district.textContent=(zones.find(z=>player.x>=z.x&&player.x<z.x+z.w&&player.y>=z.y&&player.y<z.y+z.h)||zones[0]).name;
    document.getElementById('inventory').innerHTML=`<div class="inventory-row"><span>🧪 Tónico anti-dramático</span><span>${save.medicine?'1 frasco':'—'}</span></div><div class="inventory-row"><span>📣 Carteles de Juan Carlos</span><span>${save.poster?'Campaña activa':'—'}</span></div><div class="inventory-row"><span>👔 Look de anfitrión</span><span>${save.outfit?'Equipado':'En tienda · ¢50'}</span></div><div class="inventory-row"><span>✦ Reputación local</span><span>${save.rep} puntos</span></div>`;
    document.getElementById('upgradeBtn').textContent=save.carisma?'COMPRADO ✓':'¢ 80';document.getElementById('outfitBtn').textContent=save.outfit?'EQUIPADO ✓':'¢ 50';
  }
  function toast(msg){ui.toast.textContent=msg;ui.toast.classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>ui.toast.classList.add('hidden'),2100)}
  function addReward(money,rep=0,msg=''){save.money+=money;save.rep+=rep;if(msg)toast(msg);persist();updateUI()}
  const pixel=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h)};
  function drawBuilding(b){pixel(b.x+3,b.y+5,b.w,b.h,'#627263');pixel(b.x,b.y,b.w,b.h,b.color);pixel(b.x,b.y,b.w,8,'#f3d9a1');pixel(b.x+8,b.y+14,b.w-16,b.h-22,'#f6e8c8');pixel(b.x+b.w/2-9,b.y+b.h-23,18,23,'#765c54');pixel(b.x+13,b.y+22,17,14,'#80b7bd');pixel(b.x+b.w-30,b.y+22,17,14,'#80b7bd');pixel(b.x+15,b.y+24,13,2,'#d9f3df');pixel(b.x+b.w-28,b.y+24,13,2,'#d9f3df');pixel(b.x+b.w/2-29,b.y+3,58,11,'#293943');ctx.fillStyle='#ffe2a5';ctx.font='bold 6px monospace';ctx.textAlign='center';ctx.fillText(b.sign,b.x+b.w/2,b.y+11)}
  function drawWorld(){
    pixel(0,0,W,H,'#a5cf91');
    // checker-like grass grain
    for(let y=0;y<H;y+=16)for(let x=0;x<W;x+=16){if(((x*13+y*7)%5)===0)pixel(x+4,y+5,2,2,'#91bf83')}
    // roads connect each neighborhood
    pixel(0,276,W,76,'#d4c89e');pixel(440,0,80,H,'#d4c89e');pixel(0,292,W,42,'#e1d6b3');pixel(458,0,44,H,'#e1d6b3');
    // dashed crossings
    for(let x=15;x<W;x+=32)pixel(x,312,15,2,'#f6efd8');for(let y=18;y<H;y+=32)pixel(478,y,2,15,'#f6efd8');
    // plaza paving and fountain
    pixel(190,126,133,109,'#ddcfaa');pixel(200,136,113,89,'#e7dcbf');pixel(228,161,53,36,'#94c6c1');pixel(234,167,41,24,'#65aaa9');pixel(247,157,13,7,'#c7e4d1');pixel(252,150,3,10,'#c7e4d1');
    // campus quad
    pixel(540,130,365,115,'#b5d09c');pixel(548,138,348,98,'#c9d8a8');
    // park
    pixel(535,365,390,235,'#88bd87');pixel(552,379,355,205,'#9cc88e');
    // paths
    pixel(590,350,18,245,'#d8ceaa');pixel(600,472,320,18,'#d8ceaa');pixel(615,355,5,220,'#e9dfbc');
    landmarks.forEach(drawBuilding);
    // trees, bushes, benches
    const trees=[[35,130],[185,55],[414,147],[510,65],[910,140],[35,315],[420,420],[514,500],[920,360],[875,590],[748,385],[572,550],[208,575],[390,565]];
    for(const [x,y] of trees){pixel(x+4,y+15,9,6,'#78945d');pixel(x+1,y+3,15,14,'#4e8d61');pixel(x+4,y,9,9,'#65a873');pixel(x+5,y+2,3,3,'#9bc879')}
    for(let x=220;x<414;x+=42){pixel(x,118,22,6,'#8e7357');pixel(x+2,116,18,3,'#e8c982')}
    // fountain sparkles
    if(Math.floor(performance.now()/400)%2===0){pixel(246,162,2,3,'#f9f0c4');pixel(267,177,2,2,'#edf5cc')}
    // destination lot sign
    pixel(lot.x-32,lot.y-27,64,43,save.stage>=5?'#263a43':'#c3ba95');pixel(lot.x-29,lot.y-24,58,37,save.stage>=5?'#273c44':'#e5dcbd');
    if(save.stage<5){pixel(lot.x-13,lot.y-8,26,21,'#987958');pixel(lot.x-18,lot.y-18,36,13,'#d67c55');pixel(lot.x-15,lot.y-15,30,9,'#f0c274');ctx.fillStyle='#364550';ctx.font='bold 5px monospace';ctx.textAlign='center';ctx.fillText('SOLAR EN VENTA',lot.x,lot.y-27)}
    else{pixel(lot.x-23,lot.y-20,46,30,'#de9d5a');pixel(lot.x-19,lot.y-16,38,26,'#324653');pixel(lot.x-14,lot.y-11,28,21,'#f1bd61');pixel(lot.x-9,lot.y-10,18,20,'#253946');ctx.fillStyle='#ffe49b';ctx.font='bold 6px monospace';ctx.fillText('TOÑO',lot.x,lot.y-25);pixel(lot.x-27,lot.y+15,54,3,'#7c6848')}
    // small flower patches
    for(let i=0;i<20;i++){let x=(i*79+41)%W,y=(i*113+85)%H;if((x<440&&y>352)||(x>520&&y>352)){pixel(x,y,2,2,i%2?'#f1d575':'#f1a4a2')}}
  }
  function drawPerson(n,x,y,isPlayer=false){
    const bob=Math.floor((isPlayer?player.walk:n.walk||0)%2);let coat=isPlayer?(save.outfit?'#e8c15d':'#e56f4c'):n.color, hair=isPlayer?'#27333c':({diego:'#303947',juan:'#453b3b',carlos:'#422f2b',prof:'#4a3b33',lola:'#563b50',tito:'#d2d0ba'}[n.id]||'#343b3c');
    // shadow, legs, jacket, head, hair and tiny face
    pixel(x-7,y+6,15,4,'#586e574a');pixel(x-5,y+2+bob,4,7,'#39434a');pixel(x+1,y+2+bob,4,7,'#39434a');pixel(x-7,y-7+bob,15,13,coat);pixel(x-6,y-8+bob,13,9,'#f1c59e');pixel(x-7,y-10+bob,15,6,hair);pixel(x-5,y-11+bob,8,3,hair);pixel(x-3,y-3+bob,2,2,'#303a3d');pixel(x+3,y-3+bob,2,2,'#303a3d');pixel(x-1,y+1+bob,3,1,'#a95754');pixel(x-1,y-6+bob,4,4,isPlayer?'#f7d177':'#f4e2ad');
    if(!isPlayer){ctx.fillStyle='#28353f';ctx.font='bold 6px monospace';ctx.textAlign='center';ctx.fillText(n.name.split(' ')[0],x,y+20)}
  }
  function render(){
    const cameraX=Math.max(0,Math.min(W-canvas.width,player.x-canvas.width/2));const cameraY=Math.max(0,Math.min(H-canvas.height,player.y-canvas.height/2));
    ctx.save();ctx.translate(-Math.round(cameraX),-Math.round(cameraY));drawWorld();
    // subtle paths and person sprites
    for(const n of npcs){n.walk=(n.walk||0)+.015;drawPerson(n,n.x,n.y)}
    // draw build marker beacon
    if(save.stage>=4&&save.stage<5){ctx.globalAlpha=.7+Math.sin(performance.now()/220)*.2;pixel(lot.x-2,lot.y-38,4,8,'#f3bf54');ctx.globalAlpha=1}
    drawPerson({},player.x,player.y,true);
    // interaction hint above nearest character
    const near=nearestNPC();if(near&&distance(player,near)<39){pixel(near.x-5,near.y-31,10,9,'#fff8df');ctx.fillStyle='#303c43';ctx.font='bold 7px monospace';ctx.textAlign='center';ctx.fillText('E',near.x,near.y-25)}
    ctx.restore();requestAnimationFrame(render);
  }
  function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
  function nearestNPC(){return npcs.reduce((best,n)=>distance(player,n)<distance(player,best||{x:9999,y:9999})?n:best,null)}
  function collides(x,y){if(x<12||y<12||x>W-12||y>H-12)return true;for(const b of landmarks){if(x>b.x-12&&x<b.x+b.w+12&&y>b.y-4&&y<b.y+b.h+12)return true}return false}
  function move(dx,dy){if(!dx&&!dy)return;const speed=1.6;let nx=player.x+dx*speed,ny=player.y+dy*speed;if(!collides(nx,player.y))player.x=nx;if(!collides(player.x,ny))player.y=ny;if(dx)player.face=dx<0?'left':'right';if(dy)player.face=dy<0?'up':'down';player.walk+=.2;save.x=player.x;save.y=player.y;updateUI()}
  function controlsLoop(){let dx=0,dy=0;if(keys.has('ArrowLeft')||keys.has('a')||held.has('left'))dx--;if(keys.has('ArrowRight')||keys.has('d')||held.has('right'))dx++;if(keys.has('ArrowUp')||keys.has('w')||held.has('up'))dy--;if(keys.has('ArrowDown')||keys.has('s')||held.has('down'))dy++;if(dx&&dy){dx*=.707;dy*=.707}move(dx,dy);requestAnimationFrame(controlsLoop)}
  function showDialogue(n,text,options){dialogueTarget=n;ui.speaker.textContent=n.name;ui.role.textContent=n.role;ui.portrait.textContent=n.initial;ui.portrait.style.background=n.color;ui.text.textContent=text;ui.choices.innerHTML='';for(const o of options){const b=document.createElement('button');b.className='choice';b.textContent=o.label;b.onclick=()=>{if(o.action)o.action();if(o.next){ui.text.textContent=o.next;b.remove();}else closeDialogue()};ui.choices.appendChild(b)}ui.dialogue.classList.remove('hidden')}
  function closeDialogue(){ui.dialogue.classList.add('hidden');dialogueTarget=null;persist()}
  function talk(){if(!ui.dialogue.classList.contains('hidden')){closeDialogue();return}const n=nearestNPC();if(n&&distance(player,n)<44){interact(n);return}if(save.stage>=4&&distance(player,lot)<72){interactLot();return}toast('Acércate a alguien o al solar para interactuar')}
  function interact(n){
    if(n.id==='diego'){
      if(save.stage===0){showDialogue(n,'¡Angel Luis! Tengo una idea con potencial y un calendario que parece una escena del crimen. Si vas a ofrecer compañía y animación para eventos de adultos, que sea con acuerdos claros, buen humor y cero dramas... bueno, los dramas que sean de utilería.',[{label:'Me apunto. ¿Por dónde empiezo?',action:()=>{save.stage=1;addReward(0,1,'¡Nueva misión! Primer evento desbloqueado');}}]);return}
      if(save.stage>=4&&save.stage<5){showDialogue(n,'¡Llegas justo a tiempo! Un grupo de adultos necesita un anfitrión para su noche de juegos. Nada raro: preguntas absurdas, limonada y gente discutiendo si el tomate cuenta como fruta.',[{label:'Acepto el turno (+¢65)',action:()=>{save.gigCount++;let tip=save.carisma?15:0;addReward(65+tip,2,'Turno completado: +¢'+(65+tip)+' · +2 reputación');}},{label:'¿Alguna noticia?',next:'El solar sigue en venta. El cartel dice «se aceptan sueños y efectivo». El cartel tiene buen ojo.'}]);return}
      if(save.stage>=5){showDialogue(n,'¡La Toño House va viento en popa! Podemos organizar una noche de trivia para el barrio. La entrada es una sonrisa; el presupuesto de premios y limonada cuesta ¢20.',[{label:'Organizar evento (¢20 → ¢55)',action:()=>{if(save.money<20){toast('Necesitas ¢20 para cubrir los gastos del evento');return}save.money-=20;addReward(55,3,'Evento del bar exitoso: +¢35 netos · +3 reputación');}},{label:'Hoy toca descansar',next:'Diego saca una silla plegable. La silla tiene lista de espera.'}]);return}
      showDialogue(n,'Estoy revisando contactos. En esta ciudad hasta el reloj de la plaza tiene representante.',[{label:'¡Ja! Luego nos vemos.',next:'Diego ya está anotando otra idea en una servilleta. La servilleta pide regalías.'}]);return;
    }
    if(n.id==='prof'&&save.stage===1){showDialogue(n,'Soy la profe Mora, tengo 42 años y una debilidad académica por los concursos de preguntas. Buscábamos un anfitrión para el evento universitario de adultos. El premio: una taza que dice «sobreviví a la trivia».', [{label:'¡Acepto ser anfitrión!',action:()=>{save.stage=2;addReward(90,5,'Evento impecable: +¢90 · +5 reputación');}},{label:'¿La taza tiene café?',next:'No. Tiene un dibujo de una taza más pequeña. La universidad está ahorrando.'}]);return}
    if(n.id==='juan'&&save.stage===2){showDialogue(n,'Traje tu tónico anti-dramático. Es una mezcla ficticia de hierbas, agua y una nota que dice «respira antes de mandar ese mensaje». Tu síndrome de la telenovela queda bajo control. No cura el melodrama, pero baja el volumen.',[{label:'Gracias, amigo. ¡Me siento en paz!',action:()=>{save.medicine=true;save.stage=3;addReward(60,3,'Tónico conseguido: +¢60 · +3 reputación');}},{label:'¿Y si la nota no funciona?',next:'Entonces lees la nota en voz alta. Con voz de documental. Mano de santo.'}]);return}
    if(n.id==='carlos'&&save.stage===3){showDialogue(n,'¡Campaña lista! Mi eslogan fue «Buena charla, buen ambiente, cero promesas imposibles». Quise ponerle brillo, pero el impresor solo tenía brillantina para piñatas.',[{label:'¡Lanza esos carteles!',action:()=>{save.poster=true;save.stage=4;addReward(100,8,'Campaña en marcha: +¢100 · +8 reputación');}},{label:'¿Hay versión sin brillantina?',next:'Sí: solo se pega un poco en el alma. Y en el suéter.'}]);return}
    if((n.id==='lola'||n.id==='tito')&&!save['side_'+n.id]){let amt=n.id==='lola'?35:25;const joke=n.id==='lola'?'¿Me ayudas a ordenar el kiosco? La sección «cosas que nadie pidió pero alguien compró» ya ocupa dos estantes.':'He perdido mi poema para el semáforo. Ayúdame a recitarlo y te pago. Trata sobre un cono naranja que busca su vocación.';showDialogue(n,joke,[{label:'¡Claro! (+¢'+amt+')',action:()=>{save['side_'+n.id]=true;addReward(amt,2,'Encargo vecinal: +¢'+amt+' · +2 reputación');}},{label:'Luego, que el cono espere.',next:'El cono asiente. Tiene mucha paciencia y ninguna articulación.'}]);return}
    const chatter={lola:'En el kiosco vendemos mapas, chicles y consejos no solicitados. Los consejos son gratis; el mapa está al revés por tradición.',tito:'El semáforo se puso en verde cuando terminé mi poema. O fue casualidad. La poesía y el tráfico son primos lejanos.',prof:'La respuesta correcta era «depende». En esta universidad, «depende» sirve para todo.',juan:'El tónico es ficticio, la amistad no. Acuérdate de hidratarte, campeón.',carlos:'Tu reputación subió. Ya hay tres personas que saben pronunciar tu apellido. Una es tu madre.'};showDialogue(n,chatter[n.id]||'¡Qué gusto verte por aquí!',[{label:'Nos vemos.',next:'¡Hasta pronto!'}]);
  }
  function interactLot(){if(save.stage<4){toast('Todavía no hay un plan para este solar');return}if(save.money<350){showDialogue({name:'DON PRÓSPERO',role:'Corredor de bienes raíces · 63 años',initial:'DP',color:'#b8a166'},`El solar cuesta ¢350. Has reunido ¢${save.money}. El letrero incluye una paloma con espíritu emprendedor.`,[{label:'Volver con el dinero',next:'Don Próspero te ofrece una silla plegable a crédito. Mejor no.'}]);return}showDialogue({name:'DON PRÓSPERO',role:'Corredor de bienes raíces · 63 años',initial:'DP',color:'#b8a166'},'¿¢350 y un plan de negocio escrito en una servilleta? ¡Trato hecho! La Toño House será realidad. El permiso de construcción está sellado con una huella de café.',[{label:'¡Construir e inaugurar!',action:()=>{save.money-=350;save.stage=5;save.won=true;persist();updateUI();document.getElementById('winOverlay').classList.remove('hidden');}}]);}
  // Map and menus
  const mapData=[['Plaza del reloj','Diego + solar'],['Universidad','Evento de trivia'],['Mercado','Juan Carlos'],['Las Jacarandas','Juan Antonio'],['Kiosco Lola','Encargos vecinales'],['La Toño House','Meta final']];
  document.getElementById('mapGrid').innerHTML=mapData.map((item,i)=>`<div class="map-tile ${i===Math.floor(player.x/480)+Math.floor(player.y/320)*2?'active':''}"><span>${item[0]}</span><em>${item[1]}</em></div>`).join('');
  document.getElementById('mapBtn').onclick=()=>{const idx=Math.floor(player.x/480)+Math.floor(player.y/320)*2;document.getElementById('mapGrid').innerHTML=mapData.map((item,i)=>`<div class="map-tile ${i===idx?'active':''}"><span>${item[0]}</span><em>${item[1]}</em></div>`).join('');document.getElementById('mapOverlay').classList.remove('hidden')};document.getElementById('bagBtn').onclick=()=>document.getElementById('bagOverlay').classList.remove('hidden');
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('.overlay').classList.add('hidden'));
  document.getElementById('closeDialogue').onclick=closeDialogue;document.getElementById('actionBtn').onclick=talk;
  document.getElementById('upgradeBtn').onclick=()=>{if(save.carisma){toast('Tu carisma ya está al máximo');return}if(save.money<80){toast('Te faltan ¢'+(80-save.money));return}save.money-=80;save.carisma=1;addReward(0,0,'¡Carisma mejorado! Tus turnos pagan más');};
  document.getElementById('outfitBtn').onclick=()=>{if(save.outfit){toast('El look está equipado y listo');return}if(save.money<50){toast('Te faltan ¢'+(50-save.money));return}save.money-=50;save.outfit=true;persist();updateUI();toast('Look de anfitrión comprado')};
  document.getElementById('celebrateBtn').onclick=()=>document.getElementById('winOverlay').classList.add('hidden');
  window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();if(k==='e'||k===' '){if(!e.repeat)talk()}else if(k==='m')document.getElementById('mapOverlay').classList.toggle('hidden');else if(k==='i')document.getElementById('bagOverlay').classList.toggle('hidden');else keys.add(k)});
  window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();held.clear()});
  document.querySelectorAll('.dpad button').forEach(button=>{const dir=button.dataset.dir;button.addEventListener('pointerdown',e=>{e.preventDefault();held.add(dir);button.setPointerCapture(e.pointerId)});['pointerup','pointercancel','lostpointercapture'].forEach(ev=>button.addEventListener(ev,()=>held.delete(dir)))});
  // Short, playful ambient loop and soft interaction cues; audio starts only after a gesture.
  let audioCtx=null,musicOn=true,musicTimer=null,noteIndex=0;const tune=[196,247,294,247,220,262,330,262];
  function startAudio(){if(!audioCtx){audioCtx=new (window.AudioContext||window.webkitAudioContext)();}if(audioCtx.state==='suspended')audioCtx.resume();if(!musicOn||musicTimer)return;musicTimer=setInterval(()=>{if(!audioCtx||!musicOn)return;const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.type='triangle';osc.frequency.value=tune[noteIndex++%tune.length];gain.gain.setValueAtTime(.0001,audioCtx.currentTime);gain.gain.exponentialRampToValueAtTime(.025,audioCtx.currentTime+.04);gain.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+.35);osc.connect(gain);gain.connect(audioCtx.destination);osc.start();osc.stop(audioCtx.currentTime+.36)},470)}
  document.getElementById('soundBtn').onclick=()=>{musicOn=!musicOn;document.getElementById('soundBtn').textContent=musicOn?'♫':'×';document.getElementById('soundBtn').setAttribute('aria-label',musicOn?'Música activada':'Música desactivada');if(musicOn)startAudio();toast(musicOn?'Música ambiental activada':'Música silenciada')};
  ['pointerdown','keydown'].forEach(ev=>window.addEventListener(ev,startAudio,{once:true}));
  // Surprise city moments give the player a tiny boost and keep wandering lively.
  setInterval(()=>{if(document.hidden||!ui.dialogue.classList.contains('hidden')||save.stage>=5)return;const jokes=['Un perro con pañuelo te confunde con su contador. Te deja una propina de ¢8.','Una ráfaga pega un volante en tu mochila: publicidad involuntaria, +¢6.','Un turista te pregunta dónde queda Valles City. Por ayudar, +¢7.'];addReward(6+Math.floor(Math.random()*4),0,jokes[Math.floor(Math.random()*jokes.length)]);},42000);
  updateUI();render();controlsLoop();
})();
