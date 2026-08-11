async function test() {
    try {
        console.log('Sending login request...');
        const response = await fetch('http://localhost:3000/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'facelook.cs51@gmail.com', password: 'admin' })
        });
        const data = await response.json();
        console.log('Response:', data);
    } catch (e) {
        console.error('Fetch error:', e);
    }
}
test();
