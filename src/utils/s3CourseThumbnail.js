const crypto = require('crypto');
const path = require('path');
const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const MIME_EXTENSION_MAP = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const DEFAULT_COURSE_THUMBNAIL_PREFIX = 'courses/thumbnails';

let cachedClient = null;
let cachedRegion = null;

const createHttpError = (message, status = 500) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const getRequiredS3Config = () => {
  const region = String(process.env.AWS_REGION || '').trim();
  const bucket = String(process.env.AWS_S3_BUCKET || '').trim();
  const courseThumbnailPrefix = normalizeKeyPrefix(process.env.AWS_S3_COURSE_THUMBNAIL_PREFIX);

  if (!region || !bucket) {
    throw createHttpError('S3 configuration is missing. Set AWS_REGION and AWS_S3_BUCKET.', 500);
  }

  return { region, bucket, courseThumbnailPrefix };
};

const normalizeKeyPrefix = (value) => {
  const raw = String(value || '').trim().replace(/\\/g, '/');
  const cleaned = raw.replace(/^\/+|\/+$/g, '');

  return cleaned || DEFAULT_COURSE_THUMBNAIL_PREFIX;
};

const getS3Client = (region) => {
  if (cachedClient && cachedRegion === region) {
    return cachedClient;
  }

  const hasStaticCredentials =
    Boolean(process.env.AWS_ACCESS_KEY_ID) && Boolean(process.env.AWS_SECRET_ACCESS_KEY);

  const credentials = hasStaticCredentials
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined;

  cachedClient = new S3Client({
    region,
    credentials,
  });

  cachedRegion = region;

  return cachedClient;
};

const resolveExtension = (originalName, contentType) => {
  if (MIME_EXTENSION_MAP[contentType]) {
    return MIME_EXTENSION_MAP[contentType];
  }

  const extension = path.extname(String(originalName || '')).toLowerCase();
  if (ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
    return extension === '.jpeg' ? '.jpg' : extension;
  }

  return '.jpg';
};

const buildPublicUrl = (bucket, region, key) => {
  const encodedKey = encodeURIComponent(key).replace(/%2F/g, '/');
  return `https://${bucket}.s3.${region}.amazonaws.com/${encodedKey}`;
};

async function uploadCourseThumbnail({ buffer, contentType, originalName }) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw createHttpError('Thumbnail file is empty.', 400);
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.has(contentType)) {
    throw createHttpError('Thumbnail must be a JPG, PNG, WEBP, or GIF image.', 400);
  }

  const { region, bucket, courseThumbnailPrefix } = getRequiredS3Config();
  const s3Client = getS3Client(region);

  const extension = resolveExtension(originalName, contentType);
  const key = `${courseThumbnailPrefix}/course-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return {
    key,
    url: buildPublicUrl(bucket, region, key),
  };
}

module.exports = {
  ALLOWED_IMAGE_MIME_TYPES,
  uploadCourseThumbnail,
};
