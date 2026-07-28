import re

def main():
    with open('index.html.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # 1. Add CSS for reviews
    css_to_add = """
    /* --- NATIVE REVIEWS --- */
    .reviews-section {
      padding: 24px 16px;
      border-top: 1px solid var(--border);
      background: #fff;
    }
    .reviews-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .reviews-title {
      font-size: 20px;
      font-weight: 700;
      color: var(--td);
      font-family: 'Playfair Display', serif;
    }
    .write-review-btn {
      background: #fff;
      border: 1px solid var(--rose);
      color: var(--rose);
      padding: 8px 16px;
      border-radius: 4px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
    }
    .review-card {
      padding: 16px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .review-card:last-child {
      border-bottom: none;
    }
    .review-stars {
      color: var(--rose);
      font-size: 14px;
      margin-bottom: 4px;
    }
    .review-title {
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 4px;
    }
    .review-body {
      font-size: 14px;
      color: var(--tm);
      line-height: 1.5;
      margin-bottom: 8px;
    }
    .review-meta {
      font-size: 12px;
      color: var(--tl);
    }
    
    .review-modal-overlay {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.5); z-index: 2000;
      display: flex; align-items: center; justify-content: center;
      opacity: 0; pointer-events: none; transition: 0.3s;
    }
    .review-modal-overlay.active { opacity: 1; pointer-events: auto; }
    .review-modal {
      background: #fff; padding: 24px; border-radius: 12px; width: 90%; max-width: 400px;
      position: relative;
    }
    .review-modal h3 { margin-bottom: 16px; font-family: 'Playfair Display', serif; }
    .review-modal input, .review-modal textarea {
      width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 4px; margin-bottom: 12px; font-family: inherit;
    }
    .review-modal textarea { height: 100px; resize: none; }
    .review-close {
      position: absolute; top: 12px; right: 16px; font-size: 24px; cursor: pointer; color: var(--tm);
    }
"""
    html = html.replace('/* --- END CSS --- */', css_to_add + '\n    /* --- END CSS --- */')

    # 2. Add HTML for reviews section
    html_to_add = """
      </div>
    </div>
    
    <!-- REVIEWS SECTION -->
    <div class="reviews-section" id="detail-reviews-section">
      <div class="reviews-header">
        <div class="reviews-title">Customer Reviews</div>
        <button class="write-review-btn" onclick="openReviewModal()">Write a Review</button>
      </div>
      <div id="reviews-list">
        <!-- populated dynamically -->
      </div>
    </div>

    <div id="related-section" style="border-top:1px solid var(--border);">"""
    
    html = html.replace('      </div>\n    </div>\n    <div id="related-section" style="border-top:1px solid var(--border);">', html_to_add)

    # 3. Add Write Review Modal HTML at the bottom of body
    modal_html = """
  <!-- Write Review Modal -->
  <div class="review-modal-overlay" id="review-modal-overlay">
    <div class="review-modal">
      <span class="review-close" onclick="closeReviewModal()">&times;</span>
      <h3>Write a Review</h3>
      <input type="text" id="review-name" placeholder="Your Name">
      <input type="text" id="review-title" placeholder="Review Title (e.g. Loved it!)">
      <textarea id="review-body" placeholder="Share your experience with this product..."></textarea>
      <button class="btn btn-primary btn-full" onclick="submitReview()">Submit Review</button>
    </div>
  </div>
  
  <script>"""
    html = html.replace('  <script>', modal_html)

    # 4. Add JS functions for reviews
    js_to_add = """
    // ─── REVIEWS ──────────────────────────────────
    const MOCK_REVIEWS = [
      { name: 'Priya K.', title: 'Absolutely love the pigmentation!', body: 'This is my second time buying this. The color payoff is insane and it stays on all day.', rating: 5, date: '2 days ago' },
      { name: 'Ananya S.', title: 'Good for everyday use', body: 'Very smooth application. Not entirely transfer-proof but I love how lightweight it feels.', rating: 4, date: '1 week ago' },
      { name: 'Megha R.', title: 'Gorgeous shade', body: 'Looks exactly like the picture. Highly recommend for festive seasons.', rating: 5, date: '2 weeks ago' }
    ];

    function renderReviews() {
      const list = document.getElementById('reviews-list');
      if (!list) return;
      list.innerHTML = MOCK_REVIEWS.map(r => `
        <div class="review-card">
          <div class="review-stars">${stars(r.rating)}</div>
          <div class="review-title">${r.title}</div>
          <div class="review-body">${r.body}</div>
          <div class="review-meta">${r.name} &bull; ${r.date}</div>
        </div>
      `).join('');
    }

    function openReviewModal() {
      document.getElementById('review-modal-overlay').classList.add('active');
    }

    function closeReviewModal() {
      document.getElementById('review-modal-overlay').classList.remove('active');
    }

    function submitReview() {
      closeReviewModal();
      showToast('Review submitted for moderation!');
      document.getElementById('review-name').value = '';
      document.getElementById('review-title').value = '';
      document.getElementById('review-body').value = '';
    }
"""
    html = html.replace('    // ─── STARS ──────────────────────────────────', js_to_add + '\n    // ─── STARS ──────────────────────────────────')

    # 5. Call renderReviews() inside openProduct()
    html = html.replace("document.getElementById('related-products').innerHTML = related.map(p => productCardHTML(p, 'width:140px;flex-shrink:0;')).join('');", 
                        "document.getElementById('related-products').innerHTML = related.map(p => productCardHTML(p, 'width:140px;flex-shrink:0;')).join('');\n      renderReviews();")


    with open('index.html.html', 'w', encoding='utf-8') as f:
        f.write(html)
        
    print("Added reviews.")

if __name__ == '__main__':
    main()
