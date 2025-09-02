// Initialize Socket.io
const socket = io();

// DOM elements
const boardTitle = document.getElementById('boardTitle');
const boardNumber = document.getElementById('boardNumber');
const participantCount = document.getElementById('participantCount');
const participantsList = document.getElementById('participantsList');
const initiativesList = document.getElementById('initiativesList');
const emptyState = document.getElementById('emptyState');

// Modals
const joinBoardModal = document.getElementById('joinBoardModal');
const errorModal = document.getElementById('errorModal');
const loadingSpinner = document.getElementById('loadingSpinner');

// Forms
const joinBoardForm = document.getElementById('joinBoardForm');

// Buttons
const startNewVoteBtn = document.getElementById('startNewVoteBtn');
const revealVotesBtn = document.getElementById('revealVotesBtn');
const closeErrorBtn = document.getElementById('closeErrorBtn');

// State
let currentBoardId = null;
let currentParticipantId = null;
let boardData = null;
let isCreator = false;
let isVoting = false; // Prevent multiple rapid votes

// Get board ID from URL
function getBoardIdFromUrl() {
    const path = window.location.pathname;
    const match = path.match(/\/board\/(\d{6})/);
    return match ? match[1] : null;
}

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
    document.getElementById('errorMessage').textContent = message;
    showModal(errorModal);
}

// API functions
async function fetchBoard(boardId) {
    const response = await fetch(`/api/boards/${boardId}`);
    if (!response.ok) {
        throw new Error('Board not found');
    }
    return response.json();
}

async function joinBoard(boardId, participantName) {
    const response = await fetch(`/api/boards/${boardId}/join`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ participantName })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to join board');
    }
    
    return response.json();
}

async function startNewVote(boardId) {
    const response = await fetch(`/api/boards/${boardId}/start-vote`, {
        method: 'POST'
    });
    
    if (!response.ok) {
        throw new Error('Failed to start new vote');
    }
    
    return response.json();
}

async function vote(boardId, initiativeId, size) {
    const response = await fetch(`/api/boards/${boardId}/initiatives/${initiativeId}/vote`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            participantId: currentParticipantId,
            size
        })
    });
    
    if (!response.ok) {
        throw new Error('Failed to submit vote');
    }
    
    return response.json();
}

async function revealVotes(boardId) {
    const response = await fetch(`/api/boards/${boardId}/reveal`, {
        method: 'POST'
    });
    
    if (!response.ok) {
        throw new Error('Failed to reveal votes');
    }
    
    return response.json();
}



// UI rendering functions
function renderParticipants() {
    if (!boardData || !boardData.participants) return;
    
    const participants = Object.values(boardData.participants);
    participantCount.textContent = `${participants.length} participant${participants.length !== 1 ? 's' : ''}`;
    
    // Calculate voting progress
    let totalVoted = 0;
    const totalParticipants = participants.length;
    
    participantsList.innerHTML = participants.map(participant => {
        // Check if this participant has voted on any initiative
        let hasVoted = false;
        let voteSize = '';
        
        if (boardData.initiatives && boardData.initiatives.length > 0) {
            for (const init of boardData.initiatives) {
                if (init.votes && init.votes[participant.id]) {
                    hasVoted = true;
                    voteSize = init.votes[participant.id].size;
                    break;
                }
            }
        }
        
        if (hasVoted) totalVoted++;
        
        const isCurrentUser = participant.id === currentParticipantId;
        const isCreator = participant.isCreator;
        
        return `
            <div class="participant-card ${hasVoted ? 'voted' : ''} ${isCurrentUser ? 'current-user' : ''} ${isCreator ? 'creator' : ''}">
                <div class="participant-info">
                    <div class="participant-name">
                        ${participant.name}${isCurrentUser ? ' (You)' : ''}${isCreator ? ' 👑' : ''}
                    </div>
                    <div class="participant-status">
                        ${hasVoted ? 
                            (boardData.votesRevealed ? `Voted: ${voteSize}` : '✓ Voted') : 
                            'Waiting to vote'
                        }
                    </div>
                </div>
                <div class="vote-indicator ${hasVoted ? 'voted' : 'not-voted'}">
                    ${hasVoted ? '✓' : '○'}
                </div>
            </div>
        `;
    }).join('');
    
    // Update voting progress
    const votingProgressEl = document.getElementById('votingProgress');
    if (votingProgressEl) {
        votingProgressEl.textContent = `${totalVoted}/${totalParticipants} voted`;
        if (totalVoted === totalParticipants && totalParticipants > 0) {
            votingProgressEl.style.color = '#38a169';
            votingProgressEl.style.fontWeight = '600';
        } else {
            votingProgressEl.style.color = '#4a5568';
            votingProgressEl.style.fontWeight = '500';
        }
    }
}

