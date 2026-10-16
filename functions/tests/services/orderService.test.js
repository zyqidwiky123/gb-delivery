const OrderService = require('../../src/services/orderService');

describe('OrderService', () => {
  let orderService;
  let mockOrderRepo;
  let mockDriverRepo;
  let mockPricingService;

  beforeEach(() => {
    mockOrderRepo = { getById: jest.fn(), update: jest.fn() };
    mockDriverRepo = { setStatus: jest.fn(), adjustBalance: jest.fn() };
    mockPricingService = { calculateFinalFee: jest.fn() };
    orderService = new OrderService(mockOrderRepo, mockDriverRepo, mockPricingService);
  });

  describe('validateTransition', () => {
    test('valid transition for transport', () => {
      expect(orderService.validateTransition('transport', 'OFFERED', 'ACCEPTED')).toBe(true);
    });

    test('invalid transition for transport', () => {
      expect(orderService.validateTransition('transport', 'OFFERED', 'COMPLETED')).toBe(false);
    });

    test('unknown service type', () => {
      expect(orderService.validateTransition('unknown', 'OFFERED', 'ACCEPTED')).toBe(false);
    });
  });

  describe('getOrder', () => {
    test('returns order when found', async () => {
      mockOrderRepo.getById.mockResolvedValue({ id: 'o1', status: 'searching' });
      const result = await orderService.getOrder('o1');
      expect(result).toEqual({ id: 'o1', status: 'searching' });
    });

    test('throws when order not found', async () => {
      mockOrderRepo.getById.mockResolvedValue(null);
      await expect(orderService.getOrder('o1')).rejects.toThrow('Order not found');
    });
  });

  describe('acceptOrder', () => {
    test('accepts order when valid', async () => {
      mockOrderRepo.getById.mockResolvedValue({
        id: 'o1',
        status: 'searching',
        dispatch: { offeredTo: 'd1' },
      });
      const result = await orderService.acceptOrder('o1', 'd1');
      expect(result).toEqual({ success: true });
      expect(mockOrderRepo.update).toHaveBeenCalledWith('o1', {
        status: 'accepted',
        driverId: 'd1',
      });
      expect(mockDriverRepo.setStatus).toHaveBeenCalledWith('d1', 'busy');
    });

    test('throws when order already taken', async () => {
      mockOrderRepo.getById.mockResolvedValue({ id: 'o1', status: 'accepted' });
      await expect(orderService.acceptOrder('o1', 'd1')).rejects.toThrow('Order already taken');
    });

    test('throws when not assigned to driver', async () => {
      mockOrderRepo.getById.mockResolvedValue({
        id: 'o1',
        status: 'searching',
        dispatch: { offeredTo: 'd2' },
      });
      await expect(orderService.acceptOrder('o1', 'd1')).rejects.toThrow('Not your order');
    });
  });

  describe('completeOrder', () => {
    test('completes order and adjusts balance', async () => {
      mockOrderRepo.getById.mockResolvedValue({
        id: 'o1',
        status: 'en_route',
        total: 50000,
        driverId: 'd1',
      });
      mockPricingService.calculateFinalFee.mockReturnValue({ fee: 45000, commission: 5000 });
      const result = await orderService.completeOrder('o1');
      expect(result).toEqual({ success: true, fee: 45000, commission: 5000 });
      expect(mockOrderRepo.update).toHaveBeenCalledWith('o1', {
        status: 'completed',
        total: 45000,
      });
      expect(mockDriverRepo.adjustBalance).toHaveBeenCalledWith('d1', 40000);
      expect(mockDriverRepo.setStatus).toHaveBeenCalledWith('d1', 'online');
    });
  });

  describe('updateOrderStatus', () => {
    test('updates order with status and extra data', async () => {
      await orderService.updateOrderStatus('o1', 'arriving', { arrivedAt: new Date() });
      expect(mockOrderRepo.update).toHaveBeenCalledWith('o1', {
        status: 'arriving',
        arrivedAt: expect.any(Date),
      });
    });
  });
});
