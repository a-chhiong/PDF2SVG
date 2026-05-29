// Import custom Vanilla Web Components to self-register them in the DOM custom registry
import './components/file-drop-zone.js';
import './components/conversion-progress.js';
import './components/svg-viewer.js';
import './components/app-root.js';

// Configure pdf.js global options for 3.11.174
const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;

// 1. Worker source configuration (runs pdf.js rendering operators parsing in parallel web worker threads)
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';



console.log("PDF2SVG Webapp successfully bootstrapped in Build-Agnostic mode.");
