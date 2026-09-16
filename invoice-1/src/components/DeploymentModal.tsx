import React, { useState } from 'react';
import { Globe, CheckCircle2, Copy, Check, Server, FolderTree, ExternalLink, X, ShieldCheck } from 'lucide-react';

interface DeploymentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeploymentModal: React.FC<DeploymentModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'cloudflare' | 'cpanel' | 'nginx' | 'steps'>('cloudflare');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  if (!isOpen) return null;

  const targetUrl = 'https://anish-tech.online/invoice';

  const htaccessContent = `<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /invoice/
  RewriteRule ^index\\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /invoice/index.html [L]
</IfModule>`;

  const nginxContent = `location /invoice/ {
    alias /var/www/html/anish-tech.online/invoice/;
    index index.html;
    try_files $uri $uri/ /invoice/index.html;
}`;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold">Publish to anish-tech.online/invoice</h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Build Ready
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Subpath-configured static build with relative asset links (`./assets/*`)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target URL banner */}
        <div className="bg-amber-50 border-b border-amber-200/60 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-amber-700 shrink-0" />
            <span className="text-xs text-slate-600">Target URL:</span>
            <code className="text-xs font-mono font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-200">
              {targetUrl}
            </code>
          </div>
          <a
            href={targetUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-1"
          >
            Visit URL <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('cpanel')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'cpanel'
                ? 'border-amber-600 text-amber-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" />
            cPanel / Hostinger / Apache
          </button>
          <button
            onClick={() => setActiveTab('nginx')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'nginx'
                ? 'border-amber-600 text-amber-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            Nginx / VPS
          </button>
          <button
            onClick={() => setActiveTab('steps')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'steps'
                ? 'border-amber-600 text-amber-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Verification Checklist
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {activeTab === 'cpanel' && (
            <div className="space-y-3 text-slate-600">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Build Files Ready in `dist/`</h4>
                  <p className="mt-1 text-slate-600 text-xs">
                    Vite has been pre-configured with <code className="bg-white px-1 py-0.5 rounded border text-emerald-800">base: './'</code> so all CSS, JS and fonts link relatively without breaking under the <code className="bg-white px-1 py-0.5 rounded border text-emerald-800">/invoice</code> sub-path.
                  </p>
                </div>
              </div>

              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                Quick 3-Step Deployment Guide for cPanel / File Manager:
              </h4>

              <ol className="space-y-2.5 list-decimal list-inside bg-slate-50 p-4 rounded-xl border border-slate-200">
                <li className="font-medium text-slate-800">
                  <span>Log in to your hosting control panel for <strong>anish-tech.online</strong> and open <strong>File Manager</strong>.</span>
                </li>
                <li className="font-medium text-slate-800">
                  <span>Navigate to your website root: <code className="bg-white px-1.5 py-0.5 rounded border text-slate-700 font-mono">public_html/</code></span>
                </li>
                <li className="font-medium text-slate-800">
                  <span>Create a new folder named <code className="bg-white px-1.5 py-0.5 rounded border text-amber-800 font-mono font-bold">invoice</code> (Path: <code className="bg-white px-1.5 py-0.5 rounded border text-slate-700 font-mono">public_html/invoice/</code>).</span>
                </li>
                <li className="font-medium text-slate-800">
                  <span>Upload the generated files from this project's <code className="bg-white px-1.5 py-0.5 rounded border text-amber-800 font-mono font-bold">dist/</code> folder into <code className="bg-white px-1.5 py-0.5 rounded border text-slate-700 font-mono">public_html/invoice/</code>:</span>
                  <ul className="list-disc list-inside pl-5 mt-1 text-slate-600 text-xs font-normal">
                    <li><code className="font-mono">index.html</code></li>
                    <li><code className="font-mono">assets/</code> (with the bundled JS and CSS)</li>
                    <li><code className="font-mono">.htaccess</code> (pre-configured for /invoice rewrite)</li>
                  </ul>
                </li>
              </ol>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-slate-700">Pre-generated .htaccess for /invoice/:</span>
                  <button
                    onClick={() => handleCopy(htaccessContent, 'htaccess')}
                    className="flex items-center gap-1 text-amber-700 hover:text-amber-800 font-semibold"
                  >
                    {copiedText === 'htaccess' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedText === 'htaccess' ? 'Copied' : 'Copy Code'}
                  </button>
                </div>
                <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg font-mono text-[11px] overflow-x-auto">
                  {htaccessContent}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'nginx' && (
            <div className="space-y-3">
              <p className="text-slate-600">
                If <strong>anish-tech.online</strong> is hosted on an Ubuntu/Debian VPS with Nginx, add this location block inside your Nginx server configuration block:
              </p>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-slate-700">Nginx Config (/etc/nginx/sites-available/anish-tech.online):</span>
                  <button
                    onClick={() => handleCopy(nginxContent, 'nginx')}
                    className="flex items-center gap-1 text-amber-700 hover:text-amber-800 font-semibold"
                  >
                    {copiedText === 'nginx' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedText === 'nginx' ? 'Copied' : 'Copy Config'}
                  </button>
                </div>
                <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg font-mono text-[11px] overflow-x-auto">
                  {nginxContent}
                </pre>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900">
                <strong>Reload command:</strong> <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-300">sudo nginx -t && sudo systemctl reload nginx</code>
              </div>
            </div>
          )}

          {activeTab === 'steps' && (
            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <strong className="text-slate-900">1. Relative Assets Configured</strong>
                    <p className="text-slate-500 text-[11px]">vite.config.ts has <code className="font-mono">base: './'</code> so files do not look for root /assets.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <strong className="text-slate-900">2. Offline Capable (PWA/Local Storage)</strong>
                    <p className="text-slate-500 text-[11px]">All companies, debtors, invoices, and stock items are locally persisted in browser storage.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <strong className="text-slate-900">3. Print & PDF Styling Ready</strong>
                    <p className="text-slate-500 text-[11px]">Invoices print cleanly on standard A4 paper with navigation hidden during Ctrl+P.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <strong className="text-slate-900">4. Ready to Export</strong>
                    <p className="text-slate-500 text-[11px]">You can export this project via <strong>Settings &rarr; Export to ZIP</strong> or copy the <code className="font-mono">dist/</code> folder directly.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-slate-500 text-[11px]">
            Ready for live deployment at <strong>anish-tech.online/invoice</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
