const fs = require('fs');
const html = fs.readFileSync('index.html.html', 'utf-8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/g);
if (scriptMatch) {
    let combinedScript = scriptMatch.map(s => s.replace(/<script>|<\/script>/g, '')).join('\n');
    fs.writeFileSync('extracted.js', combinedScript);
    console.log('Extracted JS to extracted.js');
} else {
    console.log('No script found');
}
