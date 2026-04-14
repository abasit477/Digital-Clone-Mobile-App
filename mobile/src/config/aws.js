import { CognitoUserPool } from "amazon-cognito-identity-js";
import { syncStorage } from "../utils/syncStorage";

export const cognitoConfig = {
  region: "us-east-1",
  userPoolId: "us-east-1_orFUeN52q",
  clientId: "78gtfs160lm6m8lvcdovj64krt",
};

// Uses syncStorage so that amazon-cognito-identity-js can call
// getItem() synchronously (AsyncStorage.getItem returns a Promise
// which the library cannot handle — it would treat the Promise
// object as the stored value and break SRP serialization).
export const userPool = new CognitoUserPool({
  UserPoolId: cognitoConfig.userPoolId,
  ClientId: cognitoConfig.clientId,
  Storage: syncStorage,
});

// Cognito Identity Pool — required for direct Bedrock access from the mobile app.
// Create an Identity Pool in the AWS Console, link it to the User Pool above,
// and grant the Authenticated role bedrock:InvokeModelWithResponseStream.
// Then replace the placeholder below with the real Identity Pool ID.
export const identityPoolId = "us-east-1:8fa0eb42-83d1-4fc9-b34d-570df63f9c3e";

export const configureAmplify = () => {};
