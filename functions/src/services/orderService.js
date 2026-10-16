const { VALID_TRANSITIONS } = require('../validation');

class OrderService {
  constructor(orderRepo, driverRepo, pricingService) {
    this.orderRepo = orderRepo;
    this.driverRepo = driverRepo;
    this.pricingService = pricingService;
  }

  validateTransition(serviceType, fromStatus, toStatus) {
    const validNext = VALID_TRANSITIONS[serviceType]?.[fromStatus] || [];
    return validNext.includes(toStatus);
  }

  async getOrder(orderId) {
    const order = await this.orderRepo.getById(orderId);
    if (!order) throw new Error('Order not found');
    return order;
  }

  async acceptOrder(orderId, driverId) {
    const order = await this.getOrder(orderId);
    if (order.status !== 'searching') throw new Error('Order already taken');
    if (order.dispatch?.offeredTo !== driverId) throw new Error('Not your order');

    await this.orderRepo.update(orderId, { status: 'accepted', driverId });
    await this.driverRepo.setStatus(driverId, 'busy');
    return { success: true };
  }

  async completeOrder(orderId) {
    const order = await this.getOrder(orderId);
    const { fee, commission } = this.pricingService.calculateFinalFee(order);
    await this.orderRepo.update(orderId, { status: 'completed', total: fee });
    if (order.driverId) {
      await this.driverRepo.adjustBalance(order.driverId, fee - commission);
      await this.driverRepo.setStatus(order.driverId, 'online');
    }
    return { success: true, fee, commission };
  }

  async updateOrderStatus(orderId, status, extraData) {
    const updateData = { status, ...extraData };
    return this.orderRepo.update(orderId, updateData);
  }
}

module.exports = OrderService;
