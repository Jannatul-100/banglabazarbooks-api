export default () => ({
  productionBuild: process.env.PRODUCTION_BUILD === 'true',
  hostname: `http://localhost:${process.env.PORT || 3000}`,
  port: parseInt(process.env.PORT, 10) || 3000,
  mongoCluster:
    process.env.PRODUCTION_BUILD === 'true'
      ? `mongodb://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOSTNAME}:${process.env.DB_PORT}/${process.env.DB_NAME}?authSource=${process.env.AUTH_SOURCE}`
      : `mongodb+srv://softlabit:M5LiBL43wpMtrEy9@test-softlab.ptacstn.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`,
  // mongoCluster: `mongodb://localhost:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  // mongoCluster: `mongodb+srv://softlabit:M5LiBL43wpMtrEy9@test-softlab.ptacstn.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`,
  userJwtSecret: process.env.JWT_PRIVATE_KEY_USER,
  adminJwtSecret: process.env.JWT_PRIVATE_KEY_ADMIN,
  userTokenExpiredTime: 604800,
  adminTokenExpiredTime: 604800,

  // SSL PAYMENT CREDENTIALS
  STORE_ID: 'Banglabazarbooks0live',
  STORE_PASSWORD: '65C9FA62BE06836215',
  // STORE_ID: 'testbox',
  // STORE_PASSWORD: 'qwerty', 

  // Gmail Api
  gmail: 'contact.tee24@gmail.com',
  googleClientId1:
    '512308839711-28b3nld6pl4m4u5nbti96iqnc1nk00fp.apps.googleusercontent.com',
  googleClientSecret1: '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',
  googleClientRedirectUrl: 'https://developers.google.com/oauthplayground',
  googleRefreshToken1:
    '1//04_8qMYSyOp1vCgYIARAAGAQSNwF-L9IrlYOcOO_Zq5Udy4ENmxlAx-Hq0c6dXArXkNGZ7xRZayuiBC22tWmrJOzyjs2Lmxm_R28',

  // iSMS SSL
  api_token: 'z4r4xk1w-mimzoqkz-4gzjceyh-4xojungi-fnqcxo49',
  sid: 'Banglabazarbooks',
  SSL_SMS_API: 'https://smsplus.sslwireless.com/api/v3/send-sms',

  promoOfferSchedule: 'Promo_Offer_Schedule',
  promoOfferScheduleOnStart: 'Promo_Offer_Schedule_On_Start',
  promoOfferScheduleOnEnd: 'Promo_Offer_Schedule_On_End',
  smsSenderUsername: '01781310241',
  // smsSenderSecret: 'C200032065f01a6a427279.06759627',
  smsSenderSecret: 'bkYlm6yhhQM1haZd7jfJ',
  smsSenderPassword: 'YV6H7B8N443',
  // smsSenderId: 'GuardianPub',
  smsSenderId: '8809648906672',
  dbAdminUsername: 'ikbalsazib11',
  dbAdminPassword: 'IKBALsazib11',
  backupDB: process.env.DB_NAME,
  backupPath: './backup/db',
  restorePath: `./restore/${process.env.DB_NAME}`,

  // Back Up Config
  driveFolder: '1HzP7UXlS3j0fGDk502l1nRV5CbAMPsnE',
  // Google Oauth2 Config
  googleRedirectUrl: 'https://developers.google.com/oauthplayground',
  googleClientId:
    '23922428634-gg6mvr1qnbucbicgronh0ii67kplemn0.apps.googleusercontent.com',
  googleClientSecret: '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',
  googleRefreshToken:
    '1//04pvQHjbzuCmLCgYIARAAGAQSNwF-L9Irh0V61NXGh4Zawa0A9MX_zsLQSO1n8jyn610KUQxFF0V-xcduxcJ_genZpPTA1R2VT6A',
  accountGmail: 'softlabit.drive@gmail.com',
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
      ? '01521741585'
      : '01770618567',
  bkashPassword:
    process.env.PRODUCTION_BUILD === 'true'
      ? '>_kgl0w+C!q'
      : 'D7DaC<*E*eG',
  bkashAppKey:
    process.env.PRODUCTION_BUILD === 'true'
      ? 'jnukZDteHjmtw0dQLTEGYm02tc'
      : '0vWQuCRGiUX7EPVjQDr0EUAYtc',
  bkashAppSecret:
    process.env.PRODUCTION_BUILD === 'true'
      ? 'YjQ5qAqCG74WFEUUCmZqMerYbcV0E5XBMpYH5vIKvWMhsgAVQ3As'
      : 'jcUNPBgbcqEDedNKdvE4G1cAK7D3hCjmJccNPZZBq96QIxxwAMEx',
  bkashRedirectUrlBase:
    process.env.PRODUCTION_BUILD === 'true'
      ? 'https://banglabazarbooks.com'
      : 'http://localhost:3002',
  bkashCallbackUrl:
    process.env.PRODUCTION_BUILD === 'true'
      ? 'https://api.banglabazarbooks.com/api/payment/callback-bkash-payment'
      : `http://localhost:${process.env.PORT || 3000}/api/payment/callback-bkash-payment`,
});
