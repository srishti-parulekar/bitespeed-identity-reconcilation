import express from 'express';
import contactController from '../controllers/contactController.js';
import { validateIdentifyRequest } from '../validators/contactValidator.js';
import { identifyLimiter, healthLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

// root
router.get('/', contactController.root);

// helth 
router.get('/health', healthLimiter, contactController.health);

// main
router.post('/identify', identifyLimiter, validateIdentifyRequest, contactController.identify);

export default router;