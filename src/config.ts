import dotenv from 'dotenv';
import {Scopes} from "@aps_sdk/authentication";

dotenv.config();

export const config = {
    mongoUri: process.env.MONGO_URI || 'mongodb://mongodb:mongodb@mongo:27017/aps',
    aps: {
        clientId: process.env.APS_CLIENT_ID!,
        clientSecret: process.env.APS_CLIENT_SECRET!,
        bucketKey: process.env.APS_BUCKET_KEY!,
        // Required scopes for this workflow
        scopes: [
            Scopes.BucketCreate,
            Scopes.BucketRead,
            Scopes.DataRead,
            Scopes.DataWrite,
            Scopes.DataCreate,
            Scopes.ViewablesRead // Scope needed for viewer token
        ],
        token_2Legged_scopes: [ // Scopes for server-side operations
            Scopes.BucketCreate,
            Scopes.BucketRead,
            Scopes.DataRead,
            Scopes.DataWrite,
            Scopes.DataCreate,
            Scopes.CodeAll // Scope needed for translation job
        ]
    },
    port: process.env.PORT || 3000,
};

// Basic validation
if (!config.aps.clientId || !config.aps.clientSecret || !config.aps.bucketKey) {
    console.error('Missing APS_CLIENT_ID, APS_CLIENT_SECRET, or APS_BUCKET_KEY in .env file.');
    process.exit(1);
}