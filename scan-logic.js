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

    const config = {
        fps: 20, // Slightly lower FPS can sometimes help detection stability on mobile
        qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
            const size = Math.floor(minEdgeSize * 0.7);
            return { width: size, height: size };
        },
        // Request specific resolution to help with barcode clarity
        videoConstraints: {
            facingMode: "environment",
            width: { min: 640, ideal: 1280, max: 1920 },
            height: { min: 480, ideal: 720, max: 1080 }
        }
    };

    try {
        await html5QrCode.start(
            { facingMode: "environment" },
            config,
            async (decodedText) => {
                try {
                    await html5QrCode.stop();
                } catch (e) { console.warn(e); }
                onScan(decodedText);
            },
            () => { }
        );
        return html5QrCode;
    } catch (err) {
        console.error("Camera access failed", err);
        throw err;
    }
}

/**
 * Compresses an image file before OCR processing
 */
export async function compressImage(file, maxWidth = 1200) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/jpeg', 0.8); // 80% quality is plenty for OCR
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
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
