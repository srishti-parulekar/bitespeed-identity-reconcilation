import { Prisma } from '@prisma/client';

export const errorHandler = (err, req, res, next) => {
  console.error('Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    timestamp: new Date().toISOString(),
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        return res.status(409).json({
          error: 'Conflict',
          message: 'A record with this data already exists',
          field: err.meta?.target
        });
      case 'P2025':
        return res.status(404).json({
          error: 'Not Found',
          message: 'The requested record was not found'
        });
      case 'P2003':
        return res.status(400).json({
          error: 'Foreign Key Constraint',
          message: 'Invalid reference to related record'
        });
      case 'P2011':
        return res.status(400).json({
          error: 'Null Constraint Violation',
          message: 'Required field cannot be null'
        });
      default:
        return res.status(400).json({
          error: 'Database Error',
          message: 'A database error occurred',
          code: err.code
        });
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid data provided to database'
    });
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    return res.status(503).json({
      error: 'Database Connection Error',
      message: 'Unable to connect to database'
    });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Payload Too Large',
      message: 'Request payload exceeds size limit'
    });
  }

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'Invalid JSON',
      message: 'Request body contains invalid JSON'
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = statusCode === 500 
    ? (process.env.NODE_ENV === 'development' ? err.message : 'Internal server error')
    : err.message;

  res.status(statusCode).json({
    error: err.name || 'Internal Server Error',
    message,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
    timestamp: new Date().toISOString()
  });
};
