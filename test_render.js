async function test() {
    const email = `test${Date.now()}@example.com`;
    const password = 'password123';
    
    console.log("Registering:", email);
    const regRes = await fetch('https://facelook-backend.onrender.com/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test User', email, password })
    });
    const regData = await regRes.json();
    console.log("Register response:", regData);
    
    if (!regData.token) return;
    
    console.log("Adding to cart...");
    const cartRes = await fetch('https://facelook-backend.onrender.com/api/cart', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${regData.token}`
        },
        body: JSON.stringify({ product_id: 1, qty: 1 })
    });
    const cartData = await cartRes.json();
    console.log("Cart response:", cartData);
}
test();
