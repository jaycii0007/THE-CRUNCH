const app = require('./app');

// default port 5000 to match frontend proxy, but allow override
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use.`);
    console.error(
      `A backend instance is already running at http://localhost:${PORT}. Stop it first or run with a different PORT.`,
    );
    process.exit(0);
    return;
  }

  throw err;
});

// Log unhandled promise rejections and uncaught exceptions to help debugging
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err && err.stack ? err.stack : err);
});