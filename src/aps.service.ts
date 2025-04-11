// // src/aps.ts
// import { AuthenticationClient, Scopes, TwoLeggedAuthentication } from '@aps_sdk/authentication';
// import { OssClient } from '@aps_sdk/oss';
// import { ModelDerivativeClient } from '@aps_sdk/model-derivative';
// import dotenv from 'dotenv';
//
// dotenv.config();
//
// const { APS_CLIENT_ID, APS_CLIENT_SECRET } = process.env;
//
// if (!APS_CLIENT_ID || !APS_CLIENT_SECRET) {
//     throw new Error('Missing APS_CLIENT_ID or APS_CLIENT_SECRET in .env file');
// }
//
// const authScopes: Scopes[] = [
//     'data:read',
//     'data:write',
//     'data:create',
//     'bucket:read',
//     'bucket:create',
//     'code:all' // Required for Model Derivative jobs
// ];
//
// const authClient = new AuthenticationClient();
// const ossClient = new OssClient();
// const modelDerivativeClient = new ModelDerivativeClient();
//
// let internalAuth: TwoLeggedAuthentication | null = null;
// let publicAuth: TwoLeggedAuthentication | null = null;
//
// // Function to get internal token (more permissions)
// export async function getInternalToken(): Promise<TwoLeggedAuthentication> {
//     if (!internalAuth || internalAuth.isExpired()) {
//         internalAuth = await authClient.authenticate(APS_CLIENT_ID!, APS_CLIENT_SECRET!, authScopes);
//         console.log("Generated new Internal APS Token");
//     }
//     return internalAuth;
// }
//
// // Function to get public token (fewer permissions, e.g., just for viewing/downloading if needed)
// // For this example, we'll just reuse the internal token for simplicity,
// // but in a real app you might want separate tokens with fewer scopes.
// export async function getPublicToken(): Promise<TwoLeggedAuthentication> {
//     // For simplicity, reuse internal token. Adjust scopes if needed for production.
//     return getInternalToken();
// }
//
//
// export { authClient, ossClient, modelDerivativeClient };