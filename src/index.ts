import {httpServer, initServer} from "./app";
import { config } from './config'
// import mongoose from "mongoose";
import {cleanupSocketPolls} from "./handlers/socketHandler";

const startServer = async () => {
    try {

        await initServer();

        httpServer.listen(config.port, () => {
            console.log(`Listening on port ${config.port}`);
        });

    } catch (err: unknown) {
        console.error('Failed to init server',err);
        process.exit(1);
    }
};

startServer().catch((err: unknown) => {
    console.error('Failed to start server',err);
    process.exit(1);
});


const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
signals.forEach(signal => {
    process.on(signal, () => {
        console.log(`\nReceived ${signal}. Shutting down gracefully...`);
        // cleanupSocketPolls()
        httpServer.close(() => {
            console.log('HTTP server closed.');
            // mongoose.connection.close(false).then(() => {
            //     console.log('MongoDB connection closed.');
            //     process.exit(0);
            // }).catch(err => {
            //     console.error('Error closing MongoDB connection:', err);
            //     process.exit(1);
            // });
            // Close Redis clients if they were created and connected
            // (The redis adapter might handle this, but explicit closing is safer)
            // Example: pubClient.quit(); subClient.quit();
        });

        setTimeout(() => {
            console.error('Could not close connections in time, forcing shutdown.');
            process.exit(1);
        }, 10000); // 10 seconds timeout
    });
});