const imageInput = document.getElementById('image-input');
const urlInput = document.getElementById('url-input');
const generateQrBtn = document.getElementById('generate-qr-btn');
const outputCanvas = document.getElementById('output-canvas');
const downloadSection = document.getElementById('download-section');
const downloadBtn = document.getElementById('download-btn');
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

generateQrBtn.addEventListener('click', async () => {
    const url = urlInput.value;
    if (!url) {
        alert('URLを入力してください。');
        return;
    }
    
    if (!imageLoaded) {
        alert('画像を選択してください。');
        return;
    }

    try {
        await generateImageWithQRCode(url, image);
        console.log('QR code generated successfully');
    } catch (error) {
        console.error('Error generating QR code:', error);
        alert('QRコードの生成中にエラーが発生しました: ' + error.message);
    }
});

downloadBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'image-with-qr.png';
    link.href = outputCanvas.toDataURL('image/png');
    link.click();
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

    // QRコードのサイズを画像サイズに応じて調整（画像の10%、最小80px、最大150px）
    const qrSize = Math.max(80, Math.min(150, Math.floor(Math.min(canvasWidth, canvasHeight) * 0.1)));
    const qrPadding = Math.floor(qrSize * 0.1); // QRコードサイズの10%を余白に
    
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
    
    // 白い背景でQRコードを囲む（視認性向上のため）
    const bgPadding = 5;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(qrX - bgPadding, qrY - bgPadding, qrSize + bgPadding * 2, qrSize + bgPadding * 2);
    
    // QRコードを描画
    for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
            const isDark = qr.isDark(row, col);
            if (isDark) {
                ctx.fillStyle = '#000000';
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

    // キャンバスとダウンロードボタンを表示
    outputCanvas.style.display = 'block';
    outputCanvas.style.border = '2px solid #ddd';
    outputCanvas.style.marginTop = '20px';
    outputCanvas.style.maxWidth = '100%';
    outputCanvas.style.height = 'auto';
    
    if (downloadSection) {
        downloadSection.style.display = 'block';
    }
    
    console.log('Canvas and download button displayed');
}
