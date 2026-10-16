const admin = require('firebase-admin');
const { onRequest } = require('firebase-functions/v2/https');
const { onObjectFinalized } = require('firebase-functions/v2/storage');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const OrderRepository = require('./repositories/orderRepo');
const DriverRepository = require('./repositories/driverRepo');
const MerchantRepository = require('./repositories/merchantRepo');
const MerchantService = require('./services/merchantService');
const { processMerchantPhotoLogic } = require('./merchants');
const {
  dispatchOrder,
  getDispatchRegionConfig,
  getOnlineAvailableDriversCount,
  setNoDriverStatus,
  DISPATCH_CONFIG,
} = require('./dispatch');
const logger = require('./utils/logger');
const { isPlacesSyncDisabled, disabledError } = require('./billing');
const { getTimestampMillis, normalizeServiceType } = require('./utils');
const { getPricing, calculatePickupFee } = require('./pricing');
const { sendNotification, sendWAFonnte, sendNotificationToMerchant } = require('./notifications');
const { validateFirebaseUid, validateOrderId } = require('./validation');

const orderRepo = new OrderRepository();
const driverRepo = new DriverRepository();
const merchantRepo = new MerchantRepository();
const merchantService = new MerchantService(merchantRepo);

const CORS_ORIGINS = [
  'https://aro-drive-admin.web.app',
  'https://aro-drive-user.web.app',
  'http://localhost:5173',
  'http://localhost:5174',
];

let _axios;
function getAxios() {
  if (!_axios) _axios = require('axios');
  return _axios;
}

let _sharp;
function getSharp() {
  if (!_sharp) _sharp = require('sharp');
  return _sharp;
}

async function verifyAdminRequest(req) {
  const authHeader = req.get('Authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!idToken) {
    throw new Error('Missing authorization token');
  }

  const decoded = await admin.auth().verifyIdToken(idToken);
  const userDoc = await admin.firestore().collection('users').doc(decoded.uid).get();
  const adminDoc = await admin.firestore().collection('admins').doc(decoded.uid).get();
  const isAdminUser = (userDoc.exists && userDoc.data().role === 'admin') || adminDoc.exists;

  if (!isAdminUser) {
    throw new Error('Admin permission required');
  }

  return decoded;
}

exports.receiveCrashLog = onRequest({ cors: CORS_ORIGINS }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const authHeader = req.get('Authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) {
      res.status(401).json({ success: false, error: 'Missing authorization token' });
      return;
    }

    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;

    const { crashData, timestamp, appVersion, deviceInfo } = req.body;

    if (!crashData) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    await admin
      .firestore()
      .collection('diagnostics')
      .add({
        type: 'crash',
        uid,
        crashData: (crashData || '').substring(0, 2000),
        timestamp: timestamp ? new Date(timestamp) : admin.firestore.FieldValue.serverTimestamp(),
        appVersion: appVersion || '',
        deviceInfo: deviceInfo || {},
        source: 'crash_reporter',
      });

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error in receiveCrashLog', { error: error?.message });
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
});

exports.deleteUserAccount = onRequest({ cors: CORS_ORIGINS }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const { uid } = req.body;

  if (!uid || !validateFirebaseUid(uid)) {
    res.status(400).send({ success: false, error: 'Valid UID is required' });
    return;
  }

  try {
    await verifyAdminRequest(req);
    await admin.auth().deleteUser(uid);
    logger.info('User deleted successfully', { uid });
    res
      .status(200)
      .send({ success: true, message: 'User deleted successfully from Firebase Auth' });
  } catch (error) {
    logger.error('Error deleting user', { uid, error: error?.message });
    const status =
      error.message === 'Missing authorization token' ||
      error.message === 'Admin permission required'
        ? 403
        : 500;
    res.status(status).send({ success: false, error: error.message });
  }
});

