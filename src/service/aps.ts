// src/services/aps.ts
import {
    LogLevel,
    SdkManager,
    SdkManagerBuilder,
    StaticAuthenticationProvider,
    twoLeggedToken,
    Logger // Import Logger if you use it directly, otherwise SdkManagerBuilder handles it
} from '@aps_sdk/autodesk-sdkmanager';
import { AuthenticationClient } from '@aps_sdk/authentication';
import { OssClient, Region as OssRegion } from '@aps_sdk/oss'; // Import Region specifically if needed, alias if names clash
import {
    ModelDerivativeClient,
    JobPayload,
    JobPayloadInput,
    JobPayloadOutput,
    JobPayloadFormat,
    OutputType,
    JobPayloadFormatSVF2,
    View,
    JobPayloadFormatIFC,
    Manifest,
    Region as MdRegion, // Alias Region from Model Derivative if needed
    Job
} from '@aps_sdk/model-derivative';
import {config} from '../config';

// --- SDK Manager Setup ---
const sdkManager: SdkManager = SdkManagerBuilder.create()
    // .addLogger(new Logger(LogLevel.INFO)) // Example: Add logger if needed
    .build();

// --- Authentication ---
const authClient = new AuthenticationClient({sdkManager:sdkManager});
let internalTokenProvider: IAuthenticationProvider | null = null; // Corrected type


export async function getInternalToken(): Promise<any> { // Corrected return type
    if (!internalTokenProvider ) {
        console.log('Fetching/Refreshing internal token...');
        const token = await authClient.getTwoLeggedToken(
            config.aps.clientId,
            config.aps.clientSecret,
            config.aps.token_2Legged_scopes
        );
        // Assuming StaticAuthenticationProvider implements IAuthenticationProvider correctly
        console.log('Internal token obtained/refreshed.', token);
        return token;

    }
    return internalTokenProvider;
}

// export async function getInternalToken() {
//     const provider = await getInternalTokenProvider();
//     return {
//         access_token: await provider.getAccessToken(),
//         expires_in: provider.getExpiresIn(), // Assuming getExpiresIn exists on your provider
//     };
// }

// // --- OSS Client ---
// // Pass the provider factory function directly
// export const ossClient = new OssClient({
//     sdkManager,
//     authenticationProvider: { getAccessToken: async () => (await getInternalToken()).access_token }
// });
//
// // --- Model Derivative Client ---
// // Pass the provider factory function directly
// export const modelDerivativeClient = new ModelDerivativeClient({
//     sdkManager,
//     authenticationProvider: { getAccessToken: async () => (await getInternalToken()).access_token }
// });

// --- Helper Functions ---
export function encodeURN(urn: string): string {
    // Ensure the input is not already encoded (simple check)
    if (urn.startsWith('dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6')) {
        console.warn(`URN ${urn} might already be encoded. Using as is.`);
        return urn;
    }
    return Buffer.from(urn).toString('base64url');
}

// export async function ensureBucketExists(bucketKey: string): Promise<void> {
//     try {
//         console.log(`Checking if bucket ${bucketKey} exists...`);
//         await ossClient.getBucketDetails(bucketKey);
//         console.log(`Bucket ${bucketKey} already exists.`);
//     } catch (error: any) {
//         if (error.axiosError?.response?.status === 404) {
//             console.log(`Bucket ${bucketKey} not found, creating...`);
//             await ossClient.createBucket(OssRegion.Us, { // Use OssRegion or your desired region
//                 bucketKey: bucketKey,
//                 policyKey: 'transient', // Or temporary/persistent
//             });
//             console.log(`Bucket ${bucketKey} created.`);
//         } else {
//             console.error(`Error checking/creating bucket ${bucketKey}:`, error.message || error);
//             if (error.axiosError?.response?.data) {
//                 console.error("Error details:", error.axiosError.response.data);
//             }
//             throw error;
//         }
//     }
// }

// export async function startTranslationJob(urn: string): Promise<Job> {
//     const encodedUrn = encodeURN(urn);
//
//     const ifcFormat: JobPayloadFormatIFC = {
//         type: OutputType.Ifc,
//     };
//
//     const svfFormat: JobPayloadFormatSVF2 = {
//         type: OutputType.Svf2,
//         views: [View._2d, View._3d]
//     };
//
//     const jobPayload: JobPayload = {
//         input: {
//             urn: encodedUrn,
//         },
//         output: {
//             formats: [ifcFormat, svfFormat]
//         },
//     };
//
//     console.log(`Starting translation job for URN: ${urn} (Encoded: ${encodedUrn})`);
//     const job = await modelDerivativeClient.startJob(jobPayload, {
//         // xAdsForce: true
//     });
//     console.log('Translation job started:', job);
//     return job;
// }
//
// export async function getTranslationStatus(urn: string): Promise<{ status: string; progress: string; ifcUrn: string | null }> {
//     const encodedUrn = encodeURN(urn);
//     try {
//         const manifest: Manifest = await modelDerivativeClient.getManifest(encodedUrn);
//         console.log(`Manifest status for ${urn}: ${manifest.status}, Progress: ${manifest.progress}`);
//
//         let ifcDerivativeStatus = 'pending';
//         let ifcDerivativeProgress = '0%';
//         let ifcUrn: string | null = null;
//
//         const ifcDerivative = manifest.derivatives.find(d => d.outputType === OutputType.Ifc);
//
//         if (ifcDerivative) {
//             ifcDerivativeStatus = ifcDerivative.status;
//             ifcDerivativeProgress = ifcDerivative.progress;
//             if (ifcDerivative.children) {
//                 const ifcResource = ifcDerivative.children.find(c => c.role === 'ifc' || c.urn?.endsWith('.ifc'));
//                 if (ifcResource) {
//                     ifcUrn = ifcResource.urn;
//                 }
//             }
//             console.log(`IFC Derivative status: ${ifcDerivativeStatus}, Progress: ${ifcDerivativeProgress}, URN: ${ifcUrn}`);
//         } else {
//             console.log(`IFC derivative not found in manifest yet for ${urn}. Overall status: ${manifest.status}`);
//             ifcDerivativeStatus = manifest.status;
//             ifcDerivativeProgress = manifest.progress;
//         }
//
//         return {
//             status: ifcDerivativeStatus,
//             progress: ifcDerivativeProgress,
//             ifcUrn: ifcUrn
//         };
//     } catch (error: any) {
//         if (error.axiosError?.response?.status === 404) {
//             console.log(`Manifest not found for ${urn}. Translation likely not started or failed early.`);
//             return { status: 'notfound', progress: '0%', ifcUrn: null };
//         }
//         console.error(`Error getting manifest for ${urn}:`, error.message || error);
//         if (error.axiosError?.response?.data) {
//             console.error("Error details:", error.axiosError.response.data);
//         }
//         return { status: 'error', progress: 'Error fetching manifest', ifcUrn: null };
//     }
// }