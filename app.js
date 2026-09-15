const imageInput = document.getElementById('image-input');
const urlInput = document.getElementById('url-input');
const clearUrlBtn = document.getElementById('clear-url-btn');

clearUrlBtn.addEventListener('click', () => {
    urlInput.value = '';
    urlInput.focus();
});

const generateQrBtn = document.getElementById('generate-qr-btn');
const outputCanvas = document.getElementById('output-canvas');
const outputImage = document.getElementById('output-image');
const saveHint = document.getElementById('save-hint');
const downloadSection = document.getElementById('download-section');
const downloadBtn = document.getElementById('download-btn');
const qrColorInput = document.getElementById('qr-color');
const autoColorBtn = document.getElementById('auto-color-btn');
const colorWarning = document.getElementById('color-warning');
const ctx = outputCanvas.getContext('2d');

let image = new Image();
let imageLoaded = false;

imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        image.onload = () => {
            imageLoaded = true;
            console.log('Image loaded successfully');
        };
        image.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

// 白背景(#ffffff)に対する相対輝度・コントラスト比を計算し、読み取りやすさの目安をチェックする
function getRelativeLuminance(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const toLinear = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function getContrastRatioWithWhite(hex) {
    const luminance = getRelativeLuminance(hex);
    return (1.0 + 0.05) / (luminance + 0.05);
}

function checkColorContrast() {
    const contrast = getContrastRatioWithWhite(qrColorInput.value);
    // 画像データを直接デコードする用途を想定し、コントラスト比3.0未満で警告する
    colorWarning.style.display = contrast < 3.0 ? 'block' : 'none';
}

qrColorInput.addEventListener('input', checkColorContrast);

// 画像の平均的な色を抽出し、白背景でも読み取れるよう十分に暗く調整してから提案する
autoColorBtn.addEventListener('click', () => {
    if (!imageLoaded) {
        alert('Please select an image first.');
        return;
    }

    const sampleCanvas = document.createElement('canvas');
    const sampleSize = 100; // 処理を軽くするため縮小してサンプリング
    sampleCanvas.width = sampleSize;
    sampleCanvas.height = sampleSize;
    const sampleCtx = sampleCanvas.getContext('2d');
    sampleCtx.drawImage(image, 0, 0, sampleSize, sampleSize);

    const { data } = sampleCtx.getImageData(0, 0, sampleSize, sampleSize);
    let r = 0, g = 0, b = 0;
    const pixelCount = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
    }
    r = Math.round(r / pixelCount);
    g = Math.round(g / pixelCount);
    b = Math.round(b / pixelCount);

    // 白背景とのコントラスト比が十分になるまで、色を段階的に暗くする
    let scale = 1.0;
    let hex = rgbToHex(r, g, b);
    while (getContrastRatioWithWhite(hex) < 3.0 && scale > 0.05) {
        scale -= 0.05;
        hex = rgbToHex(Math.round(r * scale), Math.round(g * scale), Math.round(b * scale));
    }

    qrColorInput.value = hex;
    checkColorContrast();
});

