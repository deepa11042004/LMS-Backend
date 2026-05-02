const express = require('express');

const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');
const roles = require('../constants/roles');

const router = express.Router();

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login user and return JWT token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: secret123
 *               requiredRole:
 *                 type: string
 *                 enum: [user, admin, instructor, super_admin]
 *                 description: Optional role restriction for login validation.
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Validation error
 *       401:
 *         description: Invalid password
 *       403:
 *         description: Account disabled or role not authorized
 *       404:
 *         description: User not found
 */
router.post('/login', authController.login);

/**
 * @openapi
 * /auth/profile:
 *   get:
 *     tags: [Auth]
 *     summary: Get currently authenticated user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile fetched successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.get('/profile', authMiddleware, authController.profile);

/**
 * @openapi
 * /auth/profile:
 *   put:
 *     tags: [Auth]
 *     summary: Update currently authenticated user profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               phone:
 *                 type: string
 *               city:
 *                 type: string
 *               institution:
 *                 type: string
 *               bio:
 *                 type: string
 *               profilePictureUrl:
 *                 type: string
 *               notificationEmail:
 *                 type: boolean
 *               notificationWorkshopUpdates:
 *                 type: boolean
 *               notificationMarketing:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.put('/profile', authMiddleware, authController.updateProfile);

/**
 * @openapi
 * /auth/instructor-profile:
 *   get:
 *     tags: [Auth]
 *     summary: Get instructor/admin profile settings for dashboard
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Instructor profile fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
router.get(
  '/instructor-profile',
  authMiddleware,
  requireRole(roles.ADMIN, roles.SUPER_ADMIN, roles.INSTRUCTOR),
  authController.getInstructorProfile
);

/**
 * @openapi
 * /auth/instructor-profile:
 *   put:
 *     tags: [Auth]
 *     summary: Update instructor/admin profile settings for dashboard
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [displayName, email, designation, alternativeEmail]
 *             properties:
 *               displayName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               designation:
 *                 type: string
 *               alternativeEmail:
 *                 type: string
 *                 format: email
 *               bio:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Instructor profile updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
router.put(
  '/instructor-profile',
  authMiddleware,
  requireRole(roles.ADMIN, roles.SUPER_ADMIN, roles.INSTRUCTOR),
  authController.updateInstructorProfile
);

/**
 * @openapi
 * /auth/instructors:
 *   get:
 *     tags: [Auth]
 *     summary: List active instructors for instructor_id selection in admin course creation
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Instructors fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/instructors',
  authMiddleware,
  requireRole(roles.ADMIN, roles.SUPER_ADMIN),
  authController.listAssignableInstructors
);

/**
 * @openapi
 * /auth/admin-only:
 *   get:
 *     tags: [Auth]
 *     summary: Verify admin or super admin role access
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Access granted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/admin-only', authMiddleware, requireRole(roles.ADMIN, roles.SUPER_ADMIN), (req, res) => {
  res.status(200).json({ message: 'Admin access granted' });
});

/**
 * @openapi
 * /auth/instructor-only:
 *   get:
 *     tags: [Auth]
 *     summary: Verify instructor or super admin role access
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Access granted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/instructor-only', authMiddleware, requireRole(roles.INSTRUCTOR, roles.SUPER_ADMIN), (req, res) => {
  res.status(200).json({ message: 'Instructor access granted' });
});

module.exports = router;