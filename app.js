(() => {
  console.log('app.js loaded');
const config = window.FORUM_CONFIG || {};
const POSTS_PER_PAGE = Number(config.postsPerPage || 20);
const DEFAULT_NAME = config.defaultDisplayName || 'Rank & File';
const COMMENTS_JSON_URL = config.commentsJsonUrl || './comments.json';
const SUBMIT_ENDPOINT = config.submitEndpoint || '';
const LIVE_REFRESH_MS = Number(config.liveRefreshMs || 30000);
const MAX_COMMENT_LENGTH = 3000;
const MAX_VISUAL_DEPTH = 3;
const MAX_IMAGE_BYTES = Number(config.maxImageBytes || 4194304);
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const postForm = document.getElementById('postForm');
const displayNameInput = document.getElementById('display_name');
const commentInput = document.getElementById('comment');
const parentIdInput = document.getElementById('parent_id');
const websiteInput = document.getElementById('website');
const imageFileInput = document.getElementById('image_file');
const imagePreviewWrap = document.getElementById('imagePreviewWrap');
const imagePreview = document.getElementById('imagePreview');
const clearImageBtn = document.getElementById('clearImageBtn');
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
comment: String(record.comment || ''),
image_url: String(record.image_url || '').trim()
}))
.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function getTopLevelPosts() {
return allRecords.filter((record) => !record.parent_id);
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

function render() {
if (!postsList || !pagination) return;

const topPosts = getTopLevelPosts();
const totalPages = Math.max(1, Math.ceil(topPosts.length / POSTS_PER_PAGE));
if (currentPage > totalPages) currentPage = totalPages;

const start = (currentPage - 1) * POSTS_PER_PAGE;
const pagePosts = topPosts.slice(start, start + POSTS_PER_PAGE);

if (!pagePosts.length) {
postsList.innerHTML = `<div class="empty-state">No posts have been published yet.</div>`;
} else {
postsList.innerHTML = pagePosts.map(renderTopLevelPostCard).join('');
}

renderPagination(totalPages);
bindThreadButtons();
}

function renderTopLevelPostCard(post) {
const descendantsCount = countAllDescendants(post.id);
const isExpanded = expandedThreads.has(post.id);
const isReplyFormOpen = openReplyForms.has(post.id);

return `
<article class="post-card" data-post-id="${escapeHtml(post.id)}">
<div class="post-top">
<div>
<div class="post-author">${escapeHtml(post.display_name)}</div>
<div class="post-time">${escapeHtml(formatDateTime(post.timestamp))}</div>
</div>
</div>

<div class="post-body">${escapeHtml(post.comment)}</div>
${renderImage(post.image_url)}

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

${
isExpanded
? `<div class="reply-list">${renderNestedChildren(post.id, 1)}</div>`
: ''
}
</div>
</article>
`;
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

<div class="field">
<label>Image (optional)</label>
<input type="file" name="image_file" accept="image/jpeg,image/png,image/webp,image/gif" />
<p class="field-help">Allowed: JPG, PNG, WEBP, GIF • Max 4 MB</p>
<div class="image-preview-wrap is-hidden" data-reply-preview-wrap="${escapeHtml(recordId)}">
<img class="image-preview" data-reply-preview-img="${escapeHtml(recordId)}" alt="Selected image preview" />
<button type="button" class="btn btn-secondary btn-small" data-reply-clear-image="${escapeHtml(recordId)}">Remove Image</button>
</div>
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
const safeDepth = Math.min(depth, MAX_VISUAL_DEPTH);

return `
<article class="reply-card" data-reply-id="${escapeHtml(reply.id)}" style="margin-left:${safeDepth * 18}px;">
<div class="reply-top">
<div class="reply-author">${escapeHtml(reply.display_name)}</div>
<div class="reply-time">${escapeHtml(formatDateTime(reply.timestamp))}</div>
</div>

<div class="reply-body">${escapeHtml(reply.comment)}</div>
${renderImage(reply.image_url)}

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

function renderImage(imageUrl) {
if (!imageUrl) return '';
return `
<div class="post-image-wrap">
<a href="${escapeHtml(imageUrl)}" target="_blank" rel="noopener noreferrer">
<img class="post-image" src="${escapeHtml(imageUrl)}" alt="User uploaded image" loading="lazy" />
</a>
</div>
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

const toolbar = document.querySelector('.feed-toolbar');
if (toolbar) {
window.scrollTo({ top: toolbar.offsetTop - 10, behavior: 'smooth' });
}
});
});
}

