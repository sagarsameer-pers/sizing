const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(express.json());

// CORS configuration for Railway deployment
app.use((req, res, next) => {
    // More permissive CORS for development and Railway deployment
    const origin = req.headers.origin;
    
    // Allow localhost for development and Railway domains for production
    if (!origin || 
        origin.includes('localhost') || 
        origin.includes('127.0.0.1') ||
        origin.includes('.up.railway.app') ||
        origin.includes('.railway.app')) {
        res.header('Access-Control-Allow-Origin', origin || '*');
    }
    
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', true);
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    next();
});

app.use(express.static('public'));

// Request logging middleware for debugging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Catch-all for unsupported methods/routes
app.use('*', (req, res, next) => {
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

// In-memory storage (in production, use a database)
const boards = new Map();
const boardSockets = new Map(); // Track which sockets are in which boards

// Generate a 6-digit board ID
function generateBoardId() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Board creation
app.post('/api/boards', (req, res) => {
    const { title, creatorName } = req.body;
    const boardId = generateBoardId();
    const creatorParticipantId = uuidv4();
    
    const board = {
        id: boardId,
        title: title || 'T-shirt Sizing Session',
        creatorName: creatorName || 'Anonymous',
        creatorParticipantId: creatorParticipantId,
        createdAt: new Date(),
        initiatives: [],
        participants: new Map(),
        votesRevealed: false,
        votingActive: false
    };
    
    // Add creator as first participant
    board.participants.set(creatorParticipantId, {
        id: creatorParticipantId,
        name: creatorName || 'Anonymous',
        joinedAt: new Date(),
        isCreator: true
    });
    
    // Create default initiative
    const { v4: uuidv4Internal } = require('uuid');
    const defaultInitiative = {
        id: uuidv4Internal(),
        title: board.title,
        description: 'T-shirt size estimation for this initiative',
        creator: board.creatorName,
        votes: new Map(),
        createdAt: new Date()
    };
    
    board.initiatives.push(defaultInitiative);
    
    boards.set(boardId, board);
    
    res.json({
        boardId,
        creatorParticipantId,
        shareableLink: `${req.protocol}://${req.get('host')}/board/${boardId}`
    });
});

// Get board information
app.get('/api/boards/:boardId', (req, res) => {
    const { boardId } = req.params;
    const board = boards.get(boardId);
    
    if (!board) {
        return res.status(404).json({ error: 'Board not found' });
    }
    
    // Convert participants Map and initiative votes Maps to objects for JSON response
    const boardData = {
        ...board,
        participants: Object.fromEntries(board.participants),
        initiatives: board.initiatives.map(init => ({
            ...init,
            votes: Object.fromEntries(init.votes)
        }))
    };
    
    res.json(boardData);
});

// Join board
app.post('/api/boards/:boardId/join', (req, res) => {
    const { boardId } = req.params;
    const { participantName } = req.body;
    const board = boards.get(boardId);
    
    console.log('Join board request:', { boardId, participantName });
    
    if (!board) {
        console.log('Board not found for join:', boardId);
        return res.status(404).json({ error: 'Board not found' });
    }
    
    const participantId = uuidv4();
    board.participants.set(participantId, {
        id: participantId,
        name: participantName || 'Anonymous',
        joinedAt: new Date(),
        isCreator: false
    });
    
    console.log('Participant joined:', { participantId, name: participantName });
    
    // Notify other participants
    io.to(boardId).emit('participantJoined', {
        participant: board.participants.get(participantId)
    });
    
    res.json({ participantId });
});

// Add initiative to board
app.post('/api/boards/:boardId/initiatives', (req, res) => {
    const { boardId } = req.params;
    const { title, description, creator } = req.body;
    const board = boards.get(boardId);
    
    if (!board) {
        return res.status(404).json({ error: 'Board not found' });
    }
    
    const initiative = {
        id: uuidv4(),
        title: title || 'Untitled Initiative',
        description: description || '',
        creator: creator || '',
        votes: new Map(),
        createdAt: new Date()
    };
    
    board.initiatives.push(initiative);
    
    // Notify all participants
    io.to(boardId).emit('initiativeAdded', { initiative: {
        ...initiative,
        votes: Object.fromEntries(initiative.votes)
    }});
    
    res.json({ initiative });
});

// Vote on initiative
app.post('/api/boards/:boardId/initiatives/:initiativeId/vote', (req, res) => {
    const { boardId, initiativeId } = req.params;
    const { participantId, size } = req.body;
    
    // Vote request received
    
    const board = boards.get(boardId);
    
    if (!board) {
        console.log('Board not found:', boardId);
        return res.status(404).json({ error: 'Board not found' });
    }
    
    const initiative = board.initiatives.find(i => i.id === initiativeId);
    if (!initiative) {
        console.log('Initiative not found:', initiativeId);
        return res.status(404).json({ error: 'Initiative not found' });
    }
    
    const participant = board.participants.get(participantId);
    if (!participant) {
        console.log('Participant not found:', participantId);
        console.log('Available participants:', Array.from(board.participants.keys()));
        return res.status(404).json({ error: 'Participant not found' });
    }
    
    if (!['S', 'M', 'L', 'XL'].includes(size)) {
        console.log('Invalid size:', size);
        return res.status(400).json({ error: 'Invalid size. Must be S, M, L, or XL' });
    }
    
    initiative.votes.set(participantId, {
        participantId,
        participantName: participant.name,
        size,
        votedAt: new Date()
    });
    
    // Vote recorded
    
    // Notify all participants about the vote (without revealing the actual vote unless revealed)
    const boardData = {
        ...board,
        participants: Object.fromEntries(board.participants),
        initiatives: board.initiatives.map(init => ({
            ...init,
            votes: Object.fromEntries(init.votes)
        }))
    };
    
    io.to(boardId).emit('voteSubmitted', {
        initiativeId,
        participantId,
        participantName: participant.name,
        hasVoted: true,
        votesRevealed: board.votesRevealed,
        board: boardData
    });
    
    res.json({ success: true });
});

// Reveal votes
app.post('/api/boards/:boardId/reveal', (req, res) => {
    const { boardId } = req.params;
    const board = boards.get(boardId);
    
    if (!board) {
        return res.status(404).json({ error: 'Board not found' });
    }
    
    board.votesRevealed = true;
    
    // Send all votes to participants
    const boardData = {
        ...board,
        participants: Object.fromEntries(board.participants),
        initiatives: board.initiatives.map(init => ({
            ...init,
            votes: Object.fromEntries(init.votes)
        }))
    };
    
    io.to(boardId).emit('votesRevealed', { board: boardData });
    
    res.json({ success: true });
});

// Start new voting session
app.post('/api/boards/:boardId/start-vote', (req, res) => {
    const { boardId } = req.params;
    const board = boards.get(boardId);
    
    if (!board) {
        return res.status(404).json({ error: 'Board not found' });
    }
    
    // Reset all votes and start new voting session
    board.votesRevealed = false;
    board.votingActive = true;
    board.initiatives.forEach(initiative => {
        initiative.votes.clear();
    });
    
    io.to(boardId).emit('newVoteStarted', {
        board: {
            ...board,
            participants: Object.fromEntries(board.participants),
            initiatives: board.initiatives.map(init => ({
                ...init,
                votes: Object.fromEntries(init.votes)
            }))
        }
    });
    
    res.json({ success: true });
});

// Reset votes for new round (legacy endpoint - same as start-vote)
app.post('/api/boards/:boardId/reset', (req, res) => {
    const { boardId } = req.params;
    const board = boards.get(boardId);
    
    if (!board) {
        return res.status(404).json({ error: 'Board not found' });
    }
    
    board.votesRevealed = false;
    board.votingActive = true;
    board.initiatives.forEach(initiative => {
        initiative.votes.clear();
    });
    
    io.to(boardId).emit('newVoteStarted', {
        board: {
            ...board,
            participants: Object.fromEntries(board.participants),
            initiatives: board.initiatives.map(init => ({
                ...init,
                votes: Object.fromEntries(init.votes)
            }))
        }
    });
    
    res.json({ success: true });
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    socket.on('joinBoard', ({ boardId, participantId }) => {
        socket.join(boardId);
        
        if (!boardSockets.has(boardId)) {
            boardSockets.set(boardId, new Set());
        }
        boardSockets.get(boardId).add(socket.id);
        
        console.log(`Socket ${socket.id} joined board ${boardId}`);
    });
    
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        // Remove socket from all boards
        for (const [boardId, sockets] of boardSockets.entries()) {
            sockets.delete(socket.id);
            if (sockets.size === 0) {
                boardSockets.delete(boardId);
            }
        }
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0'
    });
});

// API status endpoint
app.get('/api/status', (req, res) => {
    res.status(200).json({
        status: 'ok',
        boards: boards.size,
        connections: Array.from(boardSockets.values()).reduce((total, sockets) => total + sockets.size, 0)
    });
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve board page
app.get('/board/:boardId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'board.html'));
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
    console.log(`T-shirt sizing tool server running on ${HOST}:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
