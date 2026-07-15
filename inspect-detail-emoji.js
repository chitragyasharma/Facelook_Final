const fs = require('fs');
const content = fs.readFileSync('index.html.html', 'utf8');
const lines = content.split('\n');
const idx = lines.findIndex(line => line.includes('id="detail-emoji"'));
if (idx !== -1) {
    for (let i = idx - 10; i <= idx + 10; i++) {
        console.log(`${i + 1}: ${lines[i]}`);
    }
} else {
    console.log("Not found");
}