exports.deleteMerchant = onRequest({ cors: CORS_ORIGINS }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const { merchantId } = req.body;

  if (!merchantId) {
    res.status(400).send({ success: false, error: 'merchantId is required' });
    return;
  }

  try {
    await verifyAdminRequest(req);

    try {
      await admin.auth().deleteUser(merchantId);
      logger.info('Merchant auth user deleted', { merchantId });
    } catch (authError) {
      const isUserNotFound =
        authError.code === 'auth/user-not-found' ||
        authError.errorInfo?.code === 'auth/user-not-found' ||
        String(authError.message || '')
          .toLowerCase()
          .includes('no user record');

      if (!isUserNotFound) {
        throw authError;
      }
      logger.warn('Merchant auth user not found, continuing Firestore delete', { merchantId });
    }

    await admin.firestore().collection('merchants').doc(merchantId).delete();
    logger.info('Merchant document deleted', { merchantId });
    res.status(200).send({ success: true, message: 'Merchant deleted successfully' });
  } catch (error) {
    logger.error('Error deleting merchant', { merchantId, error: error?.message });
    const status =
      error.message === 'Missing authorization token' ||
      error.message === 'Admin permission required'
        ? 403
        : 500;
    res.status(status).send({ success: false, error: error.message });
  }
});

exports.syncMerchantPopularityFromMaps = onRequest({ cors: CORS_ORIGINS }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  // FASE 1: Places API butuh billing GCP -> nonaktif sementara.
  if (isPlacesSyncDisabled()) {
    res.status(503).send({ success: false, disabled: true, error: disabledError('Places sync') });
    return;
  }

  try {
    await verifyAdminRequest(req);

    const { merchantId } = req.body;
    if (!merchantId) {
      res.status(400).send({ success: false, error: 'merchantId is required' });
      return;
    }

    const data = await merchantRepo.getById(merchantId);
    if (!data) {
      res.status(404).send({ success: false, error: 'Merchant not found' });
      return;
    }
    let placeId = data.place_id;
    if (!placeId && merchantId.startsWith('google_')) {
      placeId = merchantId.replace('google_', '');
    }

    if (!placeId || placeId.includes('manual')) {
      res
        .status(400)
        .send({ success: false, error: 'Merchant does not have a valid Google Place ID' });
      return;
    }

    const apiKey = await merchantService.getGoogleApiKey();

    const axios = getAxios();
    const response = await axios.get(`https://maps.googleapis.com/maps/api/place/details/json`, {
      params: {
        place_id: placeId,
        fields: 'user_ratings_total,rating',
        key: apiKey,
      },
    });

    const result = response.data.result;
    if (result && result.user_ratings_total !== undefined) {
      const updateData = {
        reviewsCount: result.user_ratings_total,
        rating: result.rating || data.rating || 0,
        popularitySyncedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      await admin.firestore().collection('merchants').doc(merchantId).update(updateData);
      res.status(200).send({ success: true, reviewsCount: result.user_ratings_total });
    } else {
      res.status(404).send({ success: false, error: 'No rating data found on Google Maps' });
    }
  } catch (error) {
    logger.error('Error in syncMerchantPopularityFromMaps', { error: error?.message });
    const status =
      error.message === 'Missing authorization token' ||
      error.message === 'Admin permission required'
        ? 403
        : 500;
    res.status(status).send({ success: false, error: error.message });
  }
});

exports.fetchMerchantPhotoFromMaps = onRequest({ cors: CORS_ORIGINS }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  // FASE 1: Places API + Cloud Vision butuh billing GCP -> nonaktif sementara.
  if (isPlacesSyncDisabled()) {
    res
      .status(503)
      .send({ success: false, disabled: true, error: disabledError('Places/Vision sync') });
    return;
  }

  try {
    await verifyAdminRequest(req);

    const { merchantId, merchantName, merchantAddress } = req.body;
    if (!merchantId || !merchantName) {
      res.status(400).send({ success: false, error: 'merchantId and merchantName are required' });
      return;
    }

    const result = await processMerchantPhotoLogic(merchantId, merchantName, merchantAddress);

    res.status(200).send(result);
  } catch (error) {
    logger.error('Error in fetchMerchantPhotoFromMaps', { error: error?.message });
    const status =
      error.message === 'Missing authorization token' ||
      error.message === 'Admin permission required'
        ? 403
        : 500;
    res.status(status).send({
      success: false,
      error: error.message || 'Internal Server Error',
    });
  }
});

