/**
 * bedrockService
 * Calls AWS Bedrock via the Converse Stream API — same API the backend uses.
 *
 * Auth flow:
 *   1. Get Cognito ID token from amazon-cognito-identity-js session
 *   2. Exchange for temporary IAM credentials via Identity Pool
 *   3. Call BedrockRuntime ConverseStream with Nova Pro
 */
import {
  CognitoIdentityClient,
  GetIdCommand,
  GetCredentialsForIdentityCommand,
} from '@aws-sdk/client-cognito-identity';
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';

import { userPool, cognitoConfig, identityPoolId } from '../config/aws';

const REGION    = 'us-east-1';
const MODEL_ID  = 'us.amazon.nova-pro-v1:0';
const LOGIN_KEY = `cognito-idp.${REGION}.amazonaws.com/${cognitoConfig.userPoolId}`;

const TAG = '[bedrockService]';

// ── Auth helpers ──────────────────────────────────────────────────────────────

function getIdToken() {
  return new Promise((resolve, reject) => {
    console.log(TAG, 'getIdToken: looking up current user...');
    const user = userPool.getCurrentUser();
    if (!user) {
      console.error(TAG, 'getIdToken: no current user in pool');
      return reject(new Error('No signed-in user found.'));
    }
    console.log(TAG, 'getIdToken: found user:', user.getUsername());
    user.getSession((err, session) => {
      if (err) {
        console.error(TAG, 'getIdToken: getSession error:', err);
        return reject(err);
      }
      if (!session?.isValid()) {
        console.error(TAG, 'getIdToken: session invalid');
        return reject(new Error('Cognito session is invalid.'));
      }
      const token = session.getIdToken().getJwtToken();
      console.log(TAG, 'getIdToken: OK, token length:', token?.length);
      resolve(token);
    });
  });
}

async function getAwsCredentials(idToken) {
  console.log(TAG, 'getAwsCredentials: identityPoolId:', identityPoolId);
  const identityClient = new CognitoIdentityClient({ region: REGION });

  console.log(TAG, 'getAwsCredentials: calling GetId...');
  let IdentityId;
  try {
    const res = await identityClient.send(new GetIdCommand({
      IdentityPoolId: identityPoolId,
      Logins: { [LOGIN_KEY]: idToken },
    }));
    IdentityId = res.IdentityId;
    console.log(TAG, 'getAwsCredentials: IdentityId:', IdentityId);
  } catch (err) {
    console.error(TAG, 'getAwsCredentials: GetId FAILED:', err?.name, err?.message);
    throw err;
  }

  console.log(TAG, 'getAwsCredentials: calling GetCredentialsForIdentity...');
  let Credentials;
  try {
    const res = await identityClient.send(new GetCredentialsForIdentityCommand({
      IdentityId,
      Logins: { [LOGIN_KEY]: idToken },
    }));
    Credentials = res.Credentials;
    console.log(TAG, 'getAwsCredentials: credentials OK, expiry:', Credentials?.Expiration);
  } catch (err) {
    console.error(TAG, 'getAwsCredentials: GetCredentialsForIdentity FAILED:', err?.name, err?.message);
    throw err;
  }

  return {
    accessKeyId:     Credentials.AccessKeyId,
    secretAccessKey: Credentials.SecretKey,
    sessionToken:    Credentials.SessionToken,
    expiration:      Credentials.Expiration,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Stream a response via Bedrock Converse Stream API.
 *
 * @param {string}   systemPrompt  - Persona / context prompt
 * @param {Array}    messages      - [{ role, content }, ...] plain text format
 * @param {Function} onChunk       - Called with each text delta string
 * @returns {Promise<string>}      - Full response text
 */
export async function streamCloneResponse(systemPrompt, messages, onChunk) {
  console.log(TAG, '─── streamCloneResponse START ───');
  console.log(TAG, 'messages count:', messages.length);

  let idToken, credentials;

  try {
    idToken = await getIdToken();
  } catch (err) {
    console.error(TAG, 'STEP 1 FAILED (getIdToken):', err?.message);
    throw err;
  }

  try {
    credentials = await getAwsCredentials(idToken);
  } catch (err) {
    console.error(TAG, 'STEP 2 FAILED (getAwsCredentials):', err?.message);
    throw err;
  }

  console.log(TAG, 'STEP 3: building Bedrock client, model:', MODEL_ID);
  const client = new BedrockRuntimeClient({ region: REGION, credentials });

  // Converse API format: content is array of { text } objects
  const converseMessages = messages.map(m => ({
    role: m.role,
    content: [{ text: m.content }],
  }));

  const command = new ConverseCommand({
    modelId: MODEL_ID,
    system:  [{ text: systemPrompt }],
    messages: converseMessages,
    inferenceConfig: { maxTokens: 1024, temperature: 0.7 },
  });

  console.log(TAG, 'STEP 4: sending Converse...');
  let response;
  try {
    response = await client.send(command);
    console.log(TAG, 'STEP 4: got response');
  } catch (err) {
    console.error(TAG, 'STEP 4 FAILED (Converse):', err?.name, err?.message);
    throw err;
  }

  const fullText = response?.output?.message?.content?.[0]?.text ?? '';
  console.log(TAG, 'STEP 5: done, chars:', fullText.length);

  // Deliver the full response as a single chunk
  if (fullText) onChunk(fullText);

  return fullText;
}
