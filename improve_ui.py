import re

def main():
    with open('index.html.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # 1. ADD TRACK ORDER TAB TO ACCOUNT
    # Find the acc-tabs section and insert a new tab
    acc_tabs_pattern = r'<div class="acc-tab-btn" data-tab="orders" onclick="switchAccTab\(\'orders\'\)">\s*<span class="acc-tab-icon">📦</span> Orders\s*</div>'
    new_tab = """<div class="acc-tab-btn" data-tab="orders" onclick="switchAccTab('orders')">
          <span class="acc-tab-icon">📦</span> Orders
        </div>
        <div class="acc-tab-btn" data-tab="track" onclick="switchAccTab('track')">
          <span class="acc-tab-icon">🚚</span> Track Order
        </div>"""
    html = re.sub(acc_tabs_pattern, new_tab, html)

    # 2. ADD TRACK SECTION CONTENT TO ACCOUNT
    # Find the end of acc-orders section and insert acc-track
    acc_orders_end = r'<!-- Orders Section -->\s*<div class="acc-section" id="acc-orders">\s*<div id="acc-orders-content"></div>\s*</div>'
    
    new_acc_section = """<!-- Orders Section -->
        <div class="acc-section" id="acc-orders">
          <div id="acc-orders-content"></div>
        </div>

        <!-- Track Section -->
        <div class="acc-section" id="acc-track">
          <div class="form-title">Track Your Order</div>
          <p class="empty-sub">Enter your Order ID to check the current delivery status.</p>
          
          <div style="max-width: 400px; margin-top:20px;">
            <input type="text" id="acc-track-order-id" class="form-input" placeholder="Order ID (e.g. ORD-12345)" style="margin-bottom: 12px;">
            <button class="btn btn-primary" style="width: 100%;" onclick="submitAccTracking()">Track Order</button>
          </div>

          <div class="track-result" id="acc-track-result" style="display:none; max-width:400px;">
            <!-- Rendered by JS -->
          </div>
        </div>"""
    html = re.sub(acc_orders_end, new_acc_section, html)

    # 3. ADD 'Track' button to orders in fetchOrders()
    order_card_old = r'<div class="order-total">₹\$\{o.total\}</div>\s*</div>\s*<div style="display:flex; justify-content:space-between; align-items:center;">'
    order_card_new = """<div class="order-total">₹${o.total}</div>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <button class="btn" style="padding: 4px 12px; font-size:12px; border:1px solid var(--border); border-radius:4px; background:#fff; cursor:pointer;" onclick="prefillAndTrack('${o.id || o._id.toString().slice(-6)}')">Track</button>"""
    html = html.replace(order_card_old, order_card_new)

    # Add the prefillAndTrack and submitAccTracking functions
    js_tracking_funcs = """
    function prefillAndTrack(id) {
        document.getElementById('acc-track-order-id').value = id;
        switchAccTab('track');
        submitAccTracking();
    }
    
    async function submitAccTracking() {
      const oid = document.getElementById('acc-track-order-id').value;
      if(!oid) {
        showToast('Please enter an Order ID');
        return;
      }
      
      const resContainer = document.getElementById('acc-track-result');
      resContainer.style.display = 'block';
      resContainer.innerHTML = '<div style="text-align:center; padding: 20px;">Fetching status...</div>';
      
      try {
        const res = await fetch('/api/track/' + encodeURIComponent(oid));
        if (!res.ok) throw new Error('Not found');
        const data = await res.json();
        
        let timelineHTML = '';
        data.tracking.forEach(t => {
            timelineHTML += `
            <div class="timeline-step ${t.status}">
              <div class="timeline-title">${t.title}</div>
              <div class="timeline-date">${t.date}</div>
            </div>`;
        });
        
        resContainer.innerHTML = `
          <h4 style="margin-top:24px; margin-bottom: 12px;">Order Status: <span style="color:var(--rose);">${data.tracking.find(t => t.status === 'active')?.title || 'Completed'}</span></h4>
          <div class="timeline">
            ${timelineHTML}
          </div>
        `;
      } catch (err) {
        resContainer.innerHTML = '<div style="color:red; text-align:center; margin-top: 20px;">Order not found. Please check your Order ID.</div>';
      }
    }
    """
    
    html = html.replace('// ─── ACCOUNT ─────────────────────────────────', js_tracking_funcs + '\n    // ─── ACCOUNT ─────────────────────────────────')

    # 4. IMPROVE REVIEWS SECTION
    # Update CSS
    new_review_css = """
    /* --- NATIVE REVIEWS --- */
    .reviews-section {
      padding: 32px 20px;
      border-top: 1px solid var(--border);
      background: #fdfdfd;
    }
    .reviews-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    .reviews-title {
      font-size: 22px;
      font-weight: 700;
      color: var(--td);
      font-family: 'Playfair Display', serif;
    }
    .reviews-summary {
      display: flex;
      gap: 20px;
      align-items: center;
      margin-bottom: 30px;
      padding: 20px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.03);
      border: 1px solid var(--border);
    }
    .reviews-rating-big {
      font-size: 42px;
      font-weight: 700;
      color: var(--td);
      line-height: 1;
    }
    .reviews-rating-stars {
      color: var(--rose);
      font-size: 18px;
      margin-top: 4px;
    }
    .reviews-rating-count {
      font-size: 13px;
      color: var(--tm);
      margin-top: 4px;
    }
    .write-review-btn {
      background: var(--td);
      border: none;
      color: #fff;
      padding: 10px 20px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .write-review-btn:hover {
      background: #000;
    }
    .review-card {
      padding: 20px;
      background: #fff;
      border-radius: 12px;
      margin-bottom: 16px;
      border: 1px solid var(--border);
      box-shadow: 0 2px 8px rgba(0,0,0,0.02);
    }
    .review-card-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .review-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--pale);
      color: var(--rose);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 16px;
    }
    .review-stars {
      color: var(--rose);
      font-size: 14px;
    }
    .review-verified {
      font-size: 11px;
      color: #10b981;
      font-weight: 600;
      background: #ecfdf5;
      padding: 2px 6px;
      border-radius: 4px;
      margin-left: 8px;
    }
    .review-title {
      font-weight: 600;
      font-size: 15px;
      margin-bottom: 6px;
      color: var(--td);
    }
    .review-body {
      font-size: 14px;
      color: #444;
      line-height: 1.6;
      margin-bottom: 12px;
    }
    .review-meta {
      font-size: 12px;
      color: var(--tl);
    }
    """
    
    # We replace the old CSS block with new one.
    old_css_match = re.search(r'/\* --- NATIVE REVIEWS --- \*/.*?\.review-meta \{.*?\}', html, re.DOTALL)
    if old_css_match:
        html = html.replace(old_css_match.group(0), new_review_css)

    # 5. Update renderReviews() logic to match new design
    old_render_reviews_match = re.search(r'function renderReviews\(\) \{.*?\}\s*\}', html, re.DOTALL)
    new_render_reviews = """
    function renderReviews() {
      const list = document.getElementById('reviews-list');
      if (!list) return;
      
      const summaryHTML = `
        <div class="reviews-summary">
          <div>
            <div class="reviews-rating-big">4.8</div>
            <div class="reviews-rating-stars">★★★★★</div>
            <div class="reviews-rating-count">Based on 124 reviews</div>
          </div>
          <div style="flex:1;">
             <!-- Progress bars could go here -->
             <div style="font-size:13px; color:var(--tm); line-height:1.6;">
               98% of customers recommend this product.<br>
               Excellent pigmentation and long-lasting formula.
             </div>
          </div>
        </div>
      `;
      
      const reviewsHTML = MOCK_REVIEWS.map(r => {
        const initials = r.name.split(' ').map(n=>n[0]).join('').substring(0,2);
        return `
        <div class="review-card">
          <div class="review-card-header">
            <div class="review-avatar">${initials}</div>
            <div>
              <div class="review-meta" style="font-weight:600; color:var(--td); font-size:13px;">${r.name} <span class="review-verified">✓ Verified Buyer</span></div>
              <div class="review-stars">${stars(r.rating)} <span style="color:var(--tl); font-size:12px; margin-left:6px;">${r.date}</span></div>
            </div>
          </div>
          <div class="review-title">${r.title}</div>
          <div class="review-body">${r.body}</div>
        </div>
      `}).join('');
      
      list.innerHTML = summaryHTML + reviewsHTML;
    }
    """
    if old_render_reviews_match:
        html = html.replace(old_render_reviews_match.group(0), new_render_reviews)

    with open('index.html.html', 'w', encoding='utf-8') as f:
        f.write(html)
        
    print("Improved UI successfully.")

if __name__ == '__main__':
    main()
