# T-Shirt Sizing Tool

A collaborative estimation tool for agile teams to vote on initiative sizes using T-shirt sizing methodology (S, M, L, XL).

## Features

- **Create Boards**: Create estimation sessions with unique board numbers and shareable links
- **Join Boards**: Join boards using 6-digit board numbers or shareable links
- **Add Initiatives**: Add stories/initiatives that need to be estimated
- **Vote**: Vote on initiatives using T-shirt sizes (S, M, L, XL)
- **Real-time Updates**: See participants join and vote in real-time
- **Reveal Votes**: Board creators can reveal all votes simultaneously (planning poker style)
- **Reset Rounds**: Start new estimation rounds with the same initiatives

## How to Use

### 1. Creating a Board

1. Visit the application homepage
2. Fill in the "Create New Board" form:
   - **Board Title**: Name your estimation session
   - **Your Name**: Enter your name as the board creator
3. Click "Create Board"
4. You'll get a 6-digit board number and shareable link
5. Share these with your team members

### 2. Joining a Board

Team members can join in two ways:

**Option A: Using Board Number**
1. Visit the homepage
2. Enter the 6-digit board number
3. Enter your name
4. Click "Join Board"

**Option B: Using Shareable Link**
1. Click the shareable link provided by the board creator
2. Enter your name when prompted
3. You'll be automatically joined to the board

### 3. Adding Initiatives

Only board creators can add initiatives:
1. Click "Add Initiative" button
2. Enter the initiative title and optional description
3. The initiative will appear for all participants to vote on

### 4. Voting

1. Each initiative shows S, M, L, XL buttons
2. Click your size estimate for each initiative
3. You can change your vote until votes are revealed
4. Other participants will see that you've voted but not your actual vote

### 5. Revealing Votes

Board creators can reveal votes:
1. Wait for all participants to vote
2. Click "Reveal Votes" button
3. All votes become visible to everyone
4. Results show how many people voted for each size

### 6. New Rounds

After discussing revealed votes:
1. Board creator can click "New Round"
2. All votes are cleared
3. Participants can vote again on the same initiatives

## T-Shirt Sizing Guide

- **S (Small)**: Quick, simple tasks (few hours to 1 day)
- **M (Medium)**: Moderate complexity (1-3 days)
- **L (Large)**: Complex tasks (1-2 weeks)
- **XL (Extra Large)**: Very complex, should be broken down (2+ weeks)

## Technical Details

### Installation

```bash
npm install
```

### Running the Application

```bash
npm start
```

The application will be available at `http://localhost:3000`

### Development

```bash
npm run dev  # Runs with nodemon for auto-restart
```

### Technologies Used

- **Backend**: Node.js, Express.js, Socket.io
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Real-time**: WebSocket connections via Socket.io
- **Storage**: In-memory (can be upgraded to database)

### API Endpoints

- `POST /api/boards` - Create new board
- `GET /api/boards/:boardId` - Get board information
- `POST /api/boards/:boardId/join` - Join board
- `POST /api/boards/:boardId/initiatives` - Add initiative
- `POST /api/boards/:boardId/initiatives/:initiativeId/vote` - Submit vote
- `POST /api/boards/:boardId/reveal` - Reveal all votes
- `POST /api/boards/:boardId/reset` - Reset votes for new round

## Board Numbers

- Boards are identified by 6-digit numbers (100000-999999)
- Numbers are randomly generated and unique
- Boards persist in memory for the duration of the server session

## Browser Support

- Modern browsers with WebSocket support
- Mobile responsive design
- Clipboard API support for easy link sharing

## Security Notes

- No authentication required (suitable for internal team use)
- Board data is stored in server memory
- Boards are accessible to anyone with the board number/link

## Future Enhancements

- Database persistence
- User authentication
- Board history and analytics
- Export results to CSV/PDF
- Custom sizing scales
- Timer functionality
- Anonymous voting mode

## License

MIT License - Feel free to modify and use for your team's needs.
