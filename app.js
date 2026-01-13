import { h, render } from 'https://esm.sh/preact';
import { useState, useEffect, useRef } from 'https://esm.sh/preact/hooks';
import htm from 'https://esm.sh/htm';
import { detectHalalStatus } from './halal-data.js';
import { initBarcodeScanner, lookupBarcode, compressImage } from './scan-logic.js';

const html = htm.bind(h);

function App() {
  const [view, setView] = useState('home'); // home, scanning, results
  const [scanMode, setScanMode] = useState(null); // barcode, ingredients
  const [scannedResult, setScannedResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'system');

  const scannerRef = useRef(null);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : (prev === 'dark' ? 'system' : 'light'));
  };

  const getThemeIcon = () => {
    if (theme === 'light') return '☀️';
    if (theme === 'dark') return '🌙';
    return '🌓';
  };

  const startScanning = (mode) => {
    setView('scanning');
    setScanMode(mode);
    setErrorMessage(null);
  };

  const goHome = async () => {
    if (scannerRef.current) {
      try {
        await Promise.race([
          scannerRef.current.stop(),
          new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 2000))
        ]).catch(console.warn);
      } catch (err) {
        console.warn("Scanner stop failed", err);
      }
      scannerRef.current = null;
    }

    setView('home');
    setScannedResult(null);
    setScanMode(null);
    setLoading(false);
  };

  useEffect(() => {
    if (view === 'scanning' && scanMode === 'barcode') {
      initBarcodeScanner('reader', async (barcode) => {
        setLoading(true);
        const product = await lookupBarcode(barcode);
        if (product) {
          const status = detectHalalStatus(product.ingredients);
          setScannedResult({
            ...status,
            productName: product.productName,
            image: product.image
          });
          setView('results');
        } else {
          setErrorMessage("Product not found in database. Please try scanning the ingredient list directly.");
          setView('home');
        }
        setLoading(false);
      }).then(scanner => {
        scannerRef.current = scanner;
      }).catch(err => {
        setErrorMessage("Could not access camera. Please check permissions.");
        setView('home');
      });
    }
  }, [view, scanMode]);

  const workerRef = useRef(null);

  const initWorker = async () => {
    if (workerRef.current) return workerRef.current;
    if (typeof Tesseract === 'undefined') {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://unpkg.com/tesseract.js@v5.0.0/dist/tesseract.min.js';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    const worker = await Tesseract.createWorker('jpn+eng');
    workerRef.current = worker;
    return worker;
  };

  const handleManualOCR = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setView('results');
    setScannedResult({ productName: 'Analyzing label...', status: 'PENDING', matches: [] });

    try {
      const compressedBlob = await compressImage(file);
      const worker = await initWorker();
      setScannedResult({ productName: 'Reading Japanese text...', status: 'PENDING', matches: [] });
      const { data: { text } } = await worker.recognize(compressedBlob);
      const status = detectHalalStatus(text);
      setScannedResult({
        ...status,
        productName: 'Ingredient Analysis Result'
      });
    } catch (err) {
      console.error(err);
      setErrorMessage("Analysis failed. Ensure the text is clear.");
      setView('home');
    }
    setLoading(false);
  };

  return html`
    <div class="fade-in">
      <header class="header">
        <button class="theme-toggle" onClick=${toggleTheme} title="Switch Theme">
          ${getThemeIcon()}
        </button>
        <h1>Halal Scanner Japan</h1>
        <p>Expert safety for Japanese Muslims</p>
      </header>

      <main class="container">
        ${loading && html`
          <div class="card" style="text-align: center; border-bottom: 4px solid var(--info);">
            <div style="display: flex; justify-content: center; margin-bottom: 12px;">
              <div class="spinner"></div>
            </div>
            <p style="font-weight: 600;">Analyzing ingredients...</p>
            <p style="font-size: 13px; color: var(--text-secondary);">Comparing JHF standards</p>
          </div>
        `}

        ${errorMessage && html`
          <div class="card" style="background: rgba(255, 59, 48, 0.1); color: var(--danger); border-color: var(--danger); position: relative; padding-right: 44px;">
            <div style="display: flex; gap: 12px; align-items: flex-start;">
              <span style="font-size: 20px;">⚠️</span>
              <div>
                <p style="font-weight: 600;">Issue detected</p>
                <p style="font-size: 14px; opacity: 0.9;">${errorMessage}</p>
              </div>
            </div>
            <button 
              onClick=${() => setErrorMessage(null)}
              style="position: absolute; top: 12px; right: 12px; background: none; border: none; font-size: 20px; color: var(--danger); cursor: pointer; padding: 4px;">
              ✕
            </button>
          </div>
        `}

        ${view === 'home' && !loading && html`
          <div class="fade-in">
            <div class="card">
              <h2 style="margin-bottom: 20px; font-size: 18px; font-weight: 600;">Scan Options</h2>
              
              <button class="btn btn-primary" onClick=${() => startScanning('barcode')} style="margin-bottom: 12px; background: var(--primary);">
                <span style="font-size: 24px;">📸</span> 
                <div style="text-align: left;">
                  <div style="font-size: 16px;">Scan Barcode</div>
                  <div style="font-size: 12px; font-weight: 400; opacity: 0.85;">Detect product via JAN code</div>
                </div>
              </button>
              
              <div style="position: relative;">
                <button class="btn btn-primary" style="background: var(--info);">
                  <span style="font-size: 24px;">📝</span>
                  <div style="text-align: left;">
                    <div style="font-size: 16px;">Scan Ingredients</div>
                    <div style="font-size: 12px; font-weight: 400; opacity: 0.85;">OCR for direct label analysis</div>
                  </div>
                </button>
                <input type="file" accept="image/*" capture="environment" 
                       onChange=${handleManualOCR}
                       style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer;" />
              </div>
            </div>
            
            <div class="card" style="background: rgba(52, 199, 89, 0.1); border-color: var(--primary);">
              <div style="display: flex; gap: 16px;">
                <div style="font-size: 28px;">🕌</div>
                <div>
                  <h3 style="font-size: 16px; color: var(--primary); margin-bottom: 4px; font-weight: 600;">Japan Resident Focused</h3>
                  <p style="font-size: 14px; color: var(--text-secondary);">
                    Specialized detection for emulsifiers, shortening, and alcohol types common in Japanese markets.
                  </p>
                </div>
              </div>
            </div>
          </div>
        `}

        ${view === 'scanning' && html`
          <div class="fade-in">
            <div class="scanner-container" id="reader">
              <div style="color: white; padding: 60px 40px; text-align: center;">
                <div class="spinner" style="margin: 0 auto 20px;"></div>
                Starting camera...
              </div>
            </div>
            <button class="btn" onClick=${goHome} style="background: var(--card-bg); color: var(--text-primary); border: 1px solid var(--border);">
              Take me back
            </button>
          </div>
        `}

        ${view === 'results' && scannedResult && html`
          <div class="fade-in">
            <div class="card" style="text-align: center; border-top: 10px solid ${scannedResult.status === 'HARAM' ? 'var(--danger)' :
        (scannedResult.status === 'SYUBHAT' ? 'var(--warning)' :
          (scannedResult.status === 'PENDING' ? 'var(--info)' : 'var(--primary)'))};">
              <div style="font-size: 72px; margin-bottom: 16px;">
                ${scannedResult.status === 'HARAM' ? '❌' :
        (scannedResult.status === 'SYUBHAT' ? '⚠️' :
          (scannedResult.status === 'PENDING' ? '⏳' : '✅'))}
              </div>
              
              <h2 style="font-size: 26px; font-weight: 700; margin-bottom: 8px;">
                ${scannedResult.status === 'HARAM' ? 'Haram Detected' :
        (scannedResult.status === 'SYUBHAT' ? 'Syubhat (Doubtful)' :
          (scannedResult.status === 'PENDING' ? 'Processing...' : 'Likely Halal'))}
              </h2>
              
              <p style="color: var(--text-secondary); margin-bottom: 24px; font-size: 15px;">
                ${scannedResult.productName || 'Analysis Result'}
              </p>

              ${scannedResult.status === 'PENDING' ? html`
                <div style="padding: 24px;">
                  <div style="display: flex; justify-content: center; margin-bottom: 16px;">
                    <div class="spinner" style="width: 32px; height: 32px;"></div>
                  </div>
                  <p style="font-size: 14px; color: var(--text-secondary);">Analyzing ingredients text...</p>
                </div>
              ` : html`
                ${scannedResult.matches.length > 0 ? html`
                  <div style="text-align: left; background: var(--bg-color); padding: 16px; border-radius: var(--radius); border: 1px solid var(--border);">
                    <h3 style="font-size: 13px; margin-bottom: 12px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Restricted Ingredients:</h3>
                    <ul style="list-style: none;">
                      ${scannedResult.matches.map(m => html`
                        <li style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                          <div>
                            <div style="font-weight: 600; font-size: 16px; color: ${m.type === 'HARAM' ? 'var(--danger)' : '#d4ac0d'};">${m.name}</div>
                            <div style="font-size: 13px; color: var(--text-secondary);">${m.translation}</div>
                          </div>
                          <span class="status-badge" style="background: ${m.type === 'HARAM' ? 'rgba(255, 59, 48, 0.1)' : 'rgba(255, 204, 0, 0.1)'}; color: ${m.type === 'HARAM' ? 'var(--danger)' : '#9a7d0a'};">
                            ${m.type}
                          </span>
                        </li>
                      `)}
                    </ul>
                  </div>
                ` : html`
                  <div style="background: rgba(52, 199, 89, 0.1); padding: 20px; border-radius: var(--radius); color: var(--primary); font-size: 15px; font-weight: 500; border: 1px solid var(--primary);">
                    No restricted ingredients found.
                  </div>
                `}
              `}
            </div>
            
            <button class="btn btn-primary" onClick=${goHome} style="margin-top: 8px; background: var(--primary);">
              Done
            </button>
          </div>
        `}
      </main>

      <footer>
        <p>© 2026 Halal Scan Japan</p>
        <p style="margin-top: 4px; opacity: 0.8;">In accordance with JHF Standards</p>
      </footer>
    </div>
  `;
}

render(html`<${App} />`, document.getElementById('app'));
