const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const html = fs.readFileSync('client/admin.html', 'utf8');
const dom = new JSDOM(html, { runScripts: "dangerously" });
const window = dom.window;
const document = window.document;

try {
  // Simulate clicking the "+ Generate Coupon" button
  window.openCouponModal();
  console.log("Modal display style after opening:", document.getElementById('coupon-modal').style.display);
  console.log("Modal title text:", document.getElementById('coupon-modal-title').innerText);
} catch (e) {
  console.error("Error running openCouponModal:", e);
}