function renderInitiatives() {
    if (!boardData || !boardData.initiatives || boardData.initiatives.length === 0) {
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    
    initiativesList.innerHTML = boardData.initiatives.map(initiative => {
        const votes = initiative.votes || {};
        const userVote = votes[currentParticipantId];
        const voteCount = Object.keys(votes).length;
        const totalParticipants = Object.keys(boardData.participants).length;
        
        return `
            <div class="initiative-card">
                <div class="initiative-header">
                    <h4>${initiative.title}</h4>
                    ${initiative.description ? `<p>${initiative.description}</p>` : ''}
                    ${initiative.creator ? `<div class="initiative-creator">Proposed by: <strong>${initiative.creator}</strong></div>` : ''}
                </div>
                
                <div class="voting-section">
                    <div class="size-buttons">
                        ${['S', 'M', 'L', 'XL'].map(size => `
                            <button 
                                class="btn size-btn ${userVote?.size === size ? 'selected' : ''} ${boardData.votesRevealed ? `revealed ${size}` : ''}"
                                data-initiative-id="${initiative.id}" 
                                data-size="${size}"
                                ${boardData.votesRevealed ? 'disabled' : ''}
                            >
                                ${userVote?.size === size && !boardData.votesRevealed ? `${size} ✓` : size}
                            </button>
                        `).join('')}
                    </div>
                    
                    <div class="vote-status">
                        ${boardData.votesRevealed 
                            ? `All votes revealed` 
                            : `${voteCount}/${totalParticipants} voted`
                        }
                    </div>
                </div>
                
                ${boardData.votesRevealed ? renderVoteResults(initiative) : ''}
            </div>
        `;
    }).join('');
    
    // Event listeners are handled via delegation - no need to attach here
}

function renderVoteResults(initiative) {
    const votes = initiative.votes || {};
    const votesBySize = { S: [], M: [], L: [], XL: [] };
    
    Object.values(votes).forEach(vote => {
        votesBySize[vote.size].push(vote.participantName);
    });
    
    return `
        <div class="vote-results">
            <h5>Voting Results:</h5>
            <div class="votes-grid">
                ${['S', 'M', 'L', 'XL'].map(size => `
                    <div class="size-group ${size}">
                        <h6>${size} (${votesBySize[size].length})</h6>
                        <ul class="voter-list">
                            ${votesBySize[size].map(name => `<li>${name}</li>`).join('') || '<li style="opacity: 0.5;">No votes</li>'}
                        </ul>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function updateCreatorControls() {
    if (!boardData) return;
    
    // Show/hide creator controls
    if (isCreator) {
        const hasInitiatives = boardData.initiatives && boardData.initiatives.length > 0;
        const hasVotes = boardData.initiatives.some(init => 
            init.votes && Object.keys(init.votes).length > 0
        );
        
        // Show "Start New Vote" button if votes have been revealed or no votes yet
        startNewVoteBtn.style.display = boardData.votesRevealed || !hasVotes ? 'block' : 'none';
        
        // Show reveal button if there are votes and they haven't been revealed yet
        revealVotesBtn.style.display = hasVotes && !boardData.votesRevealed ? 'block' : 'none';
    } else {
        startNewVoteBtn.style.display = 'none';
        revealVotesBtn.style.display = 'none';
    }
}

// Event handlers
async function handleVote(e) {
    // Prevent multiple rapid clicks
    if (isVoting) {
        console.log('Vote already in progress, ignoring click');
        return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    const initiativeId = e.target.dataset.initiativeId;
    const size = e.target.dataset.size;
    
    console.log('Vote clicked:', { initiativeId, size, currentParticipantId, currentBoardId });
    
    if (!initiativeId || !size) {
        console.error('Missing initiative ID or size');
        showError('Invalid vote data');
        return;
    }
    
    if (!currentParticipantId) {
        console.error('No participant ID');
        showError('Please join the board first');
        return;
    }
    
    if (!currentBoardId) {
        console.error('No board ID');
        showError('Invalid board');
        return;
    }
    
    // Set voting flag to prevent duplicates
    isVoting = true;
    e.target.disabled = true; // Disable the button temporarily
    
    try {
        await vote(currentBoardId, initiativeId, size);
        console.log('Vote submitted successfully');
        
        // Update local board data immediately to show vote
        if (boardData && boardData.initiatives) {
            const initiative = boardData.initiatives.find(init => init.id === initiativeId);
            if (initiative) {
                if (!initiative.votes) initiative.votes = {};
                initiative.votes[currentParticipantId] = {
                    participantId: currentParticipantId,
                    participantName: boardData.participants[currentParticipantId]?.name || 'Unknown',
                    size: size,
                    votedAt: new Date()
                };
            }
        }
        
        // Update UI immediately to show the vote
        renderInitiatives();
        renderParticipants();
        updateCreatorControls();
        
    } catch (error) {
        console.error('Vote error:', error);
        showError(error.message);
    } finally {
        // Reset voting flag after a short delay
        setTimeout(() => {
            isVoting = false;
        }, 500);
    }
}

// Form submissions
joinBoardForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const participantName = document.getElementById('participantNameInput').value.trim();
    if (!participantName) {
        showError('Please enter your name');
        return;
    }
    
    try {
        showLoading();
        const result = await joinBoard(currentBoardId, participantName);
        currentParticipantId = result.participantId;
        
        // Store in localStorage
        localStorage.setItem('participantId', currentParticipantId);
        localStorage.setItem('participantName', participantName);
        localStorage.setItem('boardId', currentBoardId);
        localStorage.setItem('isCreator', 'false'); // Non-creators joining
        
        // Join socket room
        socket.emit('joinBoard', { boardId: currentBoardId, participantId: currentParticipantId });
        
        // Non-creators are not creators
        isCreator = false;
        
        hideLoading();
        hideModal(joinBoardModal);
        
        // Load board data
        await loadBoard();
    } catch (error) {
        hideLoading();
        showError(error.message);
    }
});

// Button handlers
startNewVoteBtn.addEventListener('click', async () => {
    try {
        await startNewVote(currentBoardId);
    } catch (error) {
        showError(error.message);
    }
});

revealVotesBtn.addEventListener('click', async () => {
    try {
        await revealVotes(currentBoardId);
    } catch (error) {
        showError(error.message);
    }
});

closeErrorBtn.addEventListener('click', () => {
    hideModal(errorModal);
});

// Close modals when clicking outside
errorModal.addEventListener('click', (e) => {
    if (e.target === errorModal) {
        hideModal(errorModal);
    }
});

// Socket event handlers
socket.on('participantJoined', ({ participant }) => {
    if (boardData) {
        boardData.participants[participant.id] = participant;
        renderParticipants();
    }
});

socket.on('initiativeAdded', ({ initiative }) => {
    if (boardData) {
        boardData.initiatives.push(initiative);
        renderInitiatives();
        updateCreatorControls();
    }
});

socket.on('voteSubmitted', ({ initiativeId, participantId, hasVoted, votesRevealed, board }) => {
    if (board) {
        boardData = board;
    }
    renderParticipants();
    renderInitiatives();
    updateCreatorControls();
});

socket.on('votesRevealed', ({ board }) => {
    boardData = board;
    renderInitiatives();
    renderParticipants();
    updateCreatorControls();
});

socket.on('newVoteStarted', ({ board }) => {
    boardData = board;
    renderInitiatives();
    renderParticipants();
    updateCreatorControls();
});

socket.on('votesReset', () => {
    if (boardData) {
        boardData.votesRevealed = false;
        boardData.initiatives.forEach(init => {
            init.votes = {};
        });
        renderInitiatives();
        renderParticipants();
        updateCreatorControls();
    }
});

// Load board function
async function loadBoard() {
    try {
        showLoading();
        boardData = await fetchBoard(currentBoardId);
        
        // Update UI
        boardTitle.textContent = boardData.title;
        boardNumber.textContent = currentBoardId;
        
        renderParticipants();
        renderInitiatives();
        updateCreatorControls();
        
        hideLoading();
    } catch (error) {
        hideLoading();
        showError(error.message);
    }
}

// Initialize board
async function initializeBoard() {
    currentBoardId = getBoardIdFromUrl();
    
    if (!currentBoardId) {
        showError('Invalid board URL');
        return;
    }
    
    // Check if user is already joined
    const storedParticipantId = localStorage.getItem('participantId');
    const storedBoardId = localStorage.getItem('boardId');
    const isStoredCreator = localStorage.getItem('isCreator') === 'true';
    
    if (storedParticipantId && storedBoardId === currentBoardId) {
        currentParticipantId = storedParticipantId;
        hideModal(joinBoardModal);
        
        // Join socket room
        socket.emit('joinBoard', { boardId: currentBoardId, participantId: currentParticipantId });
        
        // Set creator status
        isCreator = isStoredCreator;
        
        try {
            await loadBoard();
        } catch (error) {
            // If error, show join modal
            showModal(joinBoardModal);
        }
    } else {
        // Show join modal
        showModal(joinBoardModal);
        document.getElementById('participantNameInput').focus();
    }
}

// Event delegation for vote buttons
document.addEventListener('click', function(e) {
    if (e.target.matches('.size-btn:not([disabled])') && !boardData?.votesRevealed) {
        handleVote(e);
    }
});

// Initialize when page loads
window.addEventListener('load', initializeBoard);
