import re

def main():
    with open('index.html.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # 1. Add CSS for tracking
    css_to_add = """
    /* --- TRACKING PAGE --- */
    .track-container {
      max-width: 500px;
      margin: 40px auto;
      padding: 24px;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }
    .track-title {
      font-size: 24px;
      font-weight: 700;
      color: var(--td);
      margin-bottom: 20px;
      text-align: center;
      font-family: 'Playfair Display', serif;
    }
    .track-input {
      width: 100%;
      padding: 12px;
      border: 1px solid var(--border);
      border-radius: 4px;
      margin-bottom: 16px;
      font-size: 14px;
      font-family: inherit;
    }
    .track-btn {
      width: 100%;
      padding: 14px;
      background: var(--td);
      color: #fff;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .track-result {
      margin-top: 30px;
      display: none;
    }
    .timeline {
      position: relative;
      margin-top: 20px;
      padding-left: 20px;
    }
    .timeline::before {
      content: '';
      position: absolute;
      top: 0; left: 6px;
      height: 100%;
      width: 2px;
      background: var(--border);
    }
    .timeline-step {
      position: relative;
      margin-bottom: 20px;
    }
    .timeline-step::before {
      content: '';
      position: absolute;
      left: -20px;
      top: 4px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #ccc;
      border: 2px solid #fff;
    }
    .timeline-step.active::before {
      background: var(--rose);
    }
    .timeline-step.completed::before {
      background: var(--td);
    }
    .timeline-title {
      font-weight: 600;
      font-size: 14px;
      color: var(--td);
    }
    .timeline-date {
      font-size: 12px;
      color: var(--tm);
    }
"""
    html = html.replace('/* --- END CSS --- */', css_to_add + '\n    /* --- END CSS --- */')

    # 2. Add Tracking Page HTML before PAGE: CART
    html_to_add = """  <!-- ═══════════════════════════════════
     PAGE: TRACK ORDER
════════════════════════════════════ -->
  <div class="page" id="page-track" style="padding-bottom:100px;">
    <div class="breadcrumb" style="padding: 16px;">
      <a href="/shop" onclick="event.preventDefault(); goTo('shop')">← Back</a>
    </div>
    <div class="track-container">
      <div class="track-title">Track Your Order</div>
      <p style="text-align:center; color:var(--tm); font-size:14px; margin-bottom:24px;">Enter your Order ID to check the current delivery status.</p>
      
      <input type="text" id="track-order-id" class="track-input" placeholder="Order ID (e.g. ORD-12345)">
      <button class="track-btn" onclick="submitTracking()">Track Order</button>

      <div class="track-result" id="track-result">
        <h4 style="margin-bottom: 12px;">Order Status: <span style="color:var(--rose);">Shipped</span></h4>
        <div class="timeline">
          <div class="timeline-step completed">
            <div class="timeline-title">Order Placed</div>
            <div class="timeline-date">Yesterday, 10:30 AM</div>
          </div>
          <div class="timeline-step active">
            <div class="timeline-title">Shipped</div>
            <div class="timeline-date">Today, 09:15 AM</div>
            <div style="font-size:12px; color:var(--tl); margin-top:4px;">Tracking ID: AWB84736291 (Shiprocket)</div>
          </div>
          <div class="timeline-step">
            <div class="timeline-title">Out for Delivery</div>
            <div class="timeline-date">Pending</div>
          </div>
          <div class="timeline-step">
            <div class="timeline-title">Delivered</div>
            <div class="timeline-date">Pending</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ═══════════════════════════════════
     PAGE: CART"""
    html = html.replace('  <!-- ═══════════════════════════════════\n     PAGE: CART', html_to_add)

    # 3. Add JS for tracking
    js_to_add = """
    // ─── TRACKING ────────────────────────────────
    function submitTracking() {
      const oid = document.getElementById('track-order-id').value;
      if(!oid) {
        showToast('Please enter an Order ID');
        return;
      }
      document.getElementById('track-result').style.display = 'block';
      // In reality, this would fetch from /api/track/:id
    }
"""
    html = html.replace('    // ─── REVIEWS ──────────────────────────────────', js_to_add + '\n    // ─── REVIEWS ──────────────────────────────────')

    # 4. Update the router to handle /track route
    router_regex = r"function navigate\(path\) \{([\s\S]*?)const pages = document\.querySelectorAll\('\.page'\);"
    
    match = re.search(router_regex, html)
    if match:
        old_router_body = match.group(0)
        # We need to add the `/track` route to the logic
        new_router_body = old_router_body.replace(
            "const pages = document.querySelectorAll('.page');",
            """
      if (path === '/track' || path === '/track-order') {
        document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
        document.getElementById('page-track').style.display = 'block';
        window.scrollTo(0,0);
        return;
      }
      
      const pages = document.querySelectorAll('.page');"""
        )
        html = html.replace(old_router_body, new_router_body)

    with open('index.html.html', 'w', encoding='utf-8') as f:
        f.write(html)
        
    print("Added tracking page.")

if __name__ == '__main__':
    main()