function rgbToHex(r, g, b) {
    const toHex = (c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

generateQrBtn.addEventListener('click', async () => {
    const url = urlInput.value;
    if (!url) {
        alert('Please enter a URL.');
        return;
    }
    
    if (!imageLoaded) {
        alert('Please select an image.');
        return;
    }

    try {
        await generateImageWithQRCode(url, image);
        console.log('QR code generated successfully');
    } catch (error) {
        console.error('Error generating QR code:', error);
        alert('An error occured while generating the QR code.: ' + error.message);
    }
});

// タッチ操作可能なデバイス（スマホなど）かどうかを判定
// canShareの有無だけではPCブラウザも対応してしまうことがあるため、pointer:coarseで判定する
function isTouchDevice() {
    return window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
}

// 「Save Image」ボタン：
// - PC（マウス操作）: 常にファイルとして直接ダウンロード
// - スマホ（タッチ操作）: 共有シートを開く（「イメージを保存」を選ぶと写真フォルダに保存される）
downloadBtn.addEventListener('click', () => {
    outputCanvas.toBlob(async (blob) => {
        if (!blob) {
            alert('Failed to generate the image. Please try again.');
            return;
        }

        const file = new File([blob], 'image-with-qr.png', { type: 'image/png' });

        if (isTouchDevice() && navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: 'Image with a QR code',
                });
                return;
            } catch (err) {
                if (err.name === 'AbortError') {
                    return;
                }
                console.warn('Share failed, falling back to normal download:', err);
            }
        }

        // PC、または共有APIが使えない/失敗した場合は通常のダウンロード
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = 'image-with-qr.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }, 'image/png');
});

async function generateImageWithQRCode(url, image) {
    // キャンバスのサイズを元の画像サイズに合わせる
    const canvasWidth = image.width;
    const canvasHeight = image.height;
    
    outputCanvas.width = canvasWidth;
    outputCanvas.height = canvasHeight;

    // 画像を元のサイズで描画（余白なし）
    ctx.drawImage(image, 0, 0, canvasWidth, canvasHeight);
    
    console.log('Image drawn on canvas');

    // QRコードのサイズを画像サイズに応じて調整（短辺の8%で常に一定の比率にする）
    const qrSize = Math.floor(Math.min(canvasWidth, canvasHeight) * 0.08);
    const qrPadding = Math.floor(qrSize * 0.08); // QRコードサイズに応じた余白
    
    // 画像の右下にQRコードを配置
    const qrX = canvasWidth - qrSize - qrPadding;
    const qrY = canvasHeight - qrSize - qrPadding;

    // QRコードを生成（qrcode-generatorライブラリを使用）
    const typeNumber = 0; // 自動サイズ調整
    const errorCorrectionLevel = 'H'; // 高エラー訂正レベル
    const qr = qrcode(typeNumber, errorCorrectionLevel);
    qr.addData(url);
    qr.make();
    
    console.log('QR code data generated');
    
    // QRコードのモジュール数を取得
    const moduleCount = qr.getModuleCount();
    const cellSize = qrSize / moduleCount;
    
<<<<<<< Updated upstream
   // 背景は完全な単色ではなく、半透明の白を重ねる方式にする
=======
    // 背景は完全な単色ではなく、半透明の白を重ねる方式にする
>>>>>>> Stashed changes
    // → 下にある画像の色がうっすら透けて見えるため、周囲の色に自然に馴染みつつ、
    //   白が支配的な配色を保つことでQRコードとしての標準的な見た目（明るい背景+暗いモジュール）を維持する
    const bgPadding = Math.floor(qrSize * 0.05);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(qrX - bgPadding, qrY - bgPadding, qrSize + bgPadding * 2, qrSize + bgPadding * 2);
    
    // QRコードを描画（選択された色を使用）
    const qrColor = qrColorInput.value || '#000000';
    for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
            const isDark = qr.isDark(row, col);
            if (isDark) {
                ctx.fillStyle = qrColor;
                ctx.fillRect(
                    qrX + col * cellSize,
                    qrY + row * cellSize,
                    cellSize,
                    cellSize
                );
            }
        }
    }
    
    console.log('QR code drawn on canvas');

    // 結果をimg要素にも表示する（長押しで「写真に追加」できるようにするため）
    // canvasは長押しでの保存に対応していないブラウザがあるが、imgならOS標準の長押しメニューが使える
    const dataUrl = outputCanvas.toDataURL('image/png');
    outputImage.src = dataUrl;
    outputImage.style.display = 'block';
    outputImage.style.border = '2px solid #ddd';
    outputImage.style.marginTop = '20px';
    outputImage.style.maxWidth = '100%';
    outputImage.style.height = 'auto';

    if (saveHint) {
        saveHint.style.display = 'block';
    }

    if (downloadSection) {
        downloadSection.style.display = 'block';
    }

    console.log('Image and download button displayed');
}
