const { isDriverOverDailyLimit, isDriverLocationFresh } = require('../utils');

class DriverService {
  constructor(driverRepo) {
    this.driverRepo = driverRepo;
  }

  async getOnlineDrivers() {
    return this.driverRepo.getOnlineDrivers();
  }

  async getDriver(driverId) {
    const driver = await this.driverRepo.getById(driverId);
    if (!driver) throw new Error('Driver not found');
    return driver;
  }

  async setStatus(driverId, status) {
    return this.driverRepo.setStatus(driverId, status);
  }

  async adjustBalance(driverId, amount) {
    return this.driverRepo.adjustBalance(driverId, amount);
  }

  isEligibleForDispatch(driver) {
    if (isDriverOverDailyLimit(driver)) return false;
    if ((driver.balance || 0) < 0) return false;
    if (!isDriverLocationFresh(driver)) return false;
    return true;
  }

  async getOnlineAvailableDriversCount() {
    return this.driverRepo.getOnlineAvailableDriversCount();
  }
}

module.exports = DriverService;
