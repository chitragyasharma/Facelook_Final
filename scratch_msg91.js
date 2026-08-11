const authkey = '555117AGGtzOyWaGWH6a799a10P1';
const template_id = '6a7b1b0e6c8a5cdb040fb922';
const mobile = '919999999999';

async function test() {
    const url = `https://control.msg91.com/api/v5/otp?template_id=${template_id}&mobile=${mobile}&authkey=${authkey}`;
    console.log('Fetching:', url);
    try {
        const response = await fetch(url, { method: 'GET' });
        const data = await response.json();
        console.log('Response:', data);
    } catch (e) {
        console.error('Error:', e);
    }
}
test();