exports.processAllExistingMerchants = onRequest(
  { cors: CORS_ORIGINS, timeoutSeconds: 540 },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    // FASE 1: batch Places API + Cloud Vision butuh billing GCP -> nonaktif sementara.
    if (isPlacesSyncDisabled()) {
      res
        .status(503)
        .send({ success: false, disabled: true, error: disabledError('Places/Vision batch sync') });
      return;
    }

    try {
      await verifyAdminRequest(req);

      const allMerchants = await merchantRepo.getAll();
      const total = allMerchants.length;
      logger.info('Starting batch merchant process', { total });

      const results = [];
      for (const data of allMerchants) {
        const merchantId = data.id;

        logger.info('Processing merchant', { merchantId, name: data.name });
        const result = await processMerchantPhotoLogic(merchantId, data.name, data.address || '');
        results.push({ id: merchantId, name: data.name, success: result.success });
      }

      res.status(200).send({ success: true, total, results });
    } catch (error) {
      const status =
        error.message === 'Missing authorization token' ||
        error.message === 'Admin permission required'
          ? 403
          : 500;
      res.status(status).send({ success: false, error: error.message });
    }
  }
);

exports.expansionTrigger = onSchedule('every 1 minutes', async (event) => {
  const now = new Date();
  logger.debug('Expansion trigger running', { timestamp: now.toISOString() });

  try {
    const searchingOrders = await admin
      .firestore()
      .collection('orders')
      .where('status', '==', 'searching')
      .get();

    if (searchingOrders.empty) return;

    for (const orderDoc of searchingOrders.docs) {
      const orderData = orderDoc.data();
      const orderId = orderDoc.id;
      const dispatch = orderData.dispatch;

      if (!dispatch || dispatch.status !== 'searching') continue;

      if (dispatch.offeredTo && dispatch.offerExpiresAt) {
        const offerExpiry = dispatch.offerExpiresAt.toDate();
        if (offerExpiry <= now) {
          logger.info('Offer expired, rotating driver', { orderId, driverId: dispatch.offeredTo });

          const rejectedDrivers = dispatch.rejectedDrivers || [];
          rejectedDrivers.push(dispatch.offeredTo);

          await orderDoc.ref.update({
            'dispatch.offeredTo': admin.firestore.FieldValue.delete(),
            'dispatch.offerExpiresAt': admin.firestore.FieldValue.delete(),
            'dispatch.rejectedDrivers': rejectedDrivers,
          });

          const updatedDispatch = {
            ...dispatch,
            offeredTo: null,
            offerExpiresAt: null,
            rejectedDrivers,
          };
          const driverFound = await dispatchOrder(orderId, orderData, updatedDispatch);

          if (!driverFound) {
            const regionConfig = getDispatchRegionConfig(dispatch.regionType);
            const startedAt = dispatch.startedSearchingAt
              ? dispatch.startedSearchingAt.toDate()
              : orderData.createdAt?.toDate() || new Date();
            const elapsedMinutes = (Date.now() - startedAt.getTime()) / 60000;

            const onlineDriversCount = await getOnlineAvailableDriversCount();
            const rejectedCount = rejectedDrivers.length;
            const allExhausted = onlineDriversCount === 0 || rejectedCount >= onlineDriversCount;

            if (
              dispatch.currentRadius >= regionConfig.maxRadius ||
              elapsedMinutes >= regionConfig.maxSearchMinutes ||
              allExhausted
            ) {
              logger.info('Phase 1 exhaustion/timeout', {
                orderId,
                currentRadius: dispatch.currentRadius,
                elapsedMinutes: elapsedMinutes.toFixed(1),
                onlineDriversCount,
                rejectedCount,
              });
              await setNoDriverStatus(orderId, orderData);
            }
          }

          continue;
        }
        continue;
      }

      const nextExpansion = dispatch.nextExpansionAt?.toDate();
      if (nextExpansion && nextExpansion <= new Date(now.getTime() + 10000)) {
        const regionConfig = getDispatchRegionConfig(dispatch.regionType);

        const nextRadius = Math.min(
          regionConfig.maxRadius,
          dispatch.currentRadius + regionConfig.radiusIncrement
        );
        const nextIteration = dispatch.iteration + 1;

        logger.info('Expanding search radius', {
          orderId,
          regionType: dispatch.regionType,
          iteration: nextIteration,
          newRadius: nextRadius,
        });

        const newDispatchState = {
          ...dispatch,
          currentRadius: nextRadius,
          iteration: nextIteration,
          nextExpansionAt: new Date(Date.now() + 60000),
        };

        await orderDoc.ref.update({
          dispatch: newDispatchState,
        });

        const driverFound = await dispatchOrder(orderId, orderData, newDispatchState);

        if (!driverFound) {
          const startedAt = dispatch.startedSearchingAt
            ? dispatch.startedSearchingAt.toDate()
            : orderData.createdAt?.toDate() || new Date();
          const elapsedMinutes = (Date.now() - startedAt.getTime()) / 60000;

          const onlineDriversCount = await getOnlineAvailableDriversCount();
          const rejectedCount = newDispatchState.rejectedDrivers?.length || 0;
          const notifiedCount = newDispatchState.notifiedDrivers?.length || 0;
          const allExhausted =
            onlineDriversCount === 0 ||
            rejectedCount >= onlineDriversCount ||
            notifiedCount >= onlineDriversCount;

          if (
            nextRadius >= regionConfig.maxRadius ||
            elapsedMinutes >= regionConfig.maxSearchMinutes ||
            allExhausted
          ) {
            logger.info('Phase 2 exhaustion/timeout', {
              orderId,
              nextRadius,
              elapsedMinutes: elapsedMinutes.toFixed(1),
              onlineDriversCount,
              rejectedCount,
            });
            await setNoDriverStatus(orderId, orderData);
          }
        }
      } else {
        const startedAt = dispatch.startedSearchingAt
          ? dispatch.startedSearchingAt.toDate()
          : orderData.createdAt?.toDate() || new Date();
        const elapsedMinutes = (Date.now() - startedAt.getTime()) / 60000;
        const regionConfig = getDispatchRegionConfig(dispatch.regionType);

        const onlineDriversCount = await getOnlineAvailableDriversCount();
        const rejectedCount = dispatch.rejectedDrivers?.length || 0;
        const notifiedCount = dispatch.notifiedDrivers?.length || 0;
        const allExhausted =
          onlineDriversCount === 0 ||
          rejectedCount >= onlineDriversCount ||
          notifiedCount >= onlineDriversCount;

        if (elapsedMinutes >= regionConfig.maxSearchMinutes || allExhausted) {
          logger.info('Immediate timeout/exhaustion check (no expansion)', {
            orderId,
            elapsedMinutes: elapsedMinutes.toFixed(1),
            onlineDriversCount,
            rejectedCount,
          });
          await setNoDriverStatus(orderId, orderData);
        }
      }
    }
  } catch (error) {
    logger.error('Error in expansionTrigger', { error: error?.message });
  }
});

