export default () => ({
  productionBuild: process.env.PRODUCTION_BUILD === 'true',
  hostname: `http://localhost:${process.env.PORT || 3000}`,
  port: parseInt(process.env.PORT, 10) || 3000,
  mongoCluster:
    process.env.PRODUCTION_BUILD === 'true'
      ? `mongodb://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOSTNAME}:${process.env.DB_PORT}/${process.env.DB_NAME}?authSource=${process.env.AUTH_SOURCE}`
      : (process.env.MONGO_URI || `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@test-softlab.ptacstn.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`),
  userJwtSecret: process.env.JWT_PRIVATE_KEY_USER,
  adminJwtSecret: process.env.JWT_PRIVATE_KEY_ADMIN,
  userTokenExpiredTime: 604800,
  adminTokenExpiredTime: 604800,

  // SSL PAYMENT CREDENTIALS
  STORE_ID: process.env.STORE_ID || 'Banglabazarbooks0live',
  STORE_PASSWORD: process.env.STORE_PASSWORD || '',

  // Gmail Api
  gmail: process.env.GMAIL_USER || 'contact.tee24@gmail.com',
  googleClientId1: process.env.GOOGLE_CLIENT_ID_1 || '',
  googleClientSecret1: process.env.GOOGLE_CLIENT_SECRET_1 || '',
  googleClientRedirectUrl: process.env.GOOGLE_CLIENT_REDIRECT_URL || 'https://developers.google.com/oauthplayground',
  googleRefreshToken1: process.env.GOOGLE_REFRESH_TOKEN_1 || '',

  // iSMS SSL
  api_token: process.env.ISMS_API_TOKEN || '',
  sid: process.env.ISMS_SID || 'Banglabazarbooks',
  SSL_SMS_API: process.env.SSL_SMS_API || 'https://smsplus.sslwireless.com/api/v3/send-sms',

  promoOfferSchedule: 'Promo_Offer_Schedule',
  promoOfferScheduleOnStart: 'Promo_Offer_Schedule_On_Start',
  promoOfferScheduleOnEnd: 'Promo_Offer_Schedule_On_End',
  smsSenderUsername: process.env.SMS_SENDER_USERNAME || '01781310241',
  smsSenderSecret: process.env.SMS_SENDER_SECRET || '',
  smsSenderPassword: process.env.SMS_SENDER_PASSWORD || '',
  smsSenderId: process.env.SMS_SENDER_ID || '8809648906672',
  dbAdminUsername: process.env.DB_ADMIN_USERNAME || '',
  dbAdminPassword: process.env.DB_ADMIN_PASSWORD || '',
  backupDB: process.env.DB_NAME,
  backupPath: './backup/db',
  restorePath: `./restore/${process.env.DB_NAME}`,

  // Back Up Config
  driveFolder: process.env.DRIVE_FOLDER || '1HzP7UXlS3j0fGDk502l1nRV5CbAMPsnE',
  // Google Oauth2 Config
  googleRedirectUrl: process.env.GOOGLE_REDIRECT_URL || 'https://developers.google.com/oauthplayground',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleRefreshToken: process.env.GOOGLE_REFRESH_TOKEN || '',
  accountGmail: process.env.ACCOUNT_GMAIL || 'softlabit.drive@gmail.com',
  publicBaseUrl:
    process.env.PUBLIC_API_URL ||
    (process.env.PRODUCTION_BUILD === 'true'
      ? 'https://ftp.banglabazarbooks.com/api'
      : ''),
  publicHost: process.env.PUBLIC_HOST || '',
  fileServerUrl: process.env.FILE_SERVER_URL || '',
  previewUploadSecret:
    process.env.PREVIEW_UPLOAD_SECRET || 'guardian-preview-upload-secret',
  previewImagesDir:
    process.env.PREVIEW_IMAGES_DIR ||
    (process.env.PRODUCTION_BUILD === 'true'
      ? '/home/ubuntu/WEB_APP/banglabazarbooks.com/FTP/upload/images'
      : ''),
  pdfFilesDir:
    process.env.PDF_FILES_DIR ||
    (process.env.PRODUCTION_BUILD === 'true'
      ? '/home/ubuntu/WEB_APP/banglabazarbooks.com/FTP/upload/files'
      : ''),

  // Bkash Payment Gateway
  bkashUrl:
    process.env.PRODUCTION_BUILD === 'true'
      ? 'https://tokenized.pay.bka.sh/v1.2.0-beta/tokenized/checkout'
      : 'https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout',
  bkashUsername:
    process.env.PRODUCTION_BUILD === 'true'
      ? (process.env.BKASH_USERNAME_PROD || '01521741585')
      : (process.env.BKASH_USERNAME_SANDBOX || '01770618567'),
  bkashPassword:
    process.env.PRODUCTION_BUILD === 'true'
      ? (process.env.BKASH_PASSWORD_PROD || '')
      : (process.env.BKASH_PASSWORD_SANDBOX || ''),
  bkashAppKey:
    process.env.PRODUCTION_BUILD === 'true'
      ? (process.env.BKASH_APP_KEY_PROD || '')
      : (process.env.BKASH_APP_KEY_SANDBOX || ''),
  bkashAppSecret:
    process.env.PRODUCTION_BUILD === 'true'
      ? (process.env.BKASH_APP_SECRET_PROD || '')
      : (process.env.BKASH_APP_SECRET_SANDBOX || ''),
  bkashRedirectUrlBase:
    process.env.PRODUCTION_BUILD === 'true'
      ? 'https://banglabazarbooks.com'
      : 'http://localhost:3002',
  bkashCallbackUrl:
    process.env.PRODUCTION_BUILD === 'true'
      ? 'https://api.banglabazarbooks.com/api/payment/callback-bkash-payment'
      : `http://localhost:${process.env.PORT || 3000}/api/payment/callback-bkash-payment`,
});