function bindThreadButtons() {
document.querySelectorAll('[data-thread-toggle]').forEach((btn) => {
btn.addEventListener('click', () => {
const recordId = btn.dataset.threadToggle;
if (!recordId) return;
if (expandedThreads.has(recordId)) expandedThreads.delete(recordId);
else expandedThreads.add(recordId);
render();
});
});

document.querySelectorAll('[data-reply-toggle]').forEach((btn) => {
btn.addEventListener('click', () => {
const recordId = btn.dataset.replyToggle;
if (!recordId) return;
if (openReplyForms.has(recordId)) openReplyForms.delete(recordId);
else openReplyForms.add(recordId);
render();

if (openReplyForms.has(recordId)) {
window.setTimeout(() => {
const textarea = document.querySelector(`[data-reply-form="${CSS.escape(recordId)}"] textarea`);
if (textarea) textarea.focus();
}, 30);
}
});
});

document.querySelectorAll('[data-reply-form]').forEach((form) => {
form.addEventListener('submit', handleReplySubmit);
});

document.querySelectorAll('.reply-form input[type="file"]').forEach((input) => {
input.addEventListener('change', handleReplyImagePreview);
});

document.querySelectorAll('[data-reply-clear-image]').forEach((btn) => {
btn.addEventListener('click', handleReplyClearImage);
});
}

function setMainStatus(message, type = '', autoClear = false) {
if (!formStatus) return;
formStatus.textContent = message;
formStatus.className = 'form-status';
if (type === 'success') formStatus.classList.add('notice-success');
if (type === 'error') formStatus.classList.add('notice-error');

if (autoClear) {
window.clearTimeout(setMainStatus._timer);
setMainStatus._timer = window.setTimeout(() => {
formStatus.textContent = '';
formStatus.className = 'form-status';
}, 3500);
}
}

function updateCharCount() {
if (!charCount || !commentInput) return;
charCount.textContent = `${commentInput.value.length} / ${MAX_COMMENT_LENGTH}`;
}

function validateImageFile(file) {
if (!file) return null;

if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
throw new Error('Unsupported image type. Use JPG, PNG, WEBP, or GIF.');
}

if (file.size > MAX_IMAGE_BYTES) {
throw new Error('Image exceeds 4 MB.');
}

return true;
}

function readFileAsBase64(file) {
return new Promise((resolve, reject) => {
const reader = new FileReader();

reader.onload = () => {
const result = String(reader.result || '');
const commaIndex = result.indexOf(',');
if (commaIndex === -1) {
reject(new Error('Could not read image.'));
return;
}
resolve(result.slice(commaIndex + 1));
};

reader.onerror = () => reject(new Error('Could not read image.'));
reader.readAsDataURL(file);
});
}

async function buildImagePayload(file) {
if (!file) {
return {
image_base64: '',
image_mime_type: '',
image_name: ''
};
}

validateImageFile(file);

return {
image_base64: await readFileAsBase64(file),
image_mime_type: file.type,
image_name: file.name || 'upload'
};
}

async function sendSubmission(payload) {
const formData = new URLSearchParams();
formData.append('action', 'submit');
formData.append('display_name', payload.display_name || '');
formData.append('comment', payload.comment || '');
formData.append('website', payload.website || '');
formData.append('parent_id', payload.parent_id || '');
formData.append('image_base64', payload.image_base64 || '');
formData.append('image_mime_type', payload.image_mime_type || '');
formData.append('image_name', payload.image_name || '');

console.log('Sending to submit endpoint:', SUBMIT_ENDPOINT);

await fetch(SUBMIT_ENDPOINT, {
method: 'POST',
mode: 'no-cors',
headers: {
'Content-Type': 'application/x-www-form-urlencoded'
},
body: formData.toString()
});
}

function showMainImagePreview(file) {
if (!imagePreviewWrap || !imagePreview || !file) return;
const url = URL.createObjectURL(file);
imagePreview.src = url;
imagePreviewWrap.classList.remove('is-hidden');
}

function clearMainImagePreview() {
if (imageFileInput) imageFileInput.value = '';
if (imagePreview) imagePreview.src = '';
if (imagePreviewWrap) imagePreviewWrap.classList.add('is-hidden');
}

