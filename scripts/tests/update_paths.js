const fs = require('fs');
const path = require('path');

const indexFile = path.join(__dirname, '../../index.html.html');
let html = fs.readFileSync(indexFile, 'utf8');

const images = [
    'facelook_update_final-Photoroom.png',
    'bestseller_makeup.png',
    'new_arrivals_makeup.png',
    'lips_makeup.png',
    'eyes_makeup.png',
    'face_makeup.png',
    'nails_makeup.png'
];

images.forEach(img => {
    const regex = new RegExp(`src="${img}"`, 'g');
    html = html.replace(regex, `src="assets/images/${img}"`);
});

fs.writeFileSync(indexFile, html);

const swFile = path.join(__dirname, '../../sw.js');
if (fs.existsSync(swFile)) {
    let sw = fs.readFileSync(swFile, 'utf8');
    sw = sw.replace("'/facelook_update_final-Photoroom.png'", "'/assets/images/facelook_update_final-Photoroom.png'");
    fs.writeFileSync(swFile, sw);
}

console.log('Updated paths successfully.');
