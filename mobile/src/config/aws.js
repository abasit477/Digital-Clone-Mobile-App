import { CognitoUserPool } from 'amazon-cognito-identity-js';
import { syncStorage } from '../utils/syncStorage';

export const cognitoConfig = {
  region:     'us-east-1',
  userPoolId: 'us-east-1_orFUeN52q',
  clientId:   '78gtfs160lm6m8lvcdovj64krt',
};

// Uses syncStorage so that amazon-cognito-identity-js can call
// getItem() synchronously (AsyncStorage.getItem returns a Promise
// which the library cannot handle — it would treat the Promise
// object as the stored value and break SRP serialization).
export const userPool = new CognitoUserPool({
  UserPoolId: cognitoConfig.userPoolId,
  ClientId:   cognitoConfig.clientId,
  Storage:    syncStorage,
});

export const configureAmplify = () => {};
