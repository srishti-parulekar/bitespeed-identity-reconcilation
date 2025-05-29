export const errorHandler = (err, req, res, next) => {
    
    //for development, remove later!!
    console.error('Error:', err);

    // if db conn failed
    if (err.code === 'ECONNREFUSED') {
        return res.status(503).json({
            error: 'Database connection failed',
            message: 'Service temporarily unavailable'
        });
    }

    // pg db constraint errors
    if (err.code && err.code.startsWith('23')) {
        return res.status(400).json({
            error: 'Database constraint violation',
            message: 'Invalid data provided'
        });
    }

    // every other error
    res.status(500).json({
        error: 'Internal server error',
        //error is visible for the dev env only; not in prod
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
};