exports.rejectOffer = onRequest({ cors: CORS_ORIGINS }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method Not Allowed' });
    return;
  }

  try {
    const authHeader = req.get('Authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) {
      res.status(401).json({ success: false, error: 'Missing authorization token' });
      return;
    }

    const decoded = await admin.auth().verifyIdToken(idToken);
    const callerUid = decoded.uid;

    const { orderId, driverId } = req.body;

    if (driverId !== callerUid) {
      res
        .status(403)
        .json({ success: false, error: 'Driver ID does not match authenticated user' });
      return;
    }

    if (!orderId || !validateOrderId(orderId)) {
      res.status(400).json({ success: false, error: 'Valid orderId is required' });
      return;
    }
    if (!driverId || !validateFirebaseUid(driverId)) {
      res.status(400).json({ success: false, error: 'Valid driverId is required' });
      return;
    }

    const orderRef = admin.firestore().collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      res.status(404).send({ success: false, error: 'Order not found' });
      return;
    }

    const orderData = orderSnap.data();
    const dispatch = orderData.dispatch;

    if (dispatch?.offeredTo !== driverId) {
      res.status(403).send({ success: false, error: 'This offer is not for you' });
      return;
    }

    const rejectedDrivers = [...(dispatch.rejectedDrivers || []), driverId];

    await orderRef.update({
      'dispatch.offeredTo': admin.firestore.FieldValue.delete(),
      'dispatch.offerExpiresAt': admin.firestore.FieldValue.delete(),
      'dispatch.rejectedDrivers': rejectedDrivers,
    });

    logger.info('Driver rejected order, dispatching to next', { driverId, orderId });

    const updatedDispatch = {
      ...dispatch,
      offeredTo: null,
      offerExpiresAt: null,
      rejectedDrivers,
    };
    const driverFound = await dispatchOrder(orderId, orderData, updatedDispatch);

    if (!driverFound) {
      const regionConfig = getDispatchRegionConfig(dispatch.regionType);
      const startedAt = dispatch.startedSearchingAt
        ? dispatch.startedSearchingAt.toDate()
        : orderData.createdAt?.toDate() || new Date();
      const elapsedMinutes = (Date.now() - startedAt.getTime()) / 60000;

      const onlineDriversCount = await getOnlineAvailableDriversCount();
      const rejectedCount = rejectedDrivers.length;
      const allExhausted = onlineDriversCount === 0 || rejectedCount >= onlineDriversCount;

      if (
        dispatch.currentRadius >= regionConfig.maxRadius ||
        elapsedMinutes >= regionConfig.maxSearchMinutes ||
        allExhausted
      ) {
        logger.info('Immediate exhaustion/timeout check after rejection', {
          orderId,
          currentRadius: dispatch.currentRadius,
          elapsedMinutes: elapsedMinutes.toFixed(1),
          onlineDriversCount,
          rejectedCount,
        });
        await setNoDriverStatus(orderId, orderData);
      }
    }

    res.status(200).send({ success: true, message: 'Order rejected, rotating to next driver' });
  } catch (error) {
    logger.error('Error in rejectOffer', { error: error?.message });
    res.status(500).send({ success: false, error: error.message });
  }
});

