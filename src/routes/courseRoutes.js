const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');

const courseController = require('../controllers/courseController');
const moduleController = require('../controllers/moduleController');
const lessonController = require('../controllers/lessonController');
const authMiddleware = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');
const roles = require('../constants/roles');

const router = express.Router();

const uploadsDir = path.join(process.cwd(), 'uploads', 'courses');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname || '').slice(0, 10);
    cb(null, `course-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

/**
 * @openapi
 * /api/courses:
 *   get:
 *     tags: [Courses]
 *     summary: List published courses for public consumption
 *     responses:
 *       200:
 *         description: Courses fetched successfully
 */
router.get('/courses', courseController.listCourses);

/**
 * @openapi
 * /api/admin/courses:
 *   get:
 *     tags: [Courses]
 *     summary: List all courses (draft + published) for admin usage
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Courses fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/admin/courses',
  authMiddleware,
  requireRole(roles.ADMIN, roles.SUPER_ADMIN, roles.INSTRUCTOR),
  courseController.listAdminCourses
);

/**
 * @openapi
 * /api/courses:
 *   post:
 *     tags: [Courses]
 *     summary: Create course in courses table as draft (JSON)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, slug, instructor_id]
 *             properties:
 *               title:
 *                 type: string
 *               slug:
 *                 type: string
 *               subtitle:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               level:
 *                 type: string
 *                 enum: [Beginner, Intermediate, Advanced]
 *               language:
 *                 type: string
 *               price:
 *                 type: number
 *               discount_price:
 *                 type: number
 *               currency:
 *                 type: string
 *               is_paid:
 *                 type: boolean
 *               lifetime_access:
 *                 type: boolean
 *               certificate_available:
 *                 type: boolean
 *               instructor_id:
 *                 type: integer
 *               total_duration_minutes:
 *                 type: integer
 *               thumbnail:
 *                 type: string
 *     responses:
 *       201:
 *         description: Course created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post(
  '/courses',
  authMiddleware,
  requireRole(roles.ADMIN, roles.SUPER_ADMIN, roles.INSTRUCTOR),
  courseController.createCourse
);

/**
 * @openapi
 * /api/admin/courses:
 *   post:
 *     tags: [Courses]
 *     summary: Create course in courses table as draft (multipart with optional thumbnail)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, slug, instructor_id]
 *             properties:
 *               title:
 *                 type: string
 *               slug:
 *                 type: string
 *               subtitle:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               level:
 *                 type: string
 *                 enum: [Beginner, Intermediate, Advanced]
 *               language:
 *                 type: string
 *               price:
 *                 type: number
 *               discount_price:
 *                 type: number
 *               currency:
 *                 type: string
 *               is_paid:
 *                 type: boolean
 *               lifetime_access:
 *                 type: boolean
 *               certificate_available:
 *                 type: boolean
 *               instructor_id:
 *                 type: integer
 *               total_duration_minutes:
 *                 type: integer
 *               thumbnail:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Course created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post(
  '/admin/courses',
  authMiddleware,
  requireRole(roles.ADMIN, roles.SUPER_ADMIN, roles.INSTRUCTOR),
  upload.single('thumbnail'),
  courseController.createCourse
);

/**
 * @openapi
 * /api/admin/courses/{id}/publish:
 *   patch:
 *     tags: [Courses]
 *     summary: Publish a draft course (sets is_published to true)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Course published successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Course not found
 */
router.patch(
  '/admin/courses/:id/publish',
  authMiddleware,
  requireRole(roles.ADMIN, roles.SUPER_ADMIN, roles.INSTRUCTOR),
  courseController.publishCourse
);

/**
 * @openapi
 * /api/courses/{courseId}/modules:
 *   get:
 *     tags: [Modules]
 *     summary: List modules (with lessons) for a course
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Modules fetched successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Course not found
 */
router.get('/courses/:courseId/modules', moduleController.listByCourseId);

/**
 * @openapi
 * /api/admin/courses/{courseId}/modules:
 *   post:
 *     tags: [Modules]
 *     summary: Create module under a course
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               order_index:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Module created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Course not found
 */
router.post(
  '/admin/courses/:courseId/modules',
  authMiddleware,
  requireRole(roles.ADMIN, roles.SUPER_ADMIN, roles.INSTRUCTOR),
  moduleController.createModule
);

/**
 * @openapi
 * /api/admin/modules/{moduleId}:
 *   put:
 *     tags: [Modules]
 *     summary: Update a module
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               order_index:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Module updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Module not found
 */
router.put(
  '/admin/modules/:moduleId',
  authMiddleware,
  requireRole(roles.ADMIN, roles.SUPER_ADMIN, roles.INSTRUCTOR),
  moduleController.updateModule
);

/**
 * @openapi
 * /api/admin/modules/{moduleId}:
 *   delete:
 *     tags: [Modules]
 *     summary: Delete a module (cascades to lessons)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Module deleted successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Module not found
 */
router.delete(
  '/admin/modules/:moduleId',
  authMiddleware,
  requireRole(roles.ADMIN, roles.SUPER_ADMIN, roles.INSTRUCTOR),
  moduleController.deleteModule
);

/**
 * @openapi
 * /api/admin/courses/{courseId}/modules/reorder:
 *   patch:
 *     tags: [Modules]
 *     summary: Reorder modules for a course
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [moduleIds]
 *             properties:
 *               moduleIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Modules reordered successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Course not found
 */
router.patch(
  '/admin/courses/:courseId/modules/reorder',
  authMiddleware,
  requireRole(roles.ADMIN, roles.SUPER_ADMIN, roles.INSTRUCTOR),
  moduleController.reorderModules
);

/**
 * @openapi
 * /api/modules/{moduleId}/lessons:
 *   get:
 *     tags: [Lessons]
 *     summary: List lessons for a module
 *     parameters:
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lessons fetched successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Module not found
 */
router.get('/modules/:moduleId/lessons', lessonController.listByModuleId);

/**
 * @openapi
 * /api/admin/modules/{moduleId}/lessons:
 *   post:
 *     tags: [Lessons]
 *     summary: Create lesson under a module
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, youtube_url]
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               youtube_url:
 *                 type: string
 *               order_index:
 *                 type: integer
 *               is_free_preview:
 *                 type: boolean
 *               duration_seconds:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Lesson created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Module not found
 */
router.post(
  '/admin/modules/:moduleId/lessons',
  authMiddleware,
  requireRole(roles.ADMIN, roles.SUPER_ADMIN, roles.INSTRUCTOR),
  lessonController.createLesson
);

/**
 * @openapi
 * /api/admin/lessons/{lessonId}:
 *   put:
 *     tags: [Lessons]
 *     summary: Update a lesson
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               module_id:
 *                 type: integer
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               youtube_url:
 *                 type: string
 *               order_index:
 *                 type: integer
 *               is_free_preview:
 *                 type: boolean
 *               duration_seconds:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Lesson updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Lesson not found
 */
router.put(
  '/admin/lessons/:lessonId',
  authMiddleware,
  requireRole(roles.ADMIN, roles.SUPER_ADMIN, roles.INSTRUCTOR),
  lessonController.updateLesson
);

/**
 * @openapi
 * /api/admin/lessons/{lessonId}:
 *   delete:
 *     tags: [Lessons]
 *     summary: Delete a lesson
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lesson deleted successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Lesson not found
 */
router.delete(
  '/admin/lessons/:lessonId',
  authMiddleware,
  requireRole(roles.ADMIN, roles.SUPER_ADMIN, roles.INSTRUCTOR),
  lessonController.deleteLesson
);

/**
 * @openapi
 * /api/admin/modules/{moduleId}/lessons/reorder:
 *   patch:
 *     tags: [Lessons]
 *     summary: Reorder lessons for a module
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [lessonIds]
 *             properties:
 *               lessonIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Lessons reordered successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Module not found
 */
router.patch(
  '/admin/modules/:moduleId/lessons/reorder',
  authMiddleware,
  requireRole(roles.ADMIN, roles.SUPER_ADMIN, roles.INSTRUCTOR),
  lessonController.reorderLessons
);

/**
 * @openapi
 * /api/courses/{id}/full:
 *   get:
 *     tags: [Courses]
 *     summary: Get course with nested modules and lessons
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Full course content fetched successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Course not found
 */
router.get('/courses/:id/full', courseController.getCourseFull);

module.exports = router;