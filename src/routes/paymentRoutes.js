const express = require('express');
const router = express.Router();
const { createOrder, verifyPayment } = require('../controllers/paymentController');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * @openapi
 * /api/payment/create-order:
 *   post:
 *     tags: [Payments]
 *     summary: Create a pending payment record and Razorpay order for a paid course
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [course_id]
 *             properties:
 *               course_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Payment order created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Course not found
 */
router.post('/create-order', authMiddleware, createOrder);

/**
 * @openapi
 * /api/payment/verify-payment:
 *   post:
 *     tags: [Payments]
 *     summary: Verify payment signature, mark payment success, and activate enrollment
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [razorpay_order_id, razorpay_payment_id, razorpay_signature]
 *             properties:
 *               razorpay_order_id:
 *                 type: string
 *               razorpay_payment_id:
 *                 type: string
 *               razorpay_signature:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment verified successfully
 *       400:
 *         description: Validation error or invalid signature
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Payment order not found
 */
router.post('/verify-payment', authMiddleware, verifyPayment);

module.exports = router;
