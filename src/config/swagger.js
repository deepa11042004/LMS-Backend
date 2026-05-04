const swaggerJSDoc = require('swagger-jsdoc');

const PORT = Number(process.env.PORT) || 5000;

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'LMS Backend API',
      version: '1.0.0',
      description: 'Role-based login API for LMS using the shared users table.',
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Local development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    tags: [
      {
        name: 'Auth',
        description: 'Authentication and role-protected endpoints',
      },
      {
        name: 'Courses',
        description: 'Workshop CRUD endpoints backed by lms_core_db.courses',
      },
      {
        name: 'Modules',
        description: 'Course module management endpoints backed by lms_core_db.modules',
      },
      {
        name: 'Lessons',
        description: 'Module lesson management endpoints backed by lms_core_db.lessons',
      },
      {
        name: 'Enrollments',
        description: 'Course access management endpoints backed by lms_core_db.enrollments',
      },
      {
        name: 'Payments',
        description: 'Payment order and verification endpoints backed by lms_core_db.payments',
      },
    ],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;