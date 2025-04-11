import express, {Request, Response} from 'express';
import http from 'http';
import {Server} from 'socket.io';
import path from 'path';
import {registerSocketHandlers} from "./handlers/socketHandler";
import {getInternalToken} from "./service/aps";

const app = express();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    }
});

// io.use(async (socket, next) => {
//     console.log("Middleware: Attempting authentication for socket:", socket.id); // Added log
//     const userId = await authenticateSocket(socket); // Use the auth service
//     if (!userId) {
//         console.log(`Middleware: Authentication failed for socket ${socket.id}. Rejecting.`); // Added log
//         return next(new Error('Authentication failed'));
//     }
//     // *** CHANGE HERE: Use socket.data ***
//     socket.data.userId = userId;
//     console.log(`Middleware: Authentication successful for socket ${socket.id}. UserID: ${userId}. Attached to socket.data.userId.`); // Updated log
//     next(); // Allow connection
// });

const initServer = async () => {
    registerSocketHandlers(io)
};

app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.use(express.static(path.join(__dirname, './', 'public')));

app.get('/api/auth/token', async function (req, res, next) {
    try {
        // res.json(await getViewerToken());
        res.json(await getInternalToken());
    } catch (err) {
        next(err);
    }
});


app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({status: 'UP', timestamp: new Date().toISOString()});
});

export {app, httpServer, initServer};