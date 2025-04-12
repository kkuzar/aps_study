import express, { Request, Response, Router } from 'express';
import multer from 'multer';
import {config} from '../config';
import {
    ossClient,
    modelDerivativeClient,
    ensureBucketExists,
    startTranslationJob,
    getTranslationStatus,
    encodeURN, getInternalToken
} from '../services/aps';
import { Job } from '@aps_sdk/model-derivative'; // Re-export

const router: Router = express.Router();
const upload = multer({ dest: 'uploads/' }); // Configure temporary storage

// GET /api/auth/token - Provides a token for the viewer
router.get('/auth/token', async (req: Request, res: Response, next) => {
    try {
        res.json(await getInternalToken());
    } catch (err) {
        next(err);
    }
});

// POST /api/upload - Uploads the RVT file to OSS
// @ts-ignore
router.post('/upload', upload.single('rvtFile'), async (req: Request, res: Response, next) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const bucketKey = config.aps.bucketKey;
    const objectKey = req.file.originalname; // Use original filename as object key
    const filePath = req.file.path;

    try {
        await ensureBucketExists(bucketKey); // Make sure bucket exists
        console.log(`Uploading ${objectKey} to bucket ${bucketKey}`);

        // Use the OssClient's upload method
        const objectDetails = await ossClient.uploadObject(bucketKey, objectKey, filePath);

        console.log(`Upload successful for ${objectKey}. Object ID: ${objectDetails.objectId}`);
        res.json({
            message: 'Upload successful',
            urn: objectDetails.objectId, // Return the OSS URN (Object ID)
            objectKey: objectKey
        });
    } catch (err) {
        console.error("Upload error:", err);
        next(err); // Pass error to error handling middleware
    } finally {
        // Clean up temporary file
        const fs = require('fs').promises;
        try {
            await fs.unlink(filePath);
        } catch (unlinkErr) {
            console.error("Error deleting temp file:", unlinkErr);
        }
    }
});

// POST /api/translate - Starts the RVT to IFC translation job
// @ts-ignore
router.post('/translate', async (req: Request, res: Response, next) => {
    const { urn } = req.body; // Get URN from request body

    if (!urn) {
        return res.status(400).send('Missing required URN in request body.');
    }

    try {
        const job: Job = await startTranslationJob(urn);
        res.status(202).json({ message: 'Translation job started successfully.', jobInfo: job });
        // Note: Status checking will be handled via Socket.IO polling started here or elsewhere
    } catch (err) {
        console.error("Translation start error:", err);
        next(err);
    }
});

// GET /api/translate/status - Endpoint for manual polling (alternative to Socket.IO)
// @ts-ignore
router.get('/translate/status', async (req: Request, res: Response, next) => {
    const urn = req.query.urn as string;

    if (!urn) {
        return res.status(400).send('Missing required URN query parameter.');
    }

    try {
        const status = await getTranslationStatus(urn);
        res.json(status);
    } catch (err) {
        console.error("Translation status error:", err);
        next(err);
    }
});

// GET /api/download/ifc - Gets a signed URL for the IFC derivative
// @ts-ignore
router.get('/download/ifc', async (req: Request, res: Response, next) => {
    const urn = req.query.urn as string; // URN of the *source* RVT file

    if (!urn) {
        return res.status(400).send('Missing required URN query parameter.');
    }

    try {
        const status = await getTranslationStatus(urn); // Check status first

        if (status.status !== 'success' || !status.ifcUrn) {
            return res.status(404).send('IFC derivative not found or not ready.');
        }

        console.log(`Getting download URL for IFC derivative: ${status.ifcUrn}`);
        // Note: getDerivativeUrl expects the *derivative* URN
        const downloadInfo = await modelDerivativeClient.getDerivativeUrl(status.ifcUrn, encodeURN(urn)); // Pass source URN too

        console.log('Redirecting to download URL:', downloadInfo.url);
        // Redirect the client to the signed S3 URL
        res.json({url:downloadInfo.url});

    } catch (err) {
        console.error("IFC download error:", err);
        next(err);
    }
});


export default router;