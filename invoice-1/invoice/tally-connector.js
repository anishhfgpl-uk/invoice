/* Remote Tally connector UI v15 - updated for active relay and robust diagnostics */
(() => {
  const DEFAULT_RELAY = 'https://tally-relay-anil-sharma.onrender.com';
  const K = {
    url: 'tallysync_connector_url',
    relay: 'tallysync_relay_url',
    code: 'tallysync_office_code',
    company: 'tallysync_selected_company',
    companies: 'tallysync_companies',
    companyData: 'tallysync_company_profile',
    debtors: 'tallysync_debtors',
    items: 'tallysync_items',
    invoices: 'tallysync_invoices',
  };

  const esc = (v) =>
    String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const saved = () => localStorage.getItem(K.url) || 'http://127.0.0.1:9101';
  const code = () => (localStorage.getItem(K.code) || '').trim().toUpperCase();
  const relay = () => {
    const r = (localStorage.getItem(K.relay) || '').trim();
    if (!r || r.includes('tally-relay-anish')) {
      localStorage.setItem(K.relay, DEFAULT_RELAY);
      return DEFAULT_RELAY;
    }
    return r.replace(/\/$/, '');
  };
  const selected = () => {
    try {
      return JSON.parse(localStorage.getItem(K.company) || 'null');
    } catch {
      return null;
    }
  };
  const num = (v) => {
    const n = Number(String(v ?? '').replace(/,/g, '').replace(/[A-Za-z]/g, '').trim());
    return Number.isFinite(n) ? Math.abs(n) : 0;
  };
  const safeId = (p, v) =>
    `${p}_tally_${String(v || 'x')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 70)}`;

  async function checkStatus(customCode, customRelay) {
    const rUrl = (customRelay || relay()).replace(/\/$/, '');
    const oCode = (customCode !== undefined ? customCode : code()).trim().toUpperCase();
    try {
      const hRes = await fetch(`${rUrl}/health`, { signal: AbortSignal.timeout(12000) });
      if (!hRes.ok) {
        return { ok: false, relay: false, deviceConnected: false, code: oCode, message: `Relay responded HTTP ${hRes.status}` };
      }
      if (!oCode) {
        return { ok: true, relay: true, deviceConnected: false, code: '', message: 'Relay server online hai. Kripya Office Code dalein.' };
      }
      const dRes = await fetch(`${rUrl}/api/device/${encodeURIComponent(oCode)}/status`, { signal: AbortSignal.timeout(12000) });
      const dData = await dRes.json();
      return {
        ok: true,
        relay: true,
        deviceConnected: !!dData.connected,
        lastSeen: dData.lastSeen || null,
        code: oCode,
        message: dData.connected
          ? 'Office computer connected hai! Tally ready hai.'
          : 'Office computer offline hai. Kripya START-ANISH-TALLY-CONNECTOR.cmd chalayein.',
      };
    } catch (e) {
      return {
        ok: false,
        relay: false,
        deviceConnected: false,
        code: oCode,
        message: `Relay connect error: ${e?.message || e}`,
      };
    }
  }

  async function request(u, xml, timeout = 60000) {
    const r = await fetch(u, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml;charset=utf-8' },
      body: xml,
      signal: AbortSignal.timeout(timeout),
    });
    const t = await r.text();
    if (!r.ok) {
      try {
        const j = JSON.parse(t);
        if (j.error) {
          if (/offline/i.test(j.error)) {
            throw Error(
              `Office computer par Tally connector offline hai (Code: ${j.code || code()}). Kripya office computer par START-ANISH-TALLY-CONNECTOR.cmd open karein aur TallyPrime khula rakhein.`
            );
          }
          throw Error(j.error);
        }
      } catch (je) {
        if (je.message && je.message.includes('Office computer')) throw je;
      }
      throw Error(t.slice(0, 400) || `HTTP ${r.status}`);
    }
    return t;
  }

  async function post(xml) {
    const c = code();
    const currentRelay = relay();
    const local = saved().replace(/\/$/, '');
    const remote = c ? `${currentRelay}/api/device/${encodeURIComponent(c)}/xml` : '';

    if (!c && window.location.protocol === 'https:') {
      throw Error('Office Code nahi mila. Kripya Tally Connect me office computer ka code dalein.');
    }

    if (remote) {
      try {
        return await request(remote, xml, 60000);
      } catch (e) {
        const isTimeout = e?.name === 'AbortError' || e?.name === 'TimeoutError';
        if (isTimeout) {
          throw Error(
            'Tally request timed out (60 sec). Check karein ki TallyPrime me company open hai aur port 9000 par response mil raha hai.'
          );
        }
        // If on HTTPS, browser prevents direct HTTP to 127.0.0.1 anyway
        if (window.location.protocol === 'https:') {
          throw e;
        }
        try {
          return await request(`${local}/tally/xml`, xml, 60000);
        } catch (le) {
          throw Error(`${e?.message || e}; Local connector: ${le?.message || le}`);
        }
      }
    }

    try {
      return await request(`${local}/tally/xml`, xml, 60000);
    } catch (e) {
      throw Error(`Local connector failed: ${e?.message || e}`);
    }
  }

  const companyTag = () =>
    selected()?.Name ? `<SVCURRENTCOMPANY>${esc(selected().Name)}</SVCURRENTCOMPANY>` : '';

  async function collection(name, type, fetches, extra = '', useCompany = true, filters = []) {
    const filterXml = filters
      .map((f) => `<FILTER>${f.name}</FILTER><SYSTEM TYPE="Formulae" NAME="${f.name}">${f.expr}</SYSTEM>`)
      .join('');
    return post(
      `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>${name}</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>${
        useCompany ? companyTag() : ''
      }${extra}</STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="${name}" ISMODIFY="No"><TYPE>${type}</TYPE>${filterXml}<FETCH>${fetches}</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`
    );
  }

  function parse(raw, tags) {
    const d = new DOMParser().parseFromString(String(raw || ''), 'text/xml');
    const er = [...d.querySelectorAll('LINEERROR,ERROR')]
      .map((x) => x.textContent.trim())
      .filter(Boolean);
    if (er.length) throw Error(er.join(' | '));
    return [...d.querySelectorAll('LEDGER,STOCKITEM,VOUCHER,COMPANY')]
      .map((n) => {
        const o = {};
        tags.forEach((t) => {
          const q = n.querySelector(t) || n.querySelector(t.toUpperCase());
          o[t] = (q?.textContent || n.getAttribute(t) || '').trim();
        });
        return o;
      })
      .filter((o) => Object.values(o).some(Boolean));
  }

  function parseCompanies(raw) {
    const d = new DOMParser().parseFromString(String(raw || ''), 'text/xml');
    const er = [...d.querySelectorAll('LINEERROR,ERROR')]
      .map((x) => x.textContent.trim())
      .filter(Boolean);
    if (er.length) throw Error(er.join(' | '));
    return [...d.querySelectorAll('COMPANY')]
      .map((n) => ({
        Name: (n.querySelector('NAME')?.textContent || n.getAttribute('NAME') || '').trim(),
        Guid: (n.querySelector('GUID')?.textContent || '').trim(),
        GSTIN: (n.querySelector('GSTIN')?.textContent || '').trim(),
        StateName: (n.querySelector('STATENAME')?.textContent || '').trim(),
        PinCode: (n.querySelector('PINCODE')?.textContent || '').trim(),
      }))
      .filter((x) => x.Name);
  }

  function emit(name, data) {
    try {
      localStorage.setItem(name, JSON.stringify(data));
    } catch {}
    window.dispatchEvent(
      new CustomEvent('tallysync:import', {
        detail: { type: name, data, company: selected() },
      })
    );
  }

  async function loadCompanies() {
    const raw = await collection('Company Collection', 'Company', 'Name,Guid,GSTIN,StateName,PinCode', '', false);
    const rows = parseCompanies(raw);
    if (!rows.length) {
      throw Error('TallyPrime me koi company open nahi hai. Kripya TallyPrime me company open karein.');
    }
    const wanted = selected()?.Name;
    const chosen = rows.find((x) => wanted && x.Name === wanted) || rows[0];
    localStorage.setItem(K.companies, JSON.stringify(rows));
    localStorage.setItem(K.company, JSON.stringify(chosen));
    localStorage.setItem(K.companyData, JSON.stringify(chosen));
    window.dispatchEvent(
      new CustomEvent('tallysync:company-updated', {
        detail: { companies: rows, selected: chosen },
      })
    );
    emit(K.companies, rows);
    return chosen;
  }

  async function importDebtors() {
    if (!selected()) await loadCompanies();
    const a = parse(
      await collection(
        'All Ledgers',
        'Ledger',
        'Name,Parent,ClosingBalance,OpeningBalance,PhoneNumber,Email,GSTIN,Address,MailingName,StateName,PinCode,PartyGSTIN,LedgerContact,LedgerPhone'
      ),
      [
        'Name',
        'Parent',
        'ClosingBalance',
        'OpeningBalance',
        'PhoneNumber',
        'Email',
        'GSTIN',
        'Address',
        'MailingName',
        'StateName',
        'PinCode',
        'PartyGSTIN',
        'LedgerContact',
        'LedgerPhone',
      ]
    ).filter((x) => /sundry\s*debtors/i.test(x.Parent || ''));
    emit(K.debtors, a);
    return a;
  }

  async function importItems() {
    if (!selected()) await loadCompanies();
    const a = parse(
      await collection(
        'All Stock Items',
        'StockItem',
        'Name,Parent,ClosingBalance,OpeningBalance,BaseUnits,Rate,HSNCode,HSNName,TaxRate'
      ),
      ['Name', 'Parent', 'ClosingBalance', 'OpeningBalance', 'BaseUnits', 'Rate', 'HSNCode', 'HSNName', 'TaxRate']
    );
    emit(K.items, a);
    return a;
  }

  function dt(s) {
    let v = String(s || '').trim();
    let m = v.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = v.match(/^(\d{2})[-/]([A-Za-z]{3})[-/](\d{4})$/);
    if (m) {
      const z = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
      return new Date(+m[3], z[m[2]] ?? 0, +m[1]);
    }
    return new Date(v);
  }

  function ymd(s) {
    const d = dt(s);
    return Number.isNaN(d.getTime())
      ? ''
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function ranges(from, to) {
    const a = dt(from);
    const b = dt(to);
    const r = [];
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || a > b) {
      throw Error('Invoice date range invalid hai (e.g. 01-Apr-2026 to 30-Sep-2026).');
    }
    for (let d = new Date(a); d <= b; ) {
      let e = new Date(d);
      e.setDate(e.getDate() + 6);
      if (e > b) e = new Date(b);
      r.push([
        `${String(d.getDate()).padStart(2, '0')}-${d.toLocaleString('en', { month: 'short' })}-${d.getFullYear()}`,
        `${String(e.getDate()).padStart(2, '0')}-${d.toLocaleString('en', { month: 'short' })}-${e.getFullYear()}`,
      ]);
      d = new Date(e);
      d.setDate(d.getDate() + 1);
    }
    return r;
  }

  function invoiceRows(raw) {
    return parse(raw, [
      'Date',
      'VoucherNumber',
      'VoucherTypeName',
      'PartyLedgerName',
      'Amount',
      'Reference',
      'ReferenceDate',
      'Narration',
      'GUID',
      'MasterID',
    ]);
  }

  function toAppInvoices(rows) {
    const comp = selected() || {};
    const companyId = String(
      comp.Guid || `comp_tally_${String(comp.Name || 'company').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`
    );
    return rows.map((v, i) => {
      const date = ymd(v.Date);
      const name = String(v.PartyLedgerName || '').trim();
      const total = num(v.Amount);
      return {
        id: String(v.GUID || v.MasterID || `inv_tally_${v.VoucherNumber || i}_${date}`),
        companyId,
        invoiceNumber: String(v.VoucherNumber || v.MasterID || i),
        invoiceDate: date,
        dueDate: date,
        debtorId: safeId('deb', name),
        debtorName: name,
        debtorAddress: '',
        debtorState: '',
        debtorStateCode: '',
        placeOfSupply: '',
        placeOfSupplyCode: '',
        isInterState: false,
        items: [],
        subTotal: total,
        totalDiscount: 0,
        totalTaxable: total,
        cgstTotal: 0,
        sgstTotal: 0,
        igstTotal: 0,
        roundOff: 0,
        grandTotal: total,
        notes: String(v.Narration || ''),
        paymentTerms: '',
        status: 'Unpaid',
        amountPaid: 0,
        balanceDue: total,
      };
    });
  }

  async function importInvoices(from = '01-Apr-2026', to = '30-Sep-2026', progress = () => {}) {
    if (!selected()) await loadCompanies();
    const rs = ranges(from, to);
    const all = [];
    for (let i = 0; i < rs.length; i++) {
      const [f, t] = rs[i];
      progress(i + 1, rs.length, f, t);
      const extra = `<SVFROMDATE TYPE="Date">${f}</SVFROMDATE><SVTODATE TYPE="Date">${t}</SVTODATE><SVViewName>Accounting Voucher View</SVViewName>`;
      const rows = invoiceRows(
        await collection(
          'Invoice Vouchers',
          'Voucher',
          'Date,VoucherNumber,VoucherTypeName,PartyLedgerName,Amount,Reference,ReferenceDate,Narration,GUID,MasterID',
          extra,
          true,
          [
            { name: 'IsSalesVoucher', expr: '$VoucherTypeName = "Sales"' },
            { name: 'InDateRange', expr: '$Date >= ##SVFROMDATE AND $Date <= ##SVTODATE' },
          ]
        )
      );
      all.push(...rows);
      const appRows = toAppInvoices(rows);
      let old = [];
      try {
        old = JSON.parse(localStorage.getItem('tallysync_invoices_v2') || '[]');
      } catch {}
      const map = new Map(old.map((x) => [String(x.id), x]));
      appRows.forEach((x) => map.set(x.id, x));
      localStorage.setItem('tallysync_invoices_v2', JSON.stringify([...map.values()]));
      emit(K.invoices, rows);
    }
    return all;
  }

  async function importAll(from, to, progress) {
    const company = await loadCompanies();
    const debtors = await importDebtors();
    const items = await importItems();
    const invoices = await importInvoices(from, to, progress);
    window.dispatchEvent(
      new CustomEvent('tallysync:data', {
        detail: { company, data: { company, debtors, stock: items, invoices } },
      })
    );
    return { company, debtors, items, invoices };
  }

  window.__tsPanel = {
    loadCompanies,
    importDebtors,
    importItems,
    importInvoices,
    importAll,
    checkStatus,
    getRelay: relay,
    getCode: code,
    setCode: (c) => localStorage.setItem(K.code, (c || '').trim().toUpperCase()),
    setRelay: (r) => localStorage.setItem(K.relay, (r || DEFAULT_RELAY).trim()),
  };
})();
