(() => {
  const config = window.FORUM_CONFIG || {};
  const POSTS_PER_PAGE = Number(config.postsPerPage || 20);
  const DEFAULT_NAME = config.defaultDisplayName || 'Rank & File';
  const COMMENTS_JSON_URL = config.commentsJsonUrl || './comments.json';
  const SUBMIT_ENDPOINT = config.submitEndpoint || '';
  const UPVOTE_ENDPOINT = config.upvoteEndpoint || '';
  const LIVE_REFRESH_MS = Number(config.liveRefreshMs || 30000);

  const postForm = document.getElementById('postForm');
  const displayNameInput = document.getElementById('display_name');
  const commentInput = document.getElementById('comment');
  const websiteInput = document.getElementById('website');
  const charCount = document.getElementById('charCount');
  const formStatus = document.getElementById('formStatus');
  const submitBtn = document.getElementById('submitBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const postsList = document.getElementById('postsList');
  const pagination = document.getElementById('pagination');

  let allPosts = [];
  let currentPage = 1;

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  }

  function formatDateTime(isoString) {
    if (!isoString) return 'Unknown date';
    const dt = new Date(isoString);
    if (Number.isNaN(dt.getTime())) return isoString;

    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(dt);
  }

  function getStoredVoteMap() {
    try {
      return JSON.parse(localStorage.getItem('rf6787_votes') || '{}');
    } catch {
      return {};
    }
  }

  function setStoredVote(postId) {
    const map = getStoredVoteMap();
    map[postId] = true;
    localStorage.setItem('rf6787_votes', JSON.stringify(map));
  }

  function hasVoted(postId) {
    return !!getStoredVoteMap()[postId];
  }

  function normalizePosts(posts) {
    return [...posts]
      .map((p) => ({
        id: p.id || cryptoRandomFallback(),
        timestamp: p.timestamp || '',
        display_name: (p.display_name || '').trim() || DEFAULT_NAME,
        comment: p.comment || '',
        upvotes: Number(p.upvotes || 0)
      }))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  function cryptoRandomFallback() {
    return 'post_' + Math.random().toString(36).slice(2, 11);
  }

  async function fetchPosts(silent = false) {
    try {
      const bust = `t=${Date.now()}`;
      const url = COMMENTS_JSON_URL.includes('?')
        ? `${COMMENTS_JSON_URL}&${bust}`
        : `${COMMENTS_JSON_URL}?${bust}`;

      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to load posts (${res.status})`);

      const data = await res.json();
      allPosts = normalizePosts(Array.isArray(data) ? data : []);
      render();
      if (!silent) setStatus('Posts updated.', 'success', true);
    } catch (err) {
      console.error(err);
      if (!silent) setStatus('Could not load posts right now.', 'error', true);
      if (!allPosts.length) {
        postsList.innerHTML = `<div class="empty-state">Unable to load posts right now.</div>`;
      }
    }
  }

  function render() {
    const totalPages = Math.max(1, Math.ceil(allPosts.length / POSTS_PER_PAGE));
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * POSTS_PER_PAGE;
    const pagePosts = allPosts.slice(start, start + POSTS_PER_PAGE);

    if (!pagePosts.length) {
      postsList.innerHTML = `<div class="empty-state">No posts have been published yet.</div>`;
    } else {
      postsList.innerHTML = pagePosts.map((post) => {
        const voted = hasVoted(post.id);
        return `
          <article class="post-card" data-post-id="${escapeHtml(post.id)}">
            <div class="post-top">
              <div class="post-author-wrap">
                <div class="post-author">${escapeHtml(post.display_name || DEFAULT_NAME)}</div>
                <div class="post-time">${escapeHtml(formatDateTime(post.timestamp))}</div>
              </div>

              <div class="post-score">
                <button
                  class="vote-btn ${voted ? 'voted' : ''}"
                  type="button"
                  data-vote-id="${escapeHtml(post.id)}"
                  ${voted ? 'disabled' : ''}
                  aria-label="Upvote this post"
                >▲ Upvote</button>
                <span class="vote-count">${post.upvotes}</span>
              </div>
            </div>

            <div class="post-body">${escapeHtml(post.comment)}</div>
          </article>
        `;
      }).join('');
    }

    renderPagination(totalPages);
    bindVoteButtons();
  }

  function renderPagination(totalPages) {
    if (totalPages <= 1) {
      pagination.innerHTML = '';
      return;
    }

    const buttons = [];

    buttons.push(`
      <button class="page-btn" type="button" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>
        Prev
      </button>
    `);

    for (let i = 1; i <= totalPages; i++) {
      buttons.push(`
        <button class="page-btn ${i === currentPage ? 'active' : ''}" type="button" data-page="${i}">
          ${i}
        </button>
      `);
    }

    buttons.push(`
      <button class="page-btn" type="button" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>
        Next
      </button>
    `);

    pagination.innerHTML = buttons.join('');

    pagination.querySelectorAll('[data-page]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextPage = Number(btn.dataset.page);
        if (!nextPage || nextPage < 1 || nextPage > totalPages) return;
        currentPage = nextPage;
        render();
        window.scrollTo({ top: document.querySelector('.feed-toolbar').offsetTop - 10, behavior: 'smooth' });
      });
    });
  }

  function bindVoteButtons() {
    document.querySelectorAll('[data-vote-id]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const postId = btn.dataset.voteId;
        if (!postId || hasVoted(postId)) return;

        btn.disabled = true;

        try {
          if (!UPVOTE_ENDPOINT) {
            throw new Error('Upvote endpoint missing.');
          }

          const res = await fetch(UPVOTE_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              action: 'upvote',
              id: postId
            })
          });

          const data = await res.json();
          if (!data.ok) throw new Error(data.message || 'Upvote failed.');

          setStoredVote(postId);

          const post = allPosts.find((p) => p.id === postId);
          if (post) post.upvotes = Number(post.upvotes || 0) + 1;

          render();
        } catch (err) {
          console.error(err);
          btn.disabled = false;
          setStatus('Unable to upvote right now.', 'error', true);
        }
      });
    });
  }

  function setStatus(message, type = '', autoClear = false) {
    formStatus.textContent = message;
    formStatus.className = 'form-status';

    if (type === 'success') formStatus.classList.add('notice-success');
    if (type === 'error') formStatus.classList.add('notice-error');

    if (autoClear) {
      window.clearTimeout(setStatus._timer);
      setStatus._timer = window.setTimeout(() => {
        formStatus.textContent = '';
        formStatus.className = 'form-status';
      }, 3000);
    }
  }

  function updateCharCount() {
    const len = commentInput.value.length;
    charCount.textContent = `${len} / 3000`;
  }

  async function submitPost(e) {
    e.preventDefault();

    const displayName = displayNameInput.value.trim();
    const comment = commentInput.value.trim();
    const website = websiteInput.value.trim();

    if (!comment) {
      setStatus('Comment is required.', 'error');
      return;
    }

    if (comment.length > 3000) {
      setStatus('Comment exceeds 3000 characters.', 'error');
      return;
    }

    if (!SUBMIT_ENDPOINT) {
      setStatus('Submit endpoint is not configured yet.', 'error');
      return;
    }

    submitBtn.disabled = true;
    setStatus('Sending...', '');

    try {
      const res = await fetch(SUBMIT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'submit',
          display_name: displayName,
          comment,
          website
        })
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.message || 'Submission failed.');

      postForm.reset();
      updateCharCount();
      setStatus('Post submitted for review.', 'success');
    } catch (err) {
      console.error(err);
      setStatus('Could not submit post right now.', 'error');
    } finally {
      submitBtn.disabled = false;
    }
  }

  commentInput.addEventListener('input', updateCharCount);
  postForm.addEventListener('submit', submitPost);
  refreshBtn.addEventListener('click', () => fetchPosts());

  updateCharCount();
  fetchPosts(true);
  window.setInterval(() => fetchPosts(true), LIVE_REFRESH_MS);
})();
