// Initialize pdf.js
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const statusContainer = document.getElementById('status-container');
const statusText = document.getElementById('status-text');
const outputContainer = document.getElementById('output-container');
const svgList = document.getElementById('svg-list');

// Drag and Drop handlers
dropZone.onclick = () => fileInput.click();

dropZone.ondragover = (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
};

dropZone.ondragleave = () => {
    dropZone.classList.remove('drag-over');
};

dropZone.ondrop = (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0) handleFile(files[0]);
};

fileInput.onchange = (e) => {
    if (e.target.files.length > 0) handleFile(e.target.files[0]);
};

async function handleFile(file) {
    if (file.type !== 'application/pdf') {
        alert('Please select a PDF file.');
        return;
    }

    // Reset UI
    svgList.innerHTML = '';
    dropZone.classList.add('hidden');
    statusContainer.classList.remove('hidden');
    outputContainer.classList.add('hidden');

    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        statusText.innerText = `Converting ${pdf.numPages} page(s)...`;

        for (let i = 1; i <= pdf.numPages; i++) {
            statusText.innerText = `Processing page ${i} of ${pdf.numPages}...`;
            const page = await pdf.getPage(i);
            
            // Use scale 1.5 for better quality in Figma
            const viewport = page.getViewport({ scale: 1.5 });

            // Render page to canvas
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            
            await page.render(renderContext).promise;

            // Create SVG with embedded canvas image
            const svg = createSvgFromCanvas(canvas, viewport);

            addSvgToResult(svg, i, file.name);
        }

        statusContainer.classList.add('hidden');
        outputContainer.classList.remove('hidden');
    } catch (error) {
        console.error('Error converting PDF:', error);
        alert('Failed to convert PDF. Check console for details.');
        statusContainer.classList.add('hidden');
        dropZone.classList.remove('hidden');
    }
}

function createSvgFromCanvas(canvas, viewport) {
    const svgNS = 'http://www.w3.org/2000/svg';
    
    // Convert canvas to data URL (PNG for best quality)
    const dataUrl = canvas.toDataURL('image/png');
    const imageId = 'pdf-image';
    
    // Create SVG string directly for better control
    const svgString = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     xmlns:xlink="http://www.w3.org/1999/xlink"
     version="1.1" 
     width="${viewport.width}" 
     height="${viewport.height}"
     viewBox="0 0 ${viewport.width} ${viewport.height}">
  <defs>
    <image id="${imageId}" width="${viewport.width}" height="${viewport.height}" xlink:href="${dataUrl}"/>
  </defs>
  <rect width="${viewport.width}" height="${viewport.height}" fill="white"/>
  <use href="#${imageId}"/>
</svg>`;
    
    // Parse SVG string to DOM element
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const svgElement = doc.documentElement;
    
    return svgElement;
}

function addSvgToResult(svg, pageNum, fileName) {
    const item = document.createElement('div');
    item.className = 'svg-item';

    const info = document.createElement('div');
    info.className = 'page-info';
    info.innerHTML = `<h3>Page ${pageNum}</h3><p>${fileName.replace('.pdf', '')}_page_${pageNum}.svg</p>`;

    const actions = document.createElement('div');
    actions.className = 'actions';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn btn-secondary';
    copyBtn.innerHTML = '<span>Copy SVG</span>';
    copyBtn.onclick = () => copyToClipboard(svg.outerHTML, copyBtn);

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'btn btn-primary';
    downloadBtn.innerHTML = '<span>Download</span>';
    downloadBtn.onclick = () => downloadFile(svg.outerHTML, `${fileName.replace('.pdf', '')}_page_${pageNum}.svg`);

    actions.appendChild(copyBtn);
    actions.appendChild(downloadBtn);
    item.appendChild(info);
    item.appendChild(actions);
    svgList.appendChild(item);
}

function downloadFile(content, fileName) {
    const blob = new Blob([content], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function copyToClipboard(text, btn) {
    try {
        await navigator.clipboard.writeText(text);
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span>Copied!</span>';
        btn.classList.add('btn-success'); // You can add this style if you want
        setTimeout(() => {
            btn.innerHTML = originalText;
        }, 2000);
    } catch (err) {
        alert('Failed to copy to clipboard');
    }
}
