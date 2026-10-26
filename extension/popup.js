let blobUrl=null,lastText="";
async function send(fileOrUrl){
  const fmt=document.getElementById('format').value;
  const fd=new FormData();
  if(fileOrUrl instanceof File){ fd.append('file',fileOrUrl); }
  else { const r=await fetch(fileOrUrl); const b=await r.blob(); fd.append('file',new File([b],'tab.pdf',{type:'application/pdf'})); }
  fd.append('format',fmt);
  const res=await fetch('http://127.0.0.1:8765/extract',{method:'POST',body:fd});
  if(!res.ok) throw new Error('API error '+res.status+' - is pdfx-api running?');
  if(fmt==='json'){ const j=await res.json(); lastText=j.text||JSON.stringify(j,null,2); document.getElementById('out').textContent=lastText.slice(0,8000); }
  else { const b=await res.blob(); blobUrl=URL.createObjectURL(b); const a=document.getElementById('dl'); a.href=blobUrl; a.download='extracted.'+fmt; a.style.display='block'; a.textContent='Download result'; if(fmt==='txt'||fmt==='md'){ lastText=await b.text(); document.getElementById('out').textContent=lastText.slice(0,8000);} }
  document.getElementById('copy').style.display=lastText?'block':'none';
}
document.getElementById('go').onclick=async()=>{ const f=document.getElementById('file').files[0]; if(!f){document.getElementById('out').textContent='Pick a PDF file first, or use the tab button.';return;} try{await send(f);}catch(e){document.getElementById('out').textContent=String(e);} };
document.getElementById('tab').onclick=async()=>{ const [tab]=await chrome.tabs.query({active:true,currentWindow:true}); if(!tab.url||!tab.url.toLowerCase().includes('.pdf')){document.getElementById('out').textContent='Current tab is not a PDF URL.';return;} try{await send(tab.url);}catch(e){document.getElementById('out').textContent=String(e);} };
document.getElementById('copy').onclick=()=>navigator.clipboard.writeText(lastText);
