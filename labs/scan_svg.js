import fs from 'fs';

function scanSvg(filePath) {
    console.log(`\n================ SCANNING: ${filePath} ================`);
    const svgContent = fs.readFileSync(filePath, 'utf8');

    // Matches any <text> or <tspan> start tag and captures its inner text up to the next tag
    const tagRegex = /<(text|tspan)\s+([^>]*?)>([^<]*)/g;
    let match;
    let index = 0;
    let totalElements = 0;
    let spaceXElements = 0;

    while ((match = tagRegex.exec(svgContent)) !== null) {
        index++;
        const tagName = match[1];
        const attrsString = match[2];
        const textContent = match[3].trim();

        // Parse attributes
        const getAttr = (name) => {
            const attrRegex = new RegExp(`${name}="([^"]*?)"`);
            const m = attrRegex.exec(attrsString);
            return m ? m[1] : null;
        };

        const xAttr = getAttr('x');
        const yAttr = getAttr('y');
        const fontFamily = getAttr('font-family') || '';

        if (!xAttr) continue;

        totalElements++;
        const xCoords = xAttr.trim().split(/\s+/).map(Number);
        
        if (xCoords.length > 1) {
            spaceXElements++;
            
            // Decode basic entities in content for display
            const decodedContent = textContent
                .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
                .replace(/&#([0-9]+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&');

            console.log(`\n[Element #${index}] <${tagName}> font-family="${fontFamily}" y="${yAttr}"`);
            console.log(`Content: "${decodedContent}" (${decodedContent.length} chars)`);
            console.log(`Coordinates: ${xCoords.length} values`);
            
            const steps = [];
            for (let i = 1; i < xCoords.length; i++) {
                const step = xCoords[i] - xCoords[i - 1];
                steps.push(step.toFixed(3));
            }
            
            // Format character-by-character step mapping
            const mapping = [];
            for (let i = 0; i < decodedContent.length; i++) {
                const char = decodedContent[i];
                const xVal = xCoords[i] !== undefined ? xCoords[i].toFixed(3) : 'N/A';
                const stepVal = i > 0 ? steps[i - 1] : 'start';
                mapping.push(`'${char}' (x: ${xVal}, step from prev: ${stepVal})`);
            }
            console.log("Steps Mapping:\n  " + mapping.join('\n  '));
        }
    }

    console.log(`\nSummary: Found ${totalElements} positioned elements, ${spaceXElements} with multiple x-coordinates.`);
}

scanSvg('.examples/中台設定檔 - 登機證QRCode(國內)_page_1.svg');
scanSvg('.examples/中台設定檔 - 登機證QRCode(國際或兩岸)_page_1.svg');
