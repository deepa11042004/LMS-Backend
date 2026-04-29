require('dotenv').config();

const app = require('./src/app');
const db = require('./src/config/db');

const PORT = Number(process.env.PORT) || 5000;

async function start() {
  try {
    if (!process.env.JWT_SECRET) {
      console.error('Missing JWT_SECRET environment variable');
      process.exit(1);
    }

    const authConnection = await db.authDB.getConnection();
    await authConnection.ping();
    authConnection.release();

    const lmsConnection = await db.lmsDB.getConnection();
    await lmsConnection.ping();
    lmsConnection.release();

    console.log('MySQL connected (auth + lms schemas)');

    const server = app.listen(PORT, () => {
      console.log(`LMS backend running on port ${PORT}`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Stop the existing process or change PORT.`);
      } else {
        console.error('Server listen error:', err);
      }
      process.exit(1);
    });
  } catch (err) {
    console.error('Startup error:', err);
    process.exit(1);
  }
}

start();