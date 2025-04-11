import { Server, Socket } from 'socket.io';

const userSockets = new Map<string, string>(); // Map: userId (_id) -> socketId

export const registerSocketHandlers = (io: Server) => {

    io.on('connection', async (socket: Socket) => {
        console.log(`Socket connected: ${socket.id}`);
        socket.emit('yourSocketId', socket.id);

        socket.on('disconnect', (reason) => {});
    });
};