const paymentService = require('../services/paymentService');

exports.createOrder = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const result = await paymentService.createOrder(req.body || {}, { userId });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Error in createOrder:', error);
    return res.status(500).json({ success: false, message: 'Failed to create order' });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const result = await paymentService.verifyPayment(req.body || {}, { userId });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Error in verifyPayment:', error);
    return res.status(500).json({ success: false, message: 'Payment verification failed' });
  }
};
