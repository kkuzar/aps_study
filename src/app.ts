import express, {Request, Response} from 'express';
import http from 'http';
import {Server} from 'socket.io';
import path from 'path';
import {registerSocketHandlers} from "./handlers/socketHandler";
import {getInternalToken} from "./services/aps";
import router from "./routes/aps.routes";

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

app.use('/api', router);
app.use(express.static(path.join(__dirname, './', 'public')));
app.get('/favicon.ico', (req: Request, res: Response) => {
    res.status(204).end()
    return
})


app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({status: 'UP', timestamp: new Date().toISOString()});
});

export {app, httpServer, initServer};