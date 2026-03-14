(() => {
const config = window.FORUM_CONFIG || {};
const POSTS_PER_PAGE = Number(config.postsPerPage || 20);
const DEFAULT_NAME = config.defaultDisplayName || 'Rank & File';
const COMMENTS_JSON_URL = config.commentsJsonUrl || './comments.json';
const SUBMIT_ENDPOINT = config.submitEndpoint || '';
const LIVE_REFRESH_MS = Number(config.liveRefreshMs || 30000);

const postForm = document.getElementById('postForm');
const displayNameInput = document.getElementById('display_name');
const commentInput = document.getElementById('comment');
const parentIdInput = document.getElementById('parent_id');
const websiteInput = document.getElementById('website');
const charCount = document.getElementById('charCount');
const formStatus = document.getElementById('formStatus');
const submitBtn = document.getElementById('submitBtn');
const refreshBtn = document.getElementById('refreshBtn');
const postsList = document.getElementById('postsList');
const pagination = document.getElementById('pagination');
const toggleMainComposer = document.getElementById('toggleMainComposer');
const mainComposerCard = document.getElementById('mainComposerCard');
const cancelMainComposer = document.getElementById('cancelMainComposer');

let allRecords = [];
let currentPage = 1;
const expandedReplies = new Set();
  const openReplyForms = new Set();

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

function normalizeRecords(records) {
return [...records]
.map((p) => ({
id: p.id || ('post_' + Math.random().toString(36).slice(2, 11)),
parent_id: p.parent_id || '',
timestamp: p.timestamp || '',
display_name: (p.display_name || '').trim() || DEFAULT_NAME,
comment: p.comment || ''
}))
.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
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
allRecords = normalizeRecords(Array.isArray(data) ? data : []);
render();
if (!silent) setStatus('Posts updated.', 'success', true);
} catch (err) {
console.error(err);
if (!silent) setStatus('Could not load posts right now.', 'error', true);
if (!allRecords.length) {
postsList.innerHTML = `<div class="empty-state">Unable to load posts right now.</div>`;
}
}
}

function getTopLevelPosts() {
return allRecords.filter(r => !r.parent_id);
}

function getReplies(parentId) {
return allRecords
.filter(r => r.parent_id === parentId)
.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

function render() {
const topPosts = getTopLevelPosts();
const totalPages = Math.max(1, Math.ceil(topPosts.length / POSTS_PER_PAGE));
if (currentPage > totalPages) currentPage = totalPages;

const start = (currentPage - 1) * POSTS_PER_PAGE;
const pagePosts = topPosts.slice(start, start + POSTS_PER_PAGE);

if (!pagePosts.length) {
postsList.innerHTML = `<div class="empty-state">No posts have been published yet.</div>`;
} else {
postsList.innerHTML = pagePosts.map(renderPostCard).join('');
}

renderPagination(totalPages);
bindPostButtons();
}

function renderPostCard(post) {
const replies = getReplies(post.id);
const expanded = expandedReplies.has(post.id);
const replyFormOpen = openReplyForms.has(post.id);

return `
<article class="post-card" data-post-id="${escapeHtml(post.id)}">
<div class="post-top">
<div>
<div class="post-author">${escapeHtml(post.display_name)}</div>
<div class="post-time">${escapeHtml(formatDateTime(post.timestamp))}</div>
</div>
</div>

<div class="post-body">${escapeHtml(post.comment)}</div>

<div class="post-actions">
<button class="link-btn" type="button" data-reply-toggle="${escapeHtml(post.id)}">
${replyFormOpen ? 'Cancel Reply' : 'Reply'}
</button>

<button class="link-btn" type="button" data-thread-toggle="${escapeHtml(post.id)}">
${expanded ? 'Hide Replies' : `Show Replies (${replies.length})`}
</button>
</div>

<div class="reply-block" ${expanded || replyFormOpen ? '' : 'style="display:none;"'} id="reply-block-${escapeHtml(post.id)}">
<form class="reply-form" data-reply-form="${escapeHtml(post.id)}" ${replyFormOpen ? '' : 'style="display:none;"'}>
<div class="field">
<label>Name (optional)</label>
<input type="text" name="display_name" maxlength="80" placeholder="Leave blank to reply as Rank & File" />
</div>

<div class="field">
<label>Reply <span class="required">*</span></label>
<textarea name="comment" maxlength="3000" placeholder="Write your reply..." required></textarea>
</div>

<div class="hp-wrap" aria-hidden="true">
<label>Website</label>
<input type="text" name="website" tabindex="-1" autocomplete="off" />
</div>

<div class="form-actions">
<button type="submit" class="btn btn-primary">Send Reply</button>
<span class="form-status" data-reply-status="${escapeHtml(post.id)}"></span>
</div>
</form>

${
expanded
? `<div class="reply-list">
${replies.length ? replies.map(renderReplyCard).join('') : `<div class="muted">No replies yet.</div>`}
</div>`
: ''
}
</div>
</article>
`;
}

function renderReplyCard(reply) {
return `
<article class="reply-card">
<div class="reply-top">
<div class="reply-author">${escapeHtml(reply.display_name)}</div>
<div class="reply-time">${escapeHtml(formatDateTime(reply.timestamp))}</div>
</div>
<div class="reply-body">${escapeHtml(reply.comment)}</div>
</article>
`;
}

function renderPagination(totalPages) {
if (totalPages <= 1) {
pagination.innerHTML = '';
return;
}

const buttons = [];
buttons.push(`<button class="page-btn" type="button" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>Prev</button>`);

for (let i = 1; i <= totalPages; i++) {
buttons.push(`<button class="page-btn ${i === currentPage ? 'active' : ''}" type="button" data-page="${i}">${i}</button>`);
}

buttons.push(`<button class="page-btn" type="button" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>`);

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

function bindPostButtons() {
document.querySelectorAll('[data-thread-toggle]').forEach((btn) => {
btn.addEventListener('click', () => {
const postId = btn.dataset.threadToggle;
if (!postId) return;

if (expandedReplies.has(postId)) {
expandedReplies.delete(postId);
} else {
expandedReplies.add(postId);
}
render();
});
});

document.querySelectorAll('[data-reply-toggle]').forEach((btn) => {
btn.addEventListener('click', () => {
const postId = btn.dataset.replyToggle;
if (!postId) return;
expandedReplies.add(postId);
render();

setTimeout(() => {
const form = document.querySelector(`[data-reply-form="${CSS.escape(postId)}"] textarea`);
if (form) form.focus();
}, 30);
});
});

document.querySelectorAll('[data-reply-form]').forEach((form) => {
form.addEventListener('submit', handleReplySubmit);
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

async function sendSubmission(payload) {
const formData = new URLSearchParams();
formData.append('action', 'submit');
formData.append('display_name', payload.display_name || '');
formData.append('comment', payload.comment || '');
formData.append('website', payload.website || '');
formData.append('parent_id', payload.parent_id || '');

await fetch(SUBMIT_ENDPOINT, {
method: 'POST',
mode: 'no-cors',
headers: {
'Content-Type': 'application/x-www-form-urlencoded'
},
body: formData.toString()
});
}

async function submitPost(e) {
e.preventDefault();

const displayName = displayNameInput.value.trim();
const comment = commentInput.value.trim();
const website = websiteInput.value.trim();
const parentId = parentIdInput.value.trim();

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
await sendSubmission({
display_name: displayName,
comment,
website,
parent_id: parentId
});

postForm.reset();
parentIdInput.value = '';
updateCharCount();
setStatus('Your post was accepted and will appear soon!', 'success');
hideMainComposer();
} catch (err) {
console.error(err);
setStatus('Could not submit post right now.', 'error');
} finally {
submitBtn.disabled = false;
}
}

async function handleReplySubmit(e) {
e.preventDefault();

const form = e.currentTarget;
const postId = form.dataset.replyForm;
const statusEl = form.querySelector(`[data-reply-status="${postId}"]`);
const displayName = form.querySelector('input[name="display_name"]').value.trim();
const comment = form.querySelector('textarea[name="comment"]').value.trim();
const website = form.querySelector('input[name="website"]').value.trim();
const submitButton = form.querySelector('button[type="submit"]');

if (!comment) {
statusEl.textContent = 'Reply is required.';
statusEl.className = 'form-status notice-error';
return;
}

if (comment.length > 3000) {
statusEl.textContent = 'Reply exceeds 3000 characters.';
statusEl.className = 'form-status notice-error';
return;
}

submitButton.disabled = true;
statusEl.textContent = 'Sending...';
statusEl.className = 'form-status';

try {
await sendSubmission({
display_name: displayName,
comment,
website,
parent_id: postId
});

form.reset();
statusEl.textContent = 'Reply submitted will appear shortly.';
statusEl.className = 'form-status notice-success';
} catch (err) {
console.error(err);
statusEl.textContent = 'Could not submit reply right now.';
statusEl.className = 'form-status notice-error';
} finally {
submitButton.disabled = false;
}
}

function showMainComposer() {
mainComposerCard.classList.remove('is-hidden');
toggleMainComposer.style.display = 'none';
displayNameInput.focus();
}

function hideMainComposer() {
mainComposerCard.classList.add('is-hidden');
toggleMainComposer.style.display = '';
}

toggleMainComposer.addEventListener('click', showMainComposer);
cancelMainComposer.addEventListener('click', hideMainComposer);
commentInput.addEventListener('input', updateCharCount);
postForm.addEventListener('submit', submitPost);
refreshBtn.addEventListener('click', () => fetchPosts());

updateCharCount();
fetchPosts(true);
window.setInterval(() => fetchPosts(true), LIVE_REFRESH_MS);
})();
