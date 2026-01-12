/**
 * Scan Logic - Hardware and API integration
 */

// Load external dependencies from CDN
const HTML5_QRCODE_URL = 'https://unpkg.com/html5-qrcode';
const TESSERACT_URL = 'https://unpkg.com/tesseract.js@v5.0.0/dist/tesseract.min.js';

export async function initBarcodeScanner(elementId, onScan) {
    if (typeof Html5Qrcode === 'undefined') {
        await loadScript(HTML5_QRCODE_URL);
    }

    const html5QrCode = new Html5Qrcode(elementId);

    // Use a square qrbox for better mobile visual alignment
    const config = {
        fps: 20,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
    };

    try {
        await html5QrCode.start(
            { facingMode: "environment" },
            config,
            async (decodedText) => {
                // stop() returns a promise, but we can call it and proceed
                html5QrCode.stop().catch(console.error);
                onScan(decodedText);
            },
            () => { } // Ignore errors
        );
        return html5QrCode;
    } catch (err) {
        console.error("Camera access failed", err);
        throw err;
    }
}

export async function lookupBarcode(barcode) {
    const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.status === 1) {
            return {
                productName: data.product.product_name || data.product.product_name_en || 'Unknown Product',
                ingredients: data.product.ingredients_text || data.product.ingredients_text_ja || '',
                image: data.product.image_url
            };
        }
        return null;
    } catch (err) {
        console.error("OpenFoodFacts API error", err);
        return null;
    }
}

export async function initOCRScanner(videoElement, onResult) {
    if (typeof Tesseract === 'undefined') {
        await loadScript(TESSERACT_URL);
    }

    // Note: For a "light" app, we use Tesseract's basic worker
    // In a real mobile app, we might use a canvas to capture frames
    const worker = await Tesseract.createWorker('jpn+eng');

    return {
        scanFrame: async (canvasElement) => {
            const { data: { text } } = await worker.recognize(canvasElement);
            onResult(text);
        },
        terminate: () => worker.terminate()
    };
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}
