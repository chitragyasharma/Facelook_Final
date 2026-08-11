async function run() {
    try {
        const url = `https://control.msg91.com/api/v5/otp/verify?otp=1234&mobile=91 9971045683&authkey=abc`;
        console.log('Fetching', url);
        await fetch(url);
        console.log('Success');
    } catch(e) {
        console.log('Error thrown:', e.name, e.message);
    }
}
run();
