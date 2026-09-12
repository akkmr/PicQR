const imageInput = document.getElementById('image-input');
const urlInput = document.getElementById('url-input');
const generateQrBtn = document.getElementById('generate-qr-btn');
const outputCanvas = document.getElementById('output-canvas');
const outputImage = document.getElementById('output-image');
const saveHint = document.getElementById('save-hint');
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
    outputCanvas.toBlob(async (blob) => {
        if (!blob) {
            alert('画像の生成に失敗しました。もう一度お試しください。');
            return;
        }

        const file = new File([blob], 'image-with-qr.png', { type: 'image/png' });

        // スマホなど、ファイル共有に対応している場合は共有シートを開く
        // （ここから「イメージを保存」「フォトに保存」などを選ぶと写真アプリに直接保存できる）
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: 'QRコード付き画像',
                });
                return;
            } catch (err) {
                // ユーザーが共有をキャンセルした場合は何もしない
                if (err.name === 'AbortError') {
                    return;
                }
                console.warn('共有に失敗したため、通常のダウンロードを行います:', err);
            }
        }

        // 共有APIが使えないPCブラウザなどは、従来通りファイルとしてダウンロード
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

    // QRコードの1辺を「画像の短い辺の1/4」に設定
    const qrSize = Math.floor(Math.min(canvasWidth, canvasHeight) / 4);
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
    
    // 白い背景でQRコードを囲む（視認性向上のため。QRサイズに応じて余白も調整）
    const bgPadding = Math.max(8, Math.floor(qrSize * 0.05));
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
