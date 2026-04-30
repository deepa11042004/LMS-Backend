const multer = require('multer');

function errorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'Thumbnail file must be 10MB or smaller.' });
    }

    return res.status(400).json({ message: err.message || 'Invalid multipart upload payload.' });
  }

  if (err && Number.isInteger(err.status) && err.status >= 400 && err.status < 600) {
    return res.status(err.status).json({ message: err.message || 'Request failed.' });
  }

  console.error('Unhandled error:', err);
  return res.status(500).json({ message: 'Internal server error' });
}

module.exports = errorHandler;