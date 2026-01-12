import { h, render } from 'https://esm.sh/preact';
import { useState, useEffect, useRef } from 'https://esm.sh/preact/hooks';
import htm from 'https://esm.sh/htm';
import { detectHalalStatus } from './halal-data.js';
import { initBarcodeScanner, lookupBarcode } from './scan-logic.js';

const html = htm.bind(h);

function App() {
    const [view, setView] = useState('home'); // home, scanning, results
    const [scanMode, setScanMode] = useState(null); // barcode, ingredients
    const [scannedResult, setScannedResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);

    const scannerRef = useRef(null);

    const startScanning = (mode) => {
        setView('scanning');
        setScanMode(mode);
        setErrorMessage(null);
    };

    const goHome = async () => {
        if (scannerRef.current) {
            try {
                // Ensure we don't hang if stop() takes too long on iOS
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

    const handleManualOCR = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);
        setView('results');
        setScannedResult({ productName: 'Analyzing Japanese ingredients...', status: 'PENDING', matches: [] });

        try {
            // Load Tesseract via CDN if not present
            if (typeof Tesseract === 'undefined') {
                await new Promise((resolve, reject) => {
                    const s = document.createElement('script');
                    s.src = 'https://unpkg.com/tesseract.js@v5.0.0/dist/tesseract.min.js';
                    s.onload = resolve;
                    s.onerror = reject;
                    document.head.appendChild(s);
                });
            }

            // Initialize worker for Japanese + English
            const worker = await Tesseract.createWorker('jpn+eng');
            const { data: { text } } = await worker.recognize(file);
            await worker.terminate();

            const status = detectHalalStatus(text);
            setScannedResult({
                ...status,
                productName: 'Ingredient Analysis Result'
            });
        } catch (err) {
            console.error(err);
            setErrorMessage("Photo analysis failed. Ensure the text is clear.");
            setView('home');
        }
        setLoading(false);
    };

    return html`
    <div class="fade-in">
      <header class="header">
        <h1>Halal Scan JP</h1>
        <p>Expert safety for Muslim residents</p>
      </header>

      <main class="container">
        ${loading && html`
          <div class="card" style="text-align: center; border-bottom: 4px solid var(--primary);">
            <div style="font-size: 32px; margin-bottom: 10px; animation: bounce 1s infinite;">🔍</div>
            <p style="font-weight: 600;">Analyzing ingredients...</p>
            <p style="font-size: 12px; color: #666;">Comparing against JHF standards</p>
          </div>
        `}

        ${errorMessage && html`
          <div class="card" style="background: #fff5f5; color: #c53030; border: 1px solid #feb2b2;">
            <div style="display: flex; gap: 10px; align-items: center;">
              <span>⚠️</span>
              <div>
                <p style="font-weight: 600;">Issue detected</p>
                <p style="font-size: 13px;">${errorMessage}</p>
              </div>
            </div>
          </div>
        `}

        ${view === 'home' && !loading && html`
          <div class="fade-in">
            <div class="card">
              <h2 style="margin-bottom: 20px; font-size: 20px;">Scan Options</h2>
              
              <button class="btn btn-primary" onClick=${() => startScanning('barcode')} style="margin-bottom: 12px;">
                <span style="font-size: 20px;">📸</span> 
                <div style="text-align: left;">
                  <div style="font-size: 16px;">Scan Barcode</div>
                  <div style="font-size: 11px; font-weight: 400; opacity: 0.9;">Fast lookup via JAN code</div>
                </div>
              </button>
              
              <div style="position: relative;">
                <button class="btn btn-primary" style="background: #3498db;">
                  <span style="font-size: 20px;">📝</span>
                  <div style="text-align: left;">
                    <div style="font-size: 16px;">Scan Ingredients</div>
                    <div style="font-size: 11px; font-weight: 400; opacity: 0.9;">Direct Japanese label OCR</div>
                  </div>
                </button>
                <input type="file" accept="image/*" capture="environment" 
                       onChange=${handleManualOCR}
                       style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer;" />
              </div>
            </div>
            
            <div class="card" style="background: #e9f7ef; border-color: #d4efdf;">
              <div style="display: flex; gap: 15px;">
                <div style="font-size: 24px;">🕌</div>
                <div>
                  <h3 style="font-size: 15px; color: #1e8449; margin-bottom: 4px;">Resident Focused</h3>
                  <p style="font-size: 13px; color: #444;">
                    We analyze common doubtful ingredients like "Shortening" and "Emulsifiers" specifically for the Japanese market.
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
            <button class="btn" onClick=${goHome} style="background: #eee; color: #333;">
              Take me back
            </button>
          </div>
        `}

        ${view === 'results' && scannedResult && html`
          <div class="fade-in">
            <div class="card" style="text-align: center; border-top: 10px solid ${scannedResult.status === 'HARAM' ? '#e74c3c' : (scannedResult.status === 'SYUBHAT' ? '#f1c40f' : '#2ecc71')};">
              <div style="font-size: 64px; margin-bottom: 10px;">
                ${scannedResult.status === 'HARAM' ? '❌' : (scannedResult.status === 'SYUBHAT' ? '⚠️' : '✅')}
              </div>
              <h2 style="font-size: 26px; margin-bottom: 5px;">
                ${scannedResult.status === 'HARAM' ? 'Haram Detected' : (scannedResult.status === 'SYUBHAT' ? 'Syubhat (Doubtful)' : 'Likely Halal')}
              </h2>
              <p style="color: #666; margin-bottom: 25px; font-size: 14px;">
                ${scannedResult.productName || 'Analysis Result'}
              </p>

              ${scannedResult.matches.length > 0 ? html`
                <div style="text-align: left; background: #fdfefe; padding: 20px; border-radius: 12px; border: 1px solid #eee;">
                  <h3 style="font-size: 14px; margin-bottom: 12px; color: #2c3e50; text-transform: uppercase; letter-spacing: 1px;">Ingredients found:</h3>
                  <ul style="list-style: none;">
                    ${scannedResult.matches.map(m => html`
                      <li style="margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                          <div style="font-weight: 600; font-size: 15px; color: ${m.type === 'HARAM' ? '#e74c3c' : '#d4ac0d'};">${m.name}</div>
                          <div style="font-size: 12px; color: #7f8c8d;">${m.translation}</div>
                        </div>
                        <div style="font-size: 10px; padding: 4px 8px; border-radius: 20px; background: ${m.type === 'HARAM' ? '#fdecea' : '#fef9e7'}; color: ${m.type === 'HARAM' ? '#e74c3c' : '#9a7d0a'}; font-weight: 700;">
                          ${m.type}
                        </div>
                      </li>
                    `)}
                  </ul>
                </div>
              ` : html`
                <div style="background: #e9f7ef; padding: 15px; border-radius: 12px; color: #1e8449; font-size: 14px;">
                  No restricted ingredients found in the scanned text.
                </div>
              `}
            </div>
            
            <button class="btn btn-primary" onClick=${goHome}>
              Scan Another Product
            </button>
          </div>
        `}
      </main>

      <footer style="padding: 30px 20px; text-align: center; opacity: 0.5; font-size: 11px;">
        <p>© 2026 Halal Scan JP - Building for the Community</p>
        <p style="margin-top: 5px;">Data provided by Open Food Facts & JHF Guidelines</p>
      </footer>
    </div>
  `;
}

render(html`<${App} />`, document.getElementById('app'));
