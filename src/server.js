import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import routes from './routes/contactRoutes.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { generalLimiter } from './middlewares/rateLimiter.js';

dotenv.config();

let server;

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

const corsOptions = {
  origin: process.env.CORS_ORIGIN === '*' 
    ? true 
    : process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};
app.use(cors(corsOptions));

app.use(express.json({ 
  limit: '10mb',
  strict: true
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

if (process.env.NODE_ENV !== 'test') {
  const morganFormat = process.env.NODE_ENV === 'development' 
    ? 'dev' 
    : 'combined';
  app.use(morgan(morganFormat));
}

app.use(generalLimiter);

app.set('trust proxy', 1);

app.use('/', routes);

app.use(notFoundHandler);

app.use(errorHandler);

const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. starting graceful shutdown...`);
  
  // const server = app.listen(PORT);
  
  server.close(async () => {
    console.log('HTTP server closed.');
    
    try {
      const { default: prisma } = await import('./config/prisma.js');
      await prisma.$disconnect();
      console.log('database connections closed.');
      
      console.log('graceful shutdown completed.');
      process.exit(0);
    } catch (error) {
      console.error('error during graceful shutdown:', error);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.log('force shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // not calling gracefulShutdown here during development
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // not calling gracefulShutdown here during development
});

const startServer = async () => {
  try {
    console.log('Starting server...');
    const { default: prisma } = await import('./config/prisma.js');
    console.log('Prisma imported successfully');
    await prisma.$connect();
    console.log('database connected successfully :D');
    
    server = app.listen(PORT, () => {
      console.log(`server running on port ${PORT}`);
      console.log(`environment: ${process.env.NODE_ENV}`);
      console.log(`health check: http://localhost:${PORT}/health`);
      console.log(`identify endpoint: http://localhost:${PORT}/identify`);
    });
    
    console.log('Server setup complete');
    
  } catch (error) {
    console.error('failed to start server:', error);
    process.exit(1);
  }
};

startServer();
