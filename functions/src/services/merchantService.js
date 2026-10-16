const admin = require('firebase-admin');

class MerchantService {
  constructor(merchantRepo) {
    this.merchantRepo = merchantRepo;
  }

  async getMerchant(merchantId) {
    const merchant = await this.merchantRepo.getById(merchantId);
    if (!merchant) throw new Error('Merchant not found');
    return merchant;
  }

  async getGoogleApiKey() {
    const configDoc = await admin.firestore().collection('settings').doc('configs').get();
    const apiKey =
      configDoc.exists && configDoc.data().googleMaps?.apiKey
        ? configDoc.data().googleMaps.apiKey
        : process.env.GOOGLE_MAPS_API_KEY;
    return apiKey;
  }
}

module.exports = MerchantService;