exports.onImageUploaded = onObjectFinalized(
  {
    bucket: process.env.STORAGE_BUCKET || admin.storage().bucket().name,
    region: 'asia-southeast2',
    cpu: 1,
    memory: '1GiB',
  },
  async (event) => {
    const object = event.data;
    const filePath = object.name;
    const contentType = object.contentType;

    if (!contentType.startsWith('image/') || contentType === 'image/webp') return;

    const monitoredPaths = ['merchants/', 'merchant_menus/'];
    if (!monitoredPaths.some((p) => filePath.startsWith(p))) return;

    logger.info('Storage trigger processing image', { filePath, contentType });

    try {
      const bucket = admin.storage().bucket(object.bucket);
      const file = bucket.file(filePath);
      const [buffer] = await file.download();

      const sharp = getSharp();
      const webpBuffer = await sharp(buffer).webp({ quality: 80 }).toBuffer();

      const webpPath = filePath.replace(/\.[^/.]+$/, '') + '.webp';
      const webpFile = bucket.file(webpPath);

      await webpFile.save(webpBuffer, {
        metadata: { contentType: 'image/webp' },
      });
      await webpFile.makePublic();

      const publicUrl = `https://storage.googleapis.com/${object.bucket}/${webpPath}`;

      if (filePath.startsWith('merchants/')) {
        const parts = filePath.split('/');
        if (parts.length >= 2) {
          const merchantId = parts[1];
          if (filePath.includes('maps_thumbnail')) {
            await admin
              .firestore()
              .collection('merchants')
              .doc(merchantId)
              .update({ image: publicUrl });
          }
        }
      } else if (filePath.startsWith('merchant_menus/')) {
        const parts = filePath.split('/');
        if (parts.length >= 2) {
          const merchantId = parts[1];
          await admin
            .firestore()
            .collection('merchants')
            .doc(merchantId)
            .update({ originalMenuImage: publicUrl });
        }
      }

      await file.delete();
      logger.info('Image converted to WebP and Firestore updated', { filePath, webpPath });
    } catch (error) {
      logger.error('Error processing image upload', { filePath, error: error?.message });
    }
  }
);

