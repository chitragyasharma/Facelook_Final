const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const html = fs.readFileSync('client/admin.html', 'utf8');
const dom = new JSDOM(html, { runScripts: "dangerously" });

try {
    const window = dom.window;
    const document = window.document;

    // Simulate clicking the "Create Coupon" button
    window.openCouponModal();

    const offerModal = document.getElementById('offer-modal');
    console.log("Offer Modal display:", offerModal.style.display);
} catch (err) {
    console.error("Error during execution:", err);
}
