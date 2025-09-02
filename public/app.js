// DOM elements
const createBoardForm = document.getElementById('createBoardForm');
const joinBoardForm = document.getElementById('joinBoardForm');
const successModal = document.getElementById('successModal');
const errorModal = document.getElementById('errorModal');
const loadingSpinner = document.getElementById('loadingSpinner');

// Modal elements
const boardNumberEl = document.getElementById('boardNumber');
const shareableLinkEl = document.getElementById('shareableLink');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const goToBoardBtn = document.getElementById('goToBoardBtn');
const closeErrorBtn = document.getElementById('closeErrorBtn');
const errorMessageEl = document.getElementById('errorMessage');

// Current board data
let currentBoardId = null;

// Utility functions
function showLoading() {
    loadingSpinner.style.display = 'flex';
}

function hideLoading() {
    loadingSpinner.style.display = 'none';
}

function showModal(modal) {
    modal.style.display = 'flex';
}

function hideModal(modal) {
    modal.style.display = 'none';
}

function showError(message) {
    errorMessageEl.textContent = message;
    showModal(errorModal);
}

// API functions
async function createBoard(title, creatorName) {
    const response = await fetch('/api/boards', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            title,
            creatorName
        })
    });

    if (!response.ok) {
        throw new Error('Failed to create board');
    }

    return response.json();
}

async function joinBoard(boardId, participantName) {
    const response = await fetch(`/api/boards/${boardId}/join`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            participantName
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to join board');
    }

    return response.json();
}

// Event handlers
createBoardForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('boardTitle').value;
    const creatorName = document.getElementById('creatorName').value;
    
    if (!title.trim() || !creatorName.trim()) {
        showError('Please fill in all fields');
        return;
    }
    
    try {
        showLoading();
        const result = await createBoard(title.trim(), creatorName.trim());
        
        currentBoardId = result.boardId;
        boardNumberEl.textContent = result.boardId;
        shareableLinkEl.value = result.shareableLink;
        
        // Store creator information
        localStorage.setItem('participantId', result.creatorParticipantId);
        localStorage.setItem('participantName', creatorName.trim());
        localStorage.setItem('boardId', result.boardId);
        localStorage.setItem('isCreator', 'true');
        
        hideLoading();
        showModal(successModal);
    } catch (error) {
        hideLoading();
        showError(error.message);
    }
});

joinBoardForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const boardId = document.getElementById('boardId').value;
    const participantName = document.getElementById('participantName').value;
    
    if (!boardId.trim() || !participantName.trim()) {
        showError('Please fill in all fields');
        return;
    }
    
    if (boardId.trim().length !== 6 || !/^\d+$/.test(boardId.trim())) {
        showError('Board number must be 6 digits');
        return;
    }
    
    try {
        showLoading();
        await joinBoard(boardId.trim(), participantName.trim());
        
        // Store participant info in localStorage
        localStorage.setItem('participantName', participantName.trim());
        localStorage.setItem('boardId', boardId.trim());
        
        // Redirect to board
        window.location.href = `/board/${boardId.trim()}`;
    } catch (error) {
        hideLoading();
        showError(error.message);
    }
});

// Modal button handlers
copyLinkBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(shareableLinkEl.value);
        copyLinkBtn.textContent = 'Copied!';
        copyLinkBtn.style.background = '#48bb78';
        
        setTimeout(() => {
            copyLinkBtn.textContent = 'Copy';
            copyLinkBtn.style.background = '';
        }, 2000);
    } catch (error) {
        // Fallback for browsers that don't support clipboard API
        shareableLinkEl.select();
        shareableLinkEl.setSelectionRange(0, 99999);
        document.execCommand('copy');
        
        copyLinkBtn.textContent = 'Copied!';
        copyLinkBtn.style.background = '#48bb78';
        
        setTimeout(() => {
            copyLinkBtn.textContent = 'Copy';
            copyLinkBtn.style.background = '';
        }, 2000);
    }
});

goToBoardBtn.addEventListener('click', () => {
    if (currentBoardId) {
        window.location.href = `/board/${currentBoardId}`;
    }
});

closeErrorBtn.addEventListener('click', () => {
    hideModal(errorModal);
});

// Close modals when clicking outside
successModal.addEventListener('click', (e) => {
    if (e.target === successModal) {
        hideModal(successModal);
    }
});

errorModal.addEventListener('click', (e) => {
    if (e.target === errorModal) {
        hideModal(errorModal);
    }
});

// Handle URL board links
window.addEventListener('load', () => {
    const path = window.location.pathname;
    const boardMatch = path.match(/\/board\/(\d{6})/);
    
    if (boardMatch) {
        const boardId = boardMatch[1];
        // Redirect to board page if we're on the main page but have a board URL
        window.location.href = `/board/${boardId}`;
    }
});

// Auto-focus first input
document.getElementById('boardTitle').focus();
