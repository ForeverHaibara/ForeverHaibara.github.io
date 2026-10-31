const button=document.querySelector<HTMLButtonElement>('#run')!;
const frame=document.querySelector<HTMLIFrameElement>('#test')!;
const status=document.querySelector<HTMLPreElement>('#status')!;
const ids=[7,31,72,92,106];
const results:Array<{id:string;success:boolean}> = [];
let running=false;
const next=()=>{
  if(results.length===ids.length){
    status.textContent+='\nCOMPLETE';button.disabled=false;running=false;return;
  }
  const id=ids[results.length];status.textContent+=`\nRunning Q${id}`;
  frame.src=`./geogebra-gibert-structured-smoke.html?id=${id}&experimental=1&autorun=1`;
};
window.addEventListener('message',(event)=>{
  if(!running || event.origin!==location.origin || event.source!==frame.contentWindow || event.data?.type!=='gibert-structured-result')return;
  const result=event.data.data;
  if(result.id!==`Q${String(ids[results.length]).padStart(3,'0')}`)return;
  results.push(result);status.textContent+=`\n${result.id}: ${result.success?'PASS':'FAIL'}`;
  document.querySelector('#json')!.textContent=JSON.stringify(results,null,2);next();
});
button.onclick=()=>{results.length=0;running=true;button.disabled=true;status.textContent='Starting';next();};
