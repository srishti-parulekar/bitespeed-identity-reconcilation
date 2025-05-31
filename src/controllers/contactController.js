import contactService from '../services/contactService.js';

class ContactController {
  //main endpoint
  async identify(req, res) {
    try {
      const { email, phoneNumber } = req.validatedData;
      
      const result = await contactService.identifyContact(email, phoneNumber);
      
      res.status(200).json(result);
    } catch (error) {
      console.error('Error in identify endpoint:', error);
      
      // prima errors!
      if (error.code === 'P2002') {
        return res.status(400).json({
          error: 'Constraint violation',
          message: 'Duplicate data detected'
        });
      }
      
      if (error.code === 'P2025') {
        return res.status(404).json({
          error: 'Record not found',
          message: 'Contact not found'
        });
      }
      
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' 
          ? error.message 
          : 'Something went wrong'
      });
    }
  }

  //helth check
  async health(req, res) {
    try {
      const healthStatus = await contactService.healthCheck();
      
      const status = healthStatus.status === 'healthy' ? 200 : 503;
      
      res.status(status).json({
        ...healthStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0'
      });
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        database: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

//root endpoint with API information
  async root(req, res) {
    res.json({
      service: 'Bitespeed Identity Reconciliation API',
      version: '1.0.0',
      endpoints: {
        identify: 'POST /identify',
        health: 'GET /health'
      },
      documentation: 'https://github.com/yourusername/bitespeed-backend-task'
    });
  }
}

export default new ContactController();