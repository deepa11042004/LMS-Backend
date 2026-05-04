const crypto = require('crypto');
const Razorpay = require('razorpay');
const { lmsDB } = require('../config/db');
const courseModel = require('../models/courseModel');
const enrollmentModel = require('../models/enrollmentModel');
const paymentModel = require('../models/paymentModel');
const enrollmentService = require('./enrollmentService');

const DEFAULT_CURRENCY = 'INR';
const MIN_AMOUNT = 1;
const DEFAULT_PROVIDER = 'razorpay';

const PAYMENT_STATUSES = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
};

let razorpayClient = null;

const normalizeText = (value = '') => String(value ?? '').trim();
const toPositiveInteger = (value) => {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const toFiniteAmount = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const buildResult = (status, body) => ({ status, body });

const getCredentials = () => {
  const keyId = normalizeText(process.env.RAZORPAY_KEY_ID);
  const keySecret = normalizeText(process.env.RAZORPAY_KEY_SECRET);

  if (!keyId || !keySecret) {
    return {
      ok: false,
      message: 'Razorpay credentials are not configured on the server.',
    };
  }

  return { ok: true, keyId, keySecret };
};

const getRazorpayClient = (credentials) => {
  if (razorpayClient) {
    return razorpayClient;
  }

  razorpayClient = new Razorpay({
    key_id: credentials.keyId,
    key_secret: credentials.keySecret,
  });

  return razorpayClient;
};

const toAmountInSmallestUnit = (amountValue) => {
  const amount = toFiniteAmount(amountValue, 0);

  if (!Number.isFinite(amount) || amount < MIN_AMOUNT) {
    return null;
  }

  return Math.round(amount * 100);
};

const buildReceipt = (userId, courseId) =>
  `rcpt_u${userId}_c${courseId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const resolveCourseAmount = (course = {}) => {
  const discountPrice = toFiniteAmount(course.discount_price, 0);
  if (discountPrice > 0) return discountPrice;

  const price = toFiniteAmount(course.price, 0);
  if (price > 0) return price;

  return 0;
};

const resolveCourseCurrency = (course = {}) => normalizeText(course.currency).toUpperCase() || DEFAULT_CURRENCY;

async function createOrder(payload = {}, context = {}) {
  const userId = toPositiveInteger(context.userId);
  if (!userId) {
    return buildResult(401, {
      success: false,
      message: 'Unauthorized user.',
    });
  }

  const courseId = toPositiveInteger(payload.course_id ?? payload.courseId);
  if (!courseId) {
    return buildResult(400, {
      success: false,
      message: 'course_id is required and must be a positive integer.',
    });
  }

  const course = await courseModel.findById(courseId);
  if (!course) {
    return buildResult(404, {
      success: false,
      message: 'Course not found.',
    });
  }

  if (Number(course.is_published) !== 1) {
    return buildResult(400, {
      success: false,
      message: 'Course is not available for enrollment.',
    });
  }

  if (enrollmentService.isCourseFree(course)) {
    return buildResult(400, {
      success: false,
      message: 'This is a free course. Use free enrollment endpoint instead.',
    });
  }

  const existingEnrollment = await enrollmentModel.findByUserAndCourse(userId, courseId);
  if (
    existingEnrollment
    && (
      existingEnrollment.status === enrollmentService.ENROLLMENT_STATUSES.ACTIVE
      || existingEnrollment.status === enrollmentService.ENROLLMENT_STATUSES.COMPLETED
    )
  ) {
    return buildResult(409, {
      success: false,
      message: 'User is already enrolled in this course.',
      enrollment_id: Number(existingEnrollment.id),
    });
  }

  const credentials = getCredentials();

  if (!credentials.ok) {
    return buildResult(500, {
      success: false,
      message: credentials.message,
    });
  }

  const amountMajor = resolveCourseAmount(course);
  const amount = toAmountInSmallestUnit(amountMajor);

  if (!amount) {
    return buildResult(400, {
      success: false,
      message: 'Course amount must be greater than or equal to 1.',
    });
  }

  const currency = resolveCourseCurrency(course);

  const order = await getRazorpayClient(credentials).orders.create({
    amount,
    currency,
    receipt: buildReceipt(userId, courseId),
  });

  const paymentRecordId = await paymentModel.createPayment({
    user_id: userId,
    course_id: courseId,
    amount: amountMajor,
    currency,
    payment_status: PAYMENT_STATUSES.PENDING,
    payment_provider: DEFAULT_PROVIDER,
    order_id: order.id,
  });

  return buildResult(200, {
    success: true,
    keyId: credentials.keyId,
    order,
    payment: {
      id: Number(paymentRecordId),
      payment_status: PAYMENT_STATUSES.PENDING,
      course_id: Number(courseId),
      amount: amountMajor,
      currency,
    },
  });
}

async function verifyPayment(payload = {}, context = {}) {
  const userId = toPositiveInteger(context.userId);
  if (!userId) {
    return buildResult(401, {
      success: false,
      message: 'Unauthorized user.',
    });
  }

  const credentials = getCredentials();

  if (!credentials.ok) {
    return buildResult(500, {
      success: false,
      message: credentials.message,
    });
  }

  const orderId = normalizeText(payload.razorpay_order_id);
  const gatewayPaymentId = normalizeText(payload.razorpay_payment_id);
  const signature = normalizeText(payload.razorpay_signature);

  if (!orderId || !gatewayPaymentId || !signature) {
    return buildResult(400, {
      success: false,
      message: 'razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.',
    });
  }

  const currentPayment = await paymentModel.findByOrderIdForUser(orderId, userId);
  if (!currentPayment) {
    return buildResult(404, {
      success: false,
      message: 'Payment order not found for this user.',
    });
  }

  if (currentPayment.payment_status === PAYMENT_STATUSES.SUCCESS) {
    const existingEnrollment = currentPayment.enrollment_id
      ? await enrollmentModel.findById(currentPayment.enrollment_id)
      : await enrollmentModel.findByUserAndCourse(userId, currentPayment.course_id);

    return buildResult(200, {
      success: true,
      message: 'Payment already verified.',
      payment: {
        id: Number(currentPayment.id),
        payment_status: currentPayment.payment_status,
        payment_id: currentPayment.payment_id,
        order_id: currentPayment.order_id,
        enrollment_id: currentPayment.enrollment_id ? Number(currentPayment.enrollment_id) : null,
      },
      enrollment: existingEnrollment ? enrollmentService.formatEnrollment(existingEnrollment) : null,
    });
  }

  const generatedSignature = crypto
    .createHmac('sha256', credentials.keySecret)
    .update(`${orderId}|${gatewayPaymentId}`)
    .digest('hex');

  if (signature !== generatedSignature) {
    await paymentModel.updatePayment(currentPayment.id, {
      payment_status: PAYMENT_STATUSES.FAILED,
      payment_id: gatewayPaymentId,
    });

    return buildResult(400, {
      success: false,
      message: 'Invalid signature sent.',
    });
  }

  const connection = await lmsDB.getConnection();

  try {
    await connection.beginTransaction();

    const lockedPayment = await paymentModel.findByOrderIdForUser(orderId, userId, connection, {
      forUpdate: true,
    });

    if (!lockedPayment) {
      await connection.rollback();
      return buildResult(404, {
        success: false,
        message: 'Payment order not found for this user.',
      });
    }

    const enrollmentResult = await enrollmentService.ensureActiveEnrollment(
      {
        userId,
        courseId: lockedPayment.course_id,
      },
      connection,
      { forUpdate: true }
    );

    await paymentModel.updatePayment(
      lockedPayment.id,
      {
        payment_status: PAYMENT_STATUSES.SUCCESS,
        payment_id: gatewayPaymentId,
        enrollment_id: Number(enrollmentResult.enrollment.id),
      },
      connection
    );

    await connection.commit();

    return buildResult(200, {
      success: true,
      message: 'Payment verified and enrollment activated successfully.',
      payment: {
        id: Number(lockedPayment.id),
        payment_status: PAYMENT_STATUSES.SUCCESS,
        payment_id: gatewayPaymentId,
        order_id: lockedPayment.order_id,
        enrollment_id: Number(enrollmentResult.enrollment.id),
      },
      enrollment: enrollmentService.formatEnrollment(enrollmentResult.enrollment),
    });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  PAYMENT_STATUSES,
  createOrder,
  verifyPayment,
};