async function submitPost(e) {
e.preventDefault();

const displayName = displayNameInput ? displayNameInput.value.trim() : '';
const comment = commentInput ? commentInput.value.trim() : '';
const website = websiteInput ? websiteInput.value.trim() : '';
const parentId = parentIdInput ? parentIdInput.value.trim() : '';
const imageFile = imageFileInput && imageFileInput.files ? imageFileInput.files[0] : null;

if (!comment) {
setMainStatus('Please fill out this field.', 'error');
if (commentInput) commentInput.focus();
return;
}

if (comment.length > MAX_COMMENT_LENGTH) {
setMainStatus(`Post exceeds ${MAX_COMMENT_LENGTH} characters.`, 'error');
return;
}

if (!SUBMIT_ENDPOINT) {
setMainStatus('Submit endpoint is not configured yet.', 'error');
return;
}

if (submitBtn) submitBtn.disabled = true;
setMainStatus('Sending...', '');

try {
let imagePayload = {
image_base64: '',
image_mime_type: '',
image_name: ''
};

if (imageFile) {
imagePayload = await buildImagePayload(imageFile);
}

await sendSubmission({
display_name: displayName,
comment,
website,
parent_id: parentId,
...imagePayload
});

if (postForm) postForm.reset();
if (parentIdInput) parentIdInput.value = '';
clearMainImagePreview();
updateCharCount();

setMainStatus('Post submitted will appear shortly.', 'success', true);
hideMainComposer();
} catch (err) {
console.error('submitPost error:', err);
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
const imageInput = form.querySelector('input[name="image_file"]');
const imageFile = imageInput && imageInput.files ? imageInput.files[0] : null;
const submitButton = form.querySelector('button[type="submit"]');

if (!comment) {
if (statusEl) {
statusEl.textContent = 'Please fill out this field.';
statusEl.className = 'form-status notice-error';
}
const textarea = form.querySelector('textarea[name="comment"]');
if (textarea) textarea.focus();
return;
}

if (comment.length > MAX_COMMENT_LENGTH) {
if (statusEl) {
statusEl.textContent = `Reply exceeds ${MAX_COMMENT_LENGTH} characters.`;
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
const imagePayload = await buildImagePayload(imageFile);

await sendSubmission({
display_name: displayName,
comment,
website,
parent_id: recordId,
...imagePayload
});

form.reset();
clearReplyPreview(recordId);

if (statusEl) {
statusEl.textContent = 'Reply submitted will appear shortly.';
statusEl.className = 'form-status notice-success';
}

expandedThreads.add(recordId);

window.setTimeout(() => {
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

function handleMainImagePreview() {
const file = imageFileInput && imageFileInput.files ? imageFileInput.files[0] : null;
if (!file) {
clearMainImagePreview();
return;
}

try {
validateImageFile(file);
showMainImagePreview(file);
setMainStatus('', '');
} catch (err) {
clearMainImagePreview();
setMainStatus(err.message, 'error');
}
}

function handleReplyImagePreview(e) {
const input = e.currentTarget;
const form = input.closest('.reply-form');
const recordId = form ? form.dataset.replyForm : '';
const file = input.files ? input.files[0] : null;
const statusEl = form ? form.querySelector(`[data-reply-status="${recordId}"]`) : null;

if (!recordId) return;

if (!file) {
clearReplyPreview(recordId);
return;
}

try {
validateImageFile(file);
showReplyPreview(recordId, file);
if (statusEl) {
statusEl.textContent = '';
statusEl.className = 'form-status';
}
} catch (err) {
clearReplyPreview(recordId);
if (statusEl) {
statusEl.textContent = err.message;
statusEl.className = 'form-status notice-error';
}
}
}

function showReplyPreview(recordId, file) {
const wrap = document.querySelector(`[data-reply-preview-wrap="${CSS.escape(recordId)}"]`);
const img = document.querySelector(`[data-reply-preview-img="${CSS.escape(recordId)}"]`);
if (!wrap || !img) return;

img.src = URL.createObjectURL(file);
wrap.classList.remove('is-hidden');
}

function clearReplyPreview(recordId) {
const form = document.querySelector(`[data-reply-form="${CSS.escape(recordId)}"]`);
const wrap = document.querySelector(`[data-reply-preview-wrap="${CSS.escape(recordId)}"]`);
const img = document.querySelector(`[data-reply-preview-img="${CSS.escape(recordId)}"]`);

if (form) {
const input = form.querySelector('input[name="image_file"]');
if (input) input.value = '';
}

if (img) img.src = '';
if (wrap) wrap.classList.add('is-hidden');
}

function handleReplyClearImage(e) {
const recordId = e.currentTarget.dataset.replyClearImage;
if (!recordId) return;
clearReplyPreview(recordId);
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
clearMainImagePreview();
updateCharCount();
}

if (toggleMainComposer) toggleMainComposer.addEventListener('click', showMainComposer);
if (cancelMainComposer) cancelMainComposer.addEventListener('click', hideMainComposer);
if (commentInput) commentInput.addEventListener('input', updateCharCount);
if (postForm) postForm.addEventListener('submit', submitPost);
if (refreshBtn) refreshBtn.addEventListener('click', () => fetchPosts());
if (imageFileInput) imageFileInput.addEventListener('change', handleMainImagePreview);
if (clearImageBtn) clearImageBtn.addEventListener('click', clearMainImagePreview);

updateCharCount();
fetchPosts(true);
window.setInterval(() => fetchPosts(true), LIVE_REFRESH_MS);
})();