exports.migrateImagesToWebP = onRequest(
  { cors: CORS_ORIGINS, timeoutSeconds: 540 },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    try {
      await verifyAdminRequest(req);

      const { limit = 10, offset = 0 } = req.body;

      const merchantsSnapshot = await admin
        .firestore()
        .collection('merchants')
        .orderBy('__name__')
        .limit(limit)
        .offset(offset)
        .get();

      const results = [];
      const sharp = getSharp();
      const bucket = admin.storage().bucket();

      for (const doc of merchantsSnapshot.docs) {
        const data = doc.data();
        const merchantId = doc.id;
        const updateData = {};
        let merchantUpdated = false;

        logger.info('Migration checking merchant', { merchantId, name: data.name });

        if (data.image && !data.image.endsWith('.webp')) {
          try {
            if (data.image.includes('storage.googleapis.com')) {
              const url = new URL(data.image);
              const path = decodeURIComponent(url.pathname.split('/').slice(2).join('/'));
              const file = bucket.file(path);

              const [buffer] = await file.download();
              const webpBuffer = await sharp(buffer).webp({ quality: 80 }).toBuffer();

              const webpPath = path.replace(/\.[^/.]+$/, '') + '.webp';
              const webpFile = bucket.file(webpPath);

              await webpFile.save(webpBuffer, { metadata: { contentType: 'image/webp' } });
              await webpFile.makePublic();

              updateData.image = `https://storage.googleapis.com/${bucket.name}/${webpPath}`;
              merchantUpdated = true;

              await file.delete();
            } else if (data.image.includes('maps.googleapis.com')) {
              await processMerchantPhotoLogic(merchantId, data.name, data.address || '');
              const updatedDoc = await doc.ref.get();
              const updatedData = updatedDoc.data();
              if (updatedData.image && updatedData.image.endsWith('.webp')) {
                results.push({ id: merchantId, name: data.name, status: 'synced_from_maps' });
                data.menu_thumbnails = updatedData.menu_thumbnails;
              }
            }
          } catch (e) {
            logger.error('Failed to migrate main image', { merchantId, error: e.message });
          }
        }

        if (Array.isArray(data.menu_thumbnails) && data.menu_thumbnails.length > 0) {
          const newThumbnails = [];
          let thumbUpdated = false;

          for (const thumbUrl of data.menu_thumbnails) {
            if (thumbUrl.endsWith('.webp')) {
              newThumbnails.push(thumbUrl);
              continue;
            }

            try {
              const url = new URL(thumbUrl);
              const path = decodeURIComponent(url.pathname.split('/').slice(2).join('/'));
              const file = bucket.file(path);

              const [buffer] = await file.download();
              const webpBuffer = await sharp(buffer).webp({ quality: 80 }).toBuffer();

              const webpPath = path.replace(/\.[^/.]+$/, '') + '.webp';
              const webpFile = bucket.file(webpPath);

              await webpFile.save(webpBuffer, { metadata: { contentType: 'image/webp' } });
              await webpFile.makePublic();

              newThumbnails.push(`https://storage.googleapis.com/${bucket.name}/${webpPath}`);
              thumbUpdated = true;

              await file.delete();
            } catch (e) {
              logger.error('Failed to migrate thumbnail', { merchantId, error: e.message });
              newThumbnails.push(thumbUrl);
            }
          }

          if (thumbUpdated) {
            updateData.menu_thumbnails = newThumbnails;
            merchantUpdated = true;
          }
        }

        if (merchantUpdated) {
          await doc.ref.update(updateData);
          results.push({ id: merchantId, name: data.name, status: 'converted' });
        } else if (!results.some((r) => r.id === merchantId)) {
          results.push({ id: merchantId, name: data.name, status: 'skipped' });
        }
      }

      res.status(200).send({
        success: true,
        processed: merchantsSnapshot.size,
        results,
      });
    } catch (error) {
      const status =
        error.message === 'Missing authorization token' ||
        error.message === 'Admin permission required'
          ? 403
          : 500;
      res.status(status).send({ success: false, error: error.message });
    }
  }
);
