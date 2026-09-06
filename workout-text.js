(function(){
  'use strict';
  const examples={
    running:"Corsa · ripetute\nWU 10 min Z1\n6 x (3 min a 4:30/km + 2 min Z1)\nCD 10 min Z1",
    strength:"Forza · full body\nDurata 60 min\nBack Squat 4 x 5 @ 80 kg RIR 2 rec 2 min\nBench Press 3 x 8 @ 60 kg RIR 2 rec 90 s\nRomanian Deadlift 3 x 10 @ 70 kg RIR 3 rec 2 min",
    hyrox:"HYROX · engine\nDurata 50 min\nWarmup 10 min corsa facile\nWorkout\n4 x 500 m SkiErg RPE 7 rec 90 s\nSled push 4 x 25 m\n20 wall balls\nCD 5 min camminata"
  };
  function node(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;}
  function create({onApply,onUndo}){
    const panel=document.getElementById('workout-text-import'),input=document.getElementById('workout-text-input'),category=document.getElementById('workout-text-category'),preview=document.getElementById('workout-text-preview'),status=document.getElementById('workout-text-status'),undo=document.getElementById('workout-text-undo');
    let result=null,previous=null;
    function invalidate(){result=null;preview.replaceChildren();preview.hidden=true;status.textContent='';}
    input.addEventListener('input',invalidate);category.addEventListener('change',invalidate);
    document.querySelectorAll('[data-workout-example]').forEach(button=>button.addEventListener('click',()=>{
      if(input.value.trim()&&input.value!==examples[button.dataset.workoutExample]&&!window.confirm('Sostituire il testo inserito con questo esempio? I campi della seduta restano invariati.'))return;
      input.value=examples[button.dataset.workoutExample];input.scrollTop=0;category.value=button.dataset.workoutExample;invalidate();input.focus();
    }));
    document.getElementById('workout-text-analyze').addEventListener('click',()=>{
      result=window.rcWorkoutTextModel.parse(input.value,{category:category.value,fallbackCategory:document.getElementById('session-category').value});preview.replaceChildren();preview.hidden=false;
      const head=node('div','workout-text-preview-head');head.append(node('small','','ANTEPRIMA'),node('h3','',result.title||'Controlla il testo'));preview.append(head);
      const facts=node('div','workout-text-facts');[window.rcWorkoutTextModel.labels[result.category],result.blocks.length?`${result.blocks.length} blocchi`:null,result.durationMin?`${result.durationMin} min`:'Durata da completare',result.distanceKm?`${result.distanceKm} km`:null].filter(Boolean).forEach(value=>facts.append(node('span','',value)));preview.append(facts);
      const list=node('ol','workout-text-blocks');result.blocks.forEach(block=>{const li=node('li',`phase-${block.phase||'work'}`);li.append(node('span','',window.rcWorkoutTextModel.describe(block)));list.append(li);});preview.append(list);
      if(result.warnings.length){const warnings=node('ul','workout-text-warnings');result.warnings.forEach(value=>warnings.append(node('li','',value)));preview.append(warnings);}
      const uncertain=result.rows.filter(row=>row.status==='note');if(uncertain.length){const details=node('details','workout-text-unmatched');details.append(node('summary','',`${uncertain.length} righe da verificare`));uncertain.forEach(row=>details.append(node('p','',row.text)));preview.append(details);}
      if(result.canApply){const apply=node('button','primary','Compila i campi della seduta');apply.type='button';apply.addEventListener('click',()=>{
        if(!result)return;previous=onApply(result);undo.hidden=false;status.textContent='Campi compilati. Controlla data, durata e parametri, poi salva la seduta. Se l’hai già svolta, registra l’esito dopo il salvataggio.';preview.hidden=true;result=null;
        const destination=document.querySelector('#session-form [name="durationMin"]');if(!destination.value)destination.focus();else document.getElementById('session-title').focus({preventScroll:true});document.querySelector('.session-common').scrollIntoView({behavior:'smooth',block:'start'});
      });preview.append(node('p','workout-text-apply-note','Compila titolo, disciplina, durata e struttura. Sostituisce questi campi nella bozza; data, ora e note personali restano come sono.'),apply);}
      status.textContent=result.canApply?`Analisi pronta: ${result.blocks.length} blocchi riconosciuti${uncertain.length?`, ${uncertain.length} righe da verificare`:''}.`:'Nessuna modifica ai campi. Controlla le indicazioni sopra.';
    });
    undo.addEventListener('click',()=>{if(!previous)return;onUndo(previous);previous=null;undo.hidden=true;invalidate();status.textContent='Compilazione annullata. Ripristinati i campi precedenti.';});
    return{reset(session){invalidate();previous=null;undo.hidden=true;input.value=session?.details?.workoutTextSource||'';category.value='auto';panel.open=!session;}};
  }
  window.rcWorkoutTextUI={create};
})();
