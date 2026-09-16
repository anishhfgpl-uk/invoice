/* safe-live.js compatibility loader */
(()=>{
  if(window.__tallysync_safe_live_loaded)return;
  window.__tallysync_safe_live_loaded=true;
  const s=document.createElement('script');
  s.src='https://raw.githubusercontent.com/anishhfgpl-uk/invoice/main/tally-connector/live-tally.js?v=20260916';
  s.async=false;
  s.onload=()=>console.log('TallySync Pro: live-tally.js loaded');
  s.onerror=()=>console.error('TallySync Pro: live-tally.js failed to load');
  document.head.appendChild(s);
})();
