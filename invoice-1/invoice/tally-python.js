(function () {
  const BRIDGE = 'http://127.0.0.1:9101';
  async function bridge(path) {
    const r = await fetch(BRIDGE + path, { cache: 'no-store' });
    const data = await r.json();
    if (!r.ok || data.ok === false) throw new Error(data.error || 'Tally bridge error');
    return data;
  }

  window.tallyPython = {
    bridge,
    health: () => bridge('/health'),
    companies: () => bridge('/companies'),
    ledgers: (company) => bridge('/ledgers' + (company ? '?company=' + encodeURIComponent(company) : '')),
    outstanding: (company) => bridge('/outstanding' + (company ? '?company=' + encodeURIComponent(company) : ''))
  };

  async function connectAndLoad() {
    const btn = document.getElementById('tally-top-connect-btn');
    if (btn) btn.textContent = '⏳ Tally Connecting...';
    try {
      const h = await window.tallyPython.health();
      if (btn) btn.textContent = '🟢 Tally Connected';
      window.dispatchEvent(new CustomEvent('tally-python-connected', { detail: h }));
      try {
        const c = await window.tallyPython.companies();
        window.dispatchEvent(new CustomEvent('tally-python-companies', { detail: c }));
      } catch (e) { console.warn('Company list:', e); }
    } catch (e) {
      if (btn) btn.textContent = '🔴 Tally Offline';
      console.error(e);
      alert('Tally Python Bridge connect nahi hua. Python bridge 9101 par running hona chahiye.');
    }
  }

  window.addEventListener('tally-connect', connectAndLoad);
  window.addEventListener('load', function () {
    setTimeout(connectAndLoad, 800);
  });
})();
