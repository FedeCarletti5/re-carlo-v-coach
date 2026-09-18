(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.rcWorkoutTextModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='1.0.0',MAX_LENGTH=12000;
  const labels={running:'Corsa',cycling:'Ciclismo',swimming:'Nuoto',strength:'Forza',hyrox:'HYROX',metcon:'Metcon',recovery:'Recupero',test:'Test'};
  const phases={warmup:'Riscaldamento',work:'Lavoro',recovery:'Recupero',cooldown:'Defaticamento',free:'Libero'};
  const phasePattern=/^(warm\s*-?\s*up|warmup|wu|riscaldamento|attivazione|main(?:\s+(?:set|workout))?|workout|lavoro(?:\s+centrale)?|cool\s*-?\s*down|cooldown|cd|defaticamento|rec(?:upero|overy)?|rest)\b\s*(?::|-(?=\s))?\s*/i;
  const quantityPattern=/(\d+(?:[.,]\d+)?)\s*(km\b|metri\b|meters?\b|m\b|min(?:uti?|utes?)?\b|'(?!')|h\b|ore?\b|s(?:ec(?:ondi?|onds?)?)?\b|''|"|cal\b)/i;
  const n=value=>Number(String(value).replace(',','.'));
  const round=value=>Math.round(value*100)/100;
  function normalized(text){return text.replace(/\r\n?/g,'\n').replace(/[′’‘]/g,"'").replace(/[″“”]/g,'"').replace(/×/g,'x').replace(/[–—]/g,'-').replace(/\*\*/g,'').trim();}
  function phaseOf(label){return /^(?:wu|warm|riscald|attiv)/i.test(label)?'warmup':/^(?:cd|cool|defat)/i.test(label)?'cooldown':/^(?:rec|rest)/i.test(label)?'recovery':'work';}
  function quantity(text){
    const match=text.match(quantityPattern);if(!match)return null;
    if(match.index>0&&/[-\d.,]$/.test(text.slice(0,match.index)))return null;
    const amount=n(match[1]),rawUnit=match[2].toLowerCase();let unit=/^(km)$/.test(rawUnit)?'km':/^(m|metri|meters?)$/.test(rawUnit)?'m':rawUnit==='cal'?'cal':'min';
    let value=amount;if(unit==='min'){if(/^(s|"|'')/.test(rawUnit))value/=60;else if(/^(h|or)/.test(rawUnit))value*=60;}
    // Never turn a pace such as 4'30"/km into a four-minute phase.
    if(/^\s*\d{1,2}\s*["']\s*\/\s*km/i.test(text.slice(match.index+match[0].length)))return null;
    const remaining=text.slice(match.index+match[0].length);let display=match[0];
    if(unit==='min'&&/^(h|or)/.test(rawUnit)){const extra=remaining.match(/^\s*(\d+)\s*(?:min|')/i);if(extra){value+=n(extra[1]);display+=extra[0];}}
    if(unit==='min'&&/^(min|')$/.test(rawUnit)){const extra=remaining.match(/^\s*(\d+)\s*(?:s\b|"|'')/i);if(extra){value+=n(extra[1])/60;display+=extra[0];}}
    if(value<=0||value>2000||unit==='min'&&value<.01)return null;
    return{amount:Number(value.toFixed(6)),unit,display,index:match.index};
  }
  function target(text){
    const pace=text.match(/\b(\d{1,2})[:']([0-5]\d)(?:["']?)\s*(?:-\s*(\d{1,2})[:']([0-5]\d)(?:["']?)\s*)?(?:\/\s*km|min\s*\/\s*km)?/i);
    if(pace){const first=`${n(pace[1])}:${pace[2]}`,last=pace[3]?`–${n(pace[3])}:${pace[4]}`:'';return{targetType:'pace',target:`${first}${last}/km`};}
    const ftp=text.match(/(\d+(?:[.,]\d+)?)(?:\s*-\s*(\d+(?:[.,]\d+)?))?\s*%\s*(?:FTP)?/i);
    if(ftp)return{targetType:'ftp',target:`${ftp[1]}${ftp[2]?`–${ftp[2]}`:''}% FTP`,ftpMin:n(ftp[1]),ftpMax:n(ftp[2]||ftp[1])};
    const hr=text.match(/\bZ[1-5]\b(?:\s*[^\d\n]*\s*\d{2,3}\s*-\s*\d{2,3}\s*bpm)?|\b\d{2,3}(?:\s*-\s*\d{2,3})?\s*bpm\b/i);if(hr)return{targetType:'hr',target:hr[0].replace(/z/i,'Z')};
    const rpe=text.match(/\bRPE\s*(\d+(?:[.,]\d+)?)/i);if(rpe&&n(rpe[1])>=1&&n(rpe[1])<=10)return{targetType:'rpe',target:`RPE ${n(rpe[1])}`};
    return{targetType:'free',target:text.replace(/^\s*(?:a\s+|@\s*)/,'').trim()};
  }
  function segment(text,phase){const q=quantity(text);if(!q||q.unit==='cal')return null;return{type:'segment',phase,unit:q.unit,amount:q.amount,...target(text.slice(q.index+q.display.length))};}
  function detectCategory(text){
    if(/\bhyrox\b|sled (?:push|pull)|wall balls?/i.test(text))return'hyrox';
    if(/\b(?:amrap|emom|metcon|for time|chipper)\b/i.test(text))return'metcon';
    if(/\b(?:nuoto|swim|swimming|stile libero|dorso|rana|vasche)\b/i.test(text))return'swimming';
    if(/\b(?:bici|bike|ciclismo|cycling|rulli|FTP|rpm)\b/i.test(text))return'cycling';
    if(/\b(?:forza|strength|squat|panca|stacco|deadlift|bench|press|trazioni|pull[ -]?up|RIR)\b/i.test(text)||/\b\d+\s*x\s*\d+\s*(?:@|kg)/i.test(text))return'strength';
    if(/\b(?:corsa|run|running|lungo|ripetute|jog|maratona)\b|\/km/i.test(text))return'running';
    return null;
  }
  function splitLines(text){
    // Keep repetitions in parentheses intact; split common notes/WhatsApp separators.
    let depth=0,current='',lines=[];
    for(const ch of normalized(text)){if(ch==='('||ch==='[')depth++;if(ch===')'||ch===']')depth=Math.max(0,depth-1);if(ch==='\n'||ch===';'||ch==='+'&&depth===0){if(current.trim())lines.push(current.trim());current='';}else current+=ch;}
    if(current.trim())lines.push(current.trim());return lines.map(line=>line.replace(/^\s*(?:[-•●▪]+\s*|\d+[.)]\s+)/,'').trim()).filter(Boolean);
  }
  function endurance(line,phase,warnings){
    const repeated=line.match(/^(\d+)\s*x\s*(.+)$/i);if(!repeated){if(/\d+\s*x\s*\d+/i.test(line))return null;const plain=segment(line,phase);return plain?[plain]:null;}
    const count=n(repeated[1]);if(count<1||count>100)return null;
    const body=repeated[2];if(/^[([]/.test(body)&&!/[)\]]$/.test(body))return null;const wrapped=/^[([]/.test(body),clean=body.replace(/^[([]\s*/,'').replace(/\s*[)\]]$/,'');
    if(/\d+\s*x\s*/i.test(clean)){warnings.push('Ripetizioni annidate: mantieni lo schema originale e completa i blocchi a mano.');return null;}
    const pieces=clean.split(/\s*(?:\+|\/?\s*\b(?:rec(?:upero|overy)?|rest|r)\b\s*[:.=]?)\s*/i).filter(Boolean);
    if(pieces.length>2)return null;
    const work=segment(pieces[0],phase);if(!work)return null;
    const recovery=pieces[1]?segment(pieces[1],'recovery'):null;if(pieces[1]&&!recovery)return null;
    if(!recovery){warnings.push(`“${line}”: recupero non indicato; aggiungilo se previsto.`);return[{type:'repeat',repeats:count,steps:[work]}];}
    if(wrapped)return[{type:'repeat',repeats:count,steps:[work,recovery]}];
    warnings.push(`“${line}”: ${Math.max(0,count-1)} recuperi tra le ripetizioni, escluso quello finale. Verifica lo schema.`);
    return count===1?[work]:[{type:'repeat',repeats:count-1,steps:[work,recovery]},work];
  }
  function strength(line){
    const match=line.match(/^(.*?)\s*(\d+)\s*x\s*(\d+)(?![\d.,]|\s*-\s*\d)(.*)$/i);if(!match)return null;
    const name=match[1].replace(/[:–-]\s*$/,'').trim(),sets=n(match[2]),reps=n(match[3]),tail=match[4];if(/[-\d.,]$/.test(name))return null;if(!name||sets<1||sets>100||reps<1||reps>100)return null;
    if(/[-+]\s*\d+(?:[.,]\d+)?\s*kg\b|\d+\s*x\s*\d+(?:[.,]\d+)?\s*kg\b/i.test(tail))return null;
    if(/^\s*(?:m\b|km\b|min\b|s\b|'|")/i.test(tail))return null;
    const load=tail.match(/(?:@\s*)?(\d+(?:[.,]\d+)?)\s*kg\b/i),rir=tail.match(/\bRIR\s*(\d+(?:[.,]\d+)?)/i),rpe=tail.match(/\bRPE\s*(\d+(?:[.,]\d+)?)/i),rest=tail.match(/\b(?:rec(?:upero|overy)?|rest|r)\s*[:.=]?\s*(.+)$/i),q=rest&&quantity(rest[1]);
    const row={name,sets,reps,loadKg:load?n(load[1]):'',target:rir?`RIR ${n(rir[1])}`:rpe?`RPE ${n(rpe[1])}`:'',rest:q&&q.unit==='min'?`${Math.round(q.amount*60)} s`:''};
    if(load&&row.loadKg>700||rir&&(n(rir[1])>6||n(rir[1])*2%1)||rpe&&(n(rpe[1])<1||n(rpe[1])>10||n(rpe[1])*2%1))return null;
    if(q&&q.unit==='min'&&(Math.round(q.amount*60)<1||Math.round(q.amount*60)>3600))return null;
    if(rir)row.targetRir=n(rir[1]);if(rpe)row.targetRpe=n(rpe[1]);if(q&&q.unit==='min')row.restSec=Math.round(q.amount*60);
    return row;
  }
  function totals(blocks){
    const flat=blocks.flatMap(block=>block.type==='repeat'?block.steps.map(step=>({...step,multiplier:block.repeats})):block);
    let minutes=0,km=0,allTime=flat.length>0,allDistance=flat.length>0;
    for(const item of flat){const count=item.multiplier||1,pace=item.targetType==='pace'&&item.target.match(/^(\d+):([0-5]\d)\/km$/),paceMin=pace?n(pace[1])+n(pace[2])/60:null;
      if(item.unit==='min'){minutes+=item.amount*count;if(paceMin)km+=item.amount/paceMin*count;else allDistance=false;}
      else {const distance=item.unit==='m'?item.amount/1000:item.amount;km+=distance*count;if(paceMin)minutes+=distance*paceMin*count;else allTime=false;}
    }
    return{durationMin:allTime?Math.ceil(round(minutes)):null,distanceKm:allDistance?round(km):null};
  }
  function describe(block){if(block.type==='repeat')return`${block.repeats} × (${block.steps.map(describe).join(' + ')})`;if(block.type==='segment')return`${phases[block.phase]} · ${block.unit==='min'&&block.amount<1?`${Math.round(block.amount*60)} s`:`${Number(block.amount.toFixed(2))} ${block.unit}`}${block.target?` · ${block.target}`:''}`;return[block.name,block.volume,block.sets?`${block.sets} × ${block.reps}`:'',block.loadKg!==''&&block.loadKg!==undefined?`${block.loadKg} kg`:'',block.target,block.rest?`rec. ${block.rest}`:''].filter(Boolean).join(' · ');}
  function parse(text,options={}){
    const source=String(text??'');const warnings=[],rows=[],blocks=[];
    if(!source.trim()||source.length>MAX_LENGTH)return{source,canApply:false,category:null,blocks,rows,warnings:[source.length>MAX_LENGTH?`Il testo supera ${MAX_LENGTH.toLocaleString('it-IT')} caratteri. Dividilo in singole sedute.`:'Incolla il testo di una singola seduta.'],details:{}};
    const detected=detectCategory(source),category=labels[options.category]?options.category:detected||options.fallbackCategory||'running';
    if(!labels[category])return{source,category,canApply:false,blocks,rows,warnings:['Per questa categoria inserisci il nome dell’attività nel titolo, la durata e le note. Per un allenamento strutturato scegli una disciplina nel menu sopra.'],details:{}};
    if(!detected&&!labels[options.category])warnings.push(`Disciplina non esplicita: uso ${labels[category]}. Puoi cambiarla prima di analizzare.`);
    let phase='work',title='',explicitDuration=null,explicitDistance=null,uncertainVolume=false;
    const details={},lines=splitLines(source);
    if(lines.length>150)return{source,category,canApply:false,blocks,rows,warnings:['Troppi blocchi: incolla una sola seduta (massimo 150 righe).'],details};
    for(let index=0;index<lines.length;index++){
      const original=lines[index];let line=original,linePhase=phase;const heading=line.match(phasePattern);
      if(heading){linePhase=phaseOf(heading[1]);line=line.slice(heading[0].length);if(!line){phase=linePhase;rows.push({text:original,status:'heading',summary:phases[phase]});continue;}}
      const duration=line.match(/^(?:durata(?:\s+totale)?|totale|total(?:\s+time)?|duration)\s*[:=]?\s*(.+)$/i);
      if(duration){const q=quantity(duration[1]);if(q?.unit==='min'){explicitDuration=Math.ceil(q.amount);rows.push({text:original,status:'parsed',summary:`Durata dichiarata · ${explicitDuration} min`});continue;}if(q&&['m','km'].includes(q.unit)){explicitDistance=q.unit==='m'?q.amount/1000:q.amount;rows.push({text:original,status:'parsed',summary:`Distanza dichiarata · ${explicitDistance} km`});continue;}}
      let parsed=null;
      if(category==='strength'){const exercise=strength(line);if(exercise)parsed=[exercise];}
      else if(['running','cycling'].includes(category))parsed=endurance(line,linePhase,warnings);
      else if(['hyrox','metcon','swimming'].includes(category)){
        const q=quantity(line),reps=line.match(/\b\d+\s*(?:x\s*\d+\s*)?(?:reps?|rip(?:etizioni)?|burpees?|wall balls?|pull[ -]?ups?)\b/i);
        if(q||reps){const t=target(line),rest=line.match(/\b(?:rec(?:upero|overy)?|rest)\s*[:.=]?\s*(.+)$/i);parsed=[{name:heading?`${phases[linePhase]} · ${line}`:line,volume:q?line.match(/\d+\s*x\s*\d+(?:[.,]\d+)?\s*(?:m\b|km\b|min\b|cal\b)/i)?.[0]||q.display:reps[0],target:t.targetType==='free'?'':t.target,rest:rest?.[1]||''}];}
      }
      if(parsed){if(category==='running')parsed.forEach(block=>(block.type==='repeat'?block.steps:[block]).forEach(step=>{if(step.targetType==='ftp')step.targetType='free';}));blocks.push(...parsed);rows.push({text:original,status:'parsed',summary:parsed.map(describe).join(' → ')});continue;}
      if(!title&&index===0&&!heading&&!/\d/.test(line)){title=line.replace(/^(?:titolo|title)\s*:\s*/i,'').slice(0,80);rows.push({text:original,status:'heading',summary:'Titolo della seduta'});}
      else {rows.push({text:original,status:'note',summary:'Conservato nel testo originale · da verificare'});if(/\d/.test(line)||heading)uncertainVolume=true;}
    }
    const limit=['running','cycling'].includes(category)?40:50;
    if(blocks.length>limit){warnings.push(`Oltre ${limit} blocchi: dividi il testo in più sedute.`);return{source,category,canApply:false,blocks:[],rows,warnings,details};}
    const computed=['running','cycling'].includes(category)&&!uncertainVolume?totals(blocks):{durationMin:null,distanceKm:null};
    const durationMin=explicitDuration??computed.durationMin,distanceKm=explicitDistance??computed.distanceKm;
    if(explicitDuration&&computed.durationMin&&Math.abs(explicitDuration-computed.durationMin)>1)warnings.push(`Durata dichiarata ${explicitDuration} min; dai blocchi risultano ${computed.durationMin} min. Verifica la differenza.`);
    if(!durationMin)warnings.push('Durata totale non determinabile: inseriscila prima di salvare.');
    if(rows.some(row=>row.status==='note'))warnings.push('Le righe da verificare restano nel testo originale e non sono trasformate in parametri.');
    if(!blocks.length)warnings.push('Nessun blocco riconosciuto. Specifica quantità e unità, oppure scegli la disciplina corretta.');
    if(category==='running'){
      details.runBlocks=blocks;details.runType=blocks.some(b=>b.type==='repeat')?'Intervals':/lungo|long run/i.test(source)?'Long run':/soglia|tempo|threshold/i.test(source)?'Tempo / Threshold':/\b(?:easy|facile|Z2)\b/i.test(source)?'Easy run':'';details.runTarget='free';details.hrZone='';details.runRpe='';details.paceMin='';details.paceSec='';if(distanceKm!==null)details.distanceKm=distanceKm;
    }else if(category==='cycling'){details.rideBlocks=blocks;details.rideType=/sweet spot/i.test(source)?'Sweet spot':/vo2/i.test(source)?'VO2max bike':/soglia|threshold/i.test(source)?'Threshold ride':/endurance/i.test(source)?'Endurance ride':'';details.ftpMin='';details.ftpMax='';details.cadence='';}
    else if(category==='strength'){details.strengthBlocks=blocks;details.strengthFocus=/lower|gambe/i.test(source)?'Lower body':/upper/i.test(source)?'Upper body':/full body/i.test(source)?'Full body':'';details.targetRir='';}
    else if(category==='swimming'){details.swimStructuredBlocks=blocks;details.swimType='';details.swimRpe='';if(explicitDistance!==null)details.swimDistanceM=explicitDistance*1000;}
    else if(category==='hyrox'){details.hyroxStructuredBlocks=blocks;details.hyroxFormat=/engine/i.test(source)?'HYROX engine':'';details.hyroxRpe='';}
    else if(category==='metcon'){details.metconStructuredBlocks=blocks;details.metconRpe='';details.metconType=/emom/i.test(source)?'EMOM':/amrap/i.test(source)?'AMRAP':/for time/i.test(source)?'For time':'Mixed modal conditioning';}
    // Imported text is authoritative: never generate missing targets from profile defaults.
    details.prescriptionLocked=true;details.workoutTextSource=source;
    return{source,version:VERSION,category,title:title||`${labels[category]} · da testo`,durationMin,distanceKm,details,blocks,rows,warnings,canApply:blocks.length>0};
  }
  return{VERSION,MAX_LENGTH,parse,describe,totals,labels};
});
