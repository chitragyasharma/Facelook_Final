const fs = require('fs');
const html = fs.readFileSync('client/admin.html', 'utf8');
const scriptMatch = html.match(/<script>(.*?)<\/script>/s);
if (scriptMatch) {
    try {
        new Function(scriptMatch[1]);
        console.log('Valid JS in script tag');
    } catch(e) {
        console.error('Syntax error in script tag:', e);
    }
}
