(() => {
const config = window.FORUM_CONFIG || {};
const POSTS_PER_PAGE = Number(config.postsPerPage || 20);
const DEFAULT_NAME = config.defaultDisplayName || 'Rank & File';
const COMMENTS_JSON_URL = config.commentsJsonUrl || './comments.json';
const SUBMIT_ENDPOINT = config.submitEndpoint || '';
const LIVE_REFRESH_MS = Number(config.liveRefreshMs || 3000000);
const MAX_COMMENT_LENGTH = 3000;
const DEFAULT_CATEGORY = 'general';

const postForm = document.getElementById('postForm');
const displayNameInput = document.getElementById('display_name');
const categoryInput = document.getElementById('category');
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
const categoryTabs = document.getElementById('categoryTabs');

let allRecords = [];
let currentPage = 1;
let activeCategory = 'all';

const expandedThreads = new Set();
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

function normalizeCategory(category) {
const value = String(category || '').trim().toLowerCase();
if (value === 'news') return 'news';
if (value === 'questions') return 'questions';
return 'general';
}

function categoryLabel(category) {
const value = normalizeCategory(category);
if (value === 'news') return 'News';
if (value === 'questions') return 'Questions';
return 'General';
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
.map((record) => ({
id: String(record.id || `post_${Math.random().toString(36).slice(2, 11)}`),
parent_id: String(record.parent_id || '').trim(),
timestamp: String(record.timestamp || ''),
display_name: String(record.display_name || '').trim() || DEFAULT_NAME,
category: normalizeCategory(record.category || DEFAULT_CATEGORY),
comment: String(record.comment || '')
}))
.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function getTopLevelPosts() {
let posts = allRecords.filter((record) => !record.parent_id);

if (activeCategory !== 'all') {
posts = posts.filter((record) => record.category === activeCategory);
}

return posts;
}

function getChildren(parentId) {
return allRecords
.filter((record) => record.parent_id === parentId)
.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

function countAllDescendants(parentId) {
const children = getChildren(parentId);
let total = children.length;
for (const child of children) total += countAllDescendants(child.id);
return total;
}

async function fetchPosts(silent = false) {
try {
const cacheBust = `t=${Date.now()}`;
const url = COMMENTS_JSON_URL.includes('?')
? `${COMMENTS_JSON_URL}&${cacheBust}`
: `${COMMENTS_JSON_URL}?${cacheBust}`;

const res = await fetch(url, { cache: 'no-store' });
if (!res.ok) throw new Error(`Failed to load posts (${res.status})`);

const data = await res.json();
allRecords = normalizeRecords(Array.isArray(data) ? data : []);
render();

if (!silent) setMainStatus('Posts updated.', 'success', true);
} catch (err) {
console.error(err);
if (!silent) setMainStatus('Could not load posts right now.', 'error', true);
if (!allRecords.length && postsList) {
postsList.innerHTML = `<div class="empty-state">Unable to load posts right now.</div>`;
}
}
}

function renderCategoryBadge(category) {
const normalized = normalizeCategory(category);
const label = categoryLabel(normalized);
return `<span class="category-badge category-${normalized}">${escapeHtml(label)}</span>`;
}

function renderReplyForm(recordId, isOpen) {
return `
<form class="reply-form" data-reply-form="${escapeHtml(recordId)}" ${isOpen ? '' : 'style="display:none;"'} novalidate>
<div class="field">
<label>Name (optional)</label>
<input type="text" name="display_name" maxlength="80" placeholder="Leave blank to reply as ${escapeHtml(DEFAULT_NAME)}" />
</div>

<div class="field">
<label>Reply <span class="required">*</span></label>
<textarea name="comment" maxlength="${MAX_COMMENT_LENGTH}" placeholder="Write your reply..." required></textarea>
</div>

<div class="hp-wrap" aria-hidden="true">
<label>Website</label>
<input type="text" name="website" tabindex="-1" autocomplete="off" />
</div>

<div class="form-actions">
<button type="submit" class="btn btn-primary">Send Reply</button>
<span class="form-status" data-reply-status="${escapeHtml(recordId)}" aria-live="polite"></span>
</div>
</form>
`;
}

function renderNestedChildren(parentId, depth) {
const children = getChildren(parentId);
if (!children.length) {
if (depth === 1) return `<div class="muted">No replies yet.</div>`;
return '';
}
return children.map((child) => renderNestedReplyCard(child, depth)).join('');
}

function renderNestedReplyCard(reply, depth) {
const childCount = countAllDescendants(reply.id);
const isReplyFormOpen = openReplyForms.has(reply.id);
const safeDepth = Math.min(depth, 3);

return `
<article class="reply-card" style="margin-left:${safeDepth * 18}px;">
<div class="reply-top">
<div class="reply-meta">
<div class="reply-author">${escapeHtml(reply.display_name)}</div>
<div class="reply-time">${escapeHtml(formatDateTime(reply.timestamp))}</div>
</div>
</div>

<div class="reply-body">${escapeHtml(reply.comment)}</div>

<div class="post-actions">
<button class="link-btn" type="button" data-reply-toggle="${escapeHtml(reply.id)}">
${isReplyFormOpen ? 'Cancel Reply' : 'Reply'}
</button>
${
childCount > 0
? `<button class="link-btn" type="button" data-thread-toggle="${escapeHtml(reply.id)}">
${expandedThreads.has(reply.id) ? 'Hide Replies' : `Show Replies (${childCount})`}
</button>`
: ''
}
</div>

${renderReplyForm(reply.id, isReplyFormOpen)}

${
expandedThreads.has(reply.id)
? `<div class="reply-list">${renderNestedChildren(reply.id, depth + 1)}</div>`
: ''
}
</article>
`;
}

function renderTopLevelPostCard(post) {
const descendantsCount = countAllDescendants(post.id);
const isExpanded = expandedThreads.has(post.id);
const isReplyFormOpen = openReplyForms.has(post.id);

return `
<article class="post-card">
<div class="post-top">
<div class="post-head-left">
<div class="post-author">${escapeHtml(post.display_name)}</div>
<div class="post-time">${escapeHtml(formatDateTime(post.timestamp))}</div>
</div>
<div class="post-head-right">
${renderCategoryBadge(post.category)}
</div>
</div>

<div class="post-body">${escapeHtml(post.comment)}</div>

<div class="post-actions">
<button class="link-btn" type="button" data-reply-toggle="${escapeHtml(post.id)}">
${isReplyFormOpen ? 'Cancel Reply' : 'Reply'}
</button>
<button class="link-btn" type="button" data-thread-toggle="${escapeHtml(post.id)}">
${isExpanded ? 'Hide Replies' : `Show Replies (${descendantsCount})`}
</button>
</div>

<div class="reply-block" ${isExpanded || isReplyFormOpen ? '' : 'style="display:none;"'}>
${renderReplyForm(post.id, isReplyFormOpen)}
${isExpanded ? `<div class="reply-list">${renderNestedChildren(post.id, 1)}</div>` : ''}
</div>
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
});
});
}

function renderTabs() {
if (!categoryTabs) return;
categoryTabs.querySelectorAll('[data-category]').forEach((btn) => {
const category = btn.dataset.category;
btn.classList.toggle('active', category === activeCategory);
});
}

function bindThreadButtons() {
document.querySelectorAll('[data-thread-toggle]').forEach((btn) => {
btn.addEventListener('click', () => {
const id = btn.dataset.threadToggle;
if (!id) return;
if (expandedThreads.has(id)) expandedThreads.delete(id);
else expandedThreads.add(id);
render();
});
});

document.querySelectorAll('[data-reply-toggle]').forEach((btn) => {
btn.addEventListener('click', () => {
const id = btn.dataset.replyToggle;
if (!id) return;
if (openReplyForms.has(id)) openReplyForms.delete(id);
else openReplyForms.add(id);
render();
});
});

document.querySelectorAll('[data-reply-form]').forEach((form) => {
form.addEventListener('submit', handleReplySubmit);
});
}

function bindCategoryTabs() {
if (!categoryTabs) return;
categoryTabs.querySelectorAll('[data-category]').forEach((btn) => {
btn.addEventListener('click', () => {
const category = btn.dataset.category || 'all';
activeCategory = category;
currentPage = 1;
renderTabs();
render();
});
});
}

function render() {
if (!postsList || !pagination) return;

const topPosts = getTopLevelPosts();
const totalPages = Math.max(1, Math.ceil(topPosts.length / POSTS_PER_PAGE));
if (currentPage > totalPages) currentPage = totalPages;

const start = (currentPage - 1) * POSTS_PER_PAGE;
const pagePosts = topPosts.slice(start, start + POSTS_PER_PAGE);

if (!pagePosts.length) {
postsList.innerHTML = `<div class="empty-state">No posts found in this category yet.</div>`;
} else {
postsList.innerHTML = pagePosts.map(renderTopLevelPostCard).join('');
}

renderTabs();
renderPagination(totalPages);
bindThreadButtons();
}

function setMainStatus(message, type = '', autoClear = false) {
if (!formStatus) return;
formStatus.textContent = message;
formStatus.className = 'form-status';
if (type === 'success') formStatus.classList.add('notice-success');
if (type === 'error') formStatus.classList.add('notice-error');

if (autoClear) {
clearTimeout(setMainStatus._timer);
setMainStatus._timer = setTimeout(() => {
formStatus.textContent = '';
formStatus.className = 'form-status';
}, 3500);
}
}

function updateCharCount() {
if (!charCount || !commentInput) return;
charCount.textContent = `${commentInput.value.length} / ${MAX_COMMENT_LENGTH}`;
}

async function sendSubmission(payload) {
await fetch(SUBMIT_ENDPOINT, {
method: 'POST',
mode: 'no-cors',
headers: {
'Content-Type': 'text/plain;charset=utf-8'
},
body: JSON.stringify({
action: 'submit',
display_name: payload.display_name || '',
category: payload.category || DEFAULT_CATEGORY,
comment: payload.comment || '',
website: payload.website || '',
parent_id: payload.parent_id || ''
})
});
}

async function submitPost(e) {
e.preventDefault();

const displayName = displayNameInput ? displayNameInput.value.trim() : '';
const category = categoryInput ? normalizeCategory(categoryInput.value) : DEFAULT_CATEGORY;
const comment = commentInput ? commentInput.value.trim() : '';
const website = websiteInput ? websiteInput.value.trim() : '';
const parentId = parentIdInput ? parentIdInput.value.trim() : '';

if (!comment) {
setMainStatus('Please fill out this field.', 'error');
return;
}

if (!SUBMIT_ENDPOINT) {
setMainStatus('Submit endpoint is not configured yet.', 'error');
return;
}

if (submitBtn) submitBtn.disabled = true;
setMainStatus('Sending...', '');

try {
await sendSubmission({
display_name: displayName,
category,
comment,
website,
parent_id: parentId
});

if (postForm) postForm.reset();
if (parentIdInput) parentIdInput.value = '';
if (categoryInput) categoryInput.value = DEFAULT_CATEGORY;
updateCharCount();

setMainStatus('Post submitted will appear shortly.', 'success', true);
hideMainComposer();
} catch (err) {
console.error(err);
setMainStatus(err.message || 'Could not submit post right now.', 'error');
} finally {
if (submitBtn) submitBtn.disabled = false;
}
}

async function handleReplySubmit(e) {
e.preventDefault();

const form = e.currentTarget;
const recordId = form.dataset.replyForm;
const statusEl = form.querySelector(`[data-reply-status="${recordId}"]`);
const displayName = form.querySelector('input[name="display_name"]').value.trim();
const comment = form.querySelector('textarea[name="comment"]').value.trim();
const website = form.querySelector('input[name="website"]').value.trim();
const submitButton = form.querySelector('button[type="submit"]');

if (!comment) {
if (statusEl) {
statusEl.textContent = 'Please fill out this field.';
statusEl.className = 'form-status notice-error';
}
return;
}

if (submitButton) submitButton.disabled = true;
if (statusEl) {
statusEl.textContent = 'Sending...';
statusEl.className = 'form-status';
}

try {
await sendSubmission({
display_name: displayName,
category: DEFAULT_CATEGORY,
comment,
website,
parent_id: recordId
});

form.reset();

if (statusEl) {
statusEl.textContent = 'Reply submitted will appear shortly.';
statusEl.className = 'form-status notice-success';
}

expandedThreads.add(recordId);

setTimeout(() => {
openReplyForms.delete(recordId);
render();
}, 1200);
} catch (err) {
console.error(err);
if (statusEl) {
statusEl.textContent = err.message || 'Could not submit reply right now.';
statusEl.className = 'form-status notice-error';
}
} finally {
if (submitButton) submitButton.disabled = false;
}
}

function showMainComposer() {
if (!mainComposerCard || !toggleMainComposer) return;
mainComposerCard.classList.remove('is-hidden');
toggleMainComposer.style.display = 'none';
if (displayNameInput) displayNameInput.focus();
}

function hideMainComposer() {
if (!mainComposerCard || !toggleMainComposer) return;
mainComposerCard.classList.add('is-hidden');
toggleMainComposer.style.display = '';
if (postForm) postForm.reset();
if (parentIdInput) parentIdInput.value = '';
if (categoryInput) categoryInput.value = DEFAULT_CATEGORY;
updateCharCount();
}

if (toggleMainComposer) toggleMainComposer.addEventListener('click', showMainComposer);
if (cancelMainComposer) cancelMainComposer.addEventListener('click', hideMainComposer);
if (commentInput) commentInput.addEventListener('input', updateCharCount);
if (postForm) postForm.addEventListener('submit', submitPost);
if (refreshBtn) refreshBtn.addEventListener('click', () => fetchPosts());

bindCategoryTabs();
updateCharCount();
fetchPosts(true);
setInterval(() => fetchPosts(true), LIVE_REFRESH_MS);
})();
