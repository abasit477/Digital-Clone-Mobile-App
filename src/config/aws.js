import { Amplify } from 'aws-amplify';

/**
 * AWS Amplify Configuration
 *
 * Replace the placeholder values below with your actual AWS Cognito credentials.
 * You can find these in the AWS Console → Cognito → User Pool → App Clients.
 *
 * IMPORTANT: Never commit real credentials to version control.
 * Use environment variables via expo-constants or a .env file (with expo-dotenv).
 */
const awsConfig = {
  Auth: {
    Cognito: {
      region: 'us-east-1',                          // e.g. 'us-east-1'
      userPoolId: 'us-east-1_XXXXXXXXX',            // e.g. 'us-east-1_AbCdEfGhI'
      userPoolClientId: 'XXXXXXXXXXXXXXXXXXXXXXXXXX', // e.g. '1a2b3c4d5e6f7g8h9i0j...'
      loginWith: {
        email: true,
      },
      signUpVerificationMethod: 'code',
      userAttributes: {
        email: {
          required: true,
        },
      },
      passwordFormat: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireNumbers: true,
        requireSpecialCharacters: false,
      },
    },
  },
};

export const configureAmplify = () => {
  Amplify.configure(awsConfig);
};

export default awsConfig;
