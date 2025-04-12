import { Server as SocketIOServer, Socket } from 'socket.io';
import { getTranslationStatus, getInternalToken } from '../services/aps'; // Import status checker and token helper

// Store active polling intervals by URN. This map lives within this module's scope.
const activePolls: Map<string, NodeJS.Timeout> = new Map();

/**
 * Initializes Socket.IO event listeners and handlers.
 * @param io The Socket.IO server instance.
 */
export function registerSocketHandlers(io: SocketIOServer): void {

    io.on('connection', (socket: Socket) => {
        console.log(`Socket Handler: Client connected: ${socket.id}`);

        socket.on('disconnect', () => {
            console.log(`Socket Handler: Client disconnected: ${socket.id}`);
            // Optional: Add logic here if you need to clean up specific resources
            // when a particular socket disconnects, though polling is URN-based.
        });

        // Client requests to start monitoring a translation job
        socket.on('monitor-translation', (urn: string) => {
            console.log(`Socket Handler: Client ${socket.id} requested monitoring for URN: ${urn}`);
            if (!urn) {
                console.warn(`Socket Handler: Invalid URN received from ${socket.id}:`, urn);
                // Optionally emit an error back to the specific client
                // socket.emit('translation-error', { urn: urn, message: 'Invalid URN provided.' });
                return;
            }

            socket.join(urn); // Join a room specific to this URN
            console.log(`Socket Handler: Client ${socket.id} joined room ${urn}`);

            // Start polling if not already started for this URN
            if (!activePolls.has(urn)) {
                console.log(`Socket Handler: Starting polling for URN: ${urn}`);

                const pollInterval = 500; // Poll every 5 seconds
                let pollFailures = 0;
                const maxPollFailures = 3; // Stop polling after 3 consecutive errors

                const intervalId = setInterval(async () => {
                    try {
                        // Ensure token is fresh for polling
                        await getInternalToken(); // Refreshes if necessary

                        const status = await getTranslationStatus(urn);
                        console.log(`Socket Handler: Polling status for ${urn}:`, status);
                        pollFailures = 0; // Reset failure count on success

                        // Emit status to all clients interested in this URN
                        io.to(urn).emit('translation-status', { urn, ...status });

                        // Stop polling if job is complete or failed/timed out
                        if (status.status === 'success' || status.status === 'failed' || status.status === 'timeout') {
                            console.log(`Socket Handler: Stopping polling for URN: ${urn} (Status: ${status.status})`);
                            clearInterval(intervalId);
                            activePolls.delete(urn);
                        }
                    } catch (pollError: any) {
                        pollFailures++;
                        console.error(`Socket Handler: Error polling status for ${urn} (Attempt ${pollFailures}/${maxPollFailures}):`, pollError.message || pollError);
                        // Optionally emit an error status to the client room
                        io.to(urn).emit('translation-status', { urn, status: 'error', progress: `Error polling (${pollFailures})`, ifcUrn: null });

                        if (pollFailures >= maxPollFailures) {
                            console.error(`Socket Handler: Stopping polling for URN: ${urn} due to too many consecutive errors.`);
                            clearInterval(intervalId);
                            activePolls.delete(urn);
                        }
                    }
                }, pollInterval);

                activePolls.set(urn, intervalId);

                // Handle potential cleanup if socket disconnects while polling is active
                // This part is tricky because multiple sockets might monitor the same URN.
                // A simple approach is to let polling continue until completion/failure,
                // regardless of individual client disconnections.
                // If you *must* stop polling when the *last* client disconnects,
                // you'd need more complex logic involving checking room sizes on disconnect.
                socket.on('disconnect', () => {
                    console.log(`Socket Handler: Client ${socket.id} disconnected while potentially monitoring ${urn}`);
                    // Example cleanup (if needed when last client leaves):
                    // setTimeout(() => { // Delay check slightly
                    //     const room = io.sockets.adapter.rooms.get(urn);
                    //     if ((!room || room.size === 0) && activePolls.has(urn)) {
                    //         console.log(`Socket Handler: Last client for ${urn} disconnected, stopping polling.`);
                    //         clearInterval(activePolls.get(urn)!);
                    //         activePolls.delete(urn);
                    //     }
                    // }, 1000); // Adjust delay as needed
                });

            } else {
                console.log(`Socket Handler: Polling already active for URN: ${urn}. Client ${socket.id} added to room.`);
                // Send current status immediately to the newly joined client
                getTranslationStatus(urn)
                    .then(status => socket.emit('translation-status', { urn, ...status })) // Emit only to the requesting socket
                    .catch(err => console.error("Socket Handler: Error sending initial status:", err));
            }
        });

        // Add other socket event listeners here if needed
    });
}

/**
 * Cleans up any active polling intervals. Call this on server shutdown.
 */
export function cleanupSocketPolls(): void {
    console.log('Socket Handler: Cleaning up active polling intervals...');
    activePolls.forEach((intervalId, urn) => {
        clearInterval(intervalId);
        console.log(`Socket Handler: Stopped polling for URN: ${urn}`);
    });
    activePolls.clear();
}