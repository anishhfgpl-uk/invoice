(()=>{
const fix=()=>{
 const b=document.getElementById('anish-fixed-brand');
 if(b){
  b.style.setProperty('top','0','important');
  b.style.setProperty('left','0','important');
  b.style.setProperty('right','0','important');
  b.style.setProperty('height','46px','important');
  b.style.setProperty('min-height','46px','important');
  b.style.setProperty('max-height','46px','important');
  b.style.setProperty('padding','0','important');
  b.style.setProperty('margin','0','important');
  b.style.setProperty('line-height','46px','important');
  b.style.setProperty('white-space','nowrap','important');
  b.style.setProperty('overflow','hidden','important');
  b.textContent='ANISH TECHNOLOGIES';
 }
 document.body.style.setProperty('padding-top','0','important');
 document.body.style.setProperty('margin-top','0','important');
 document.documentElement.style.setProperty('scroll-padding-top','46px','important');
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fix);else fix();
new MutationObserver(fix).observe(document.documentElement,{childList:true,subtree:true});
})();
