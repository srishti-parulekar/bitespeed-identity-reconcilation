import Joi from 'joi';

export const identifySchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .max(255)
    .optional()
    .messages({
      'string.email': 'Please provide a valid email address',
      'string.max': 'Email must be less than 255 characters'
    }),
  
  phoneNumber: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .max(20)
    .optional()
    .messages({
      'string.pattern.base': 'Please provide a valid phone number',
      'string.max': 'Phone number must be less than 20 characters'
    })
}).custom((value, helpers) => {
  // either can be provided
  if (!value.email && !value.phoneNumber) {
    return helpers.error('custom.atLeastOne');
  }
  return value;
}).messages({
  'custom.atLeastOne': 'At least one of email or phoneNumber must be provided!'
});

export const validateIdentifyRequest = (req, res, next) => {
  const { error, value } = identifySchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errorDetails = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    return res.status(400).json({
      error: 'Validation failed',
      details: errorDetails
    });
  }

  req.validatedData = value;
  next();
};