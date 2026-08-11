const fs = require('fs');
const html = fs.readFileSync('/Users/chitragyasharma/Documents/Facelook/index.html.html', 'utf8');
const p = {
  "id":3,
  "name":"COVER ME",
  "palette":[{"name":"Unnamed","hex":""},{"name":"Natural","hex":"#F4E2D5"},{"name":"Natural","hex":"#000000"},{"name":"Unnamed","hex":""}]
};

let palDotsHTML = p.palette.map((item, idx) => {
  let bg = item.hex ? `background-color:${item.hex};` : (item.image ? `background:url('${item.image}') center/cover;` : `background-color:#ccc;`);
  let titleAttr = item.name ? `title="${item.name.replace(/"/g, '&quot;')}"` : '';
  return `<div class="shade-dot ${idx === 0 ? 'active' : ''}" style="${bg}" ${titleAttr} onclick="selectPaletteShade(${idx}, ${p.id})"></div>`;
}).join('');

console.log(palDotsHTML);
