const admin = require("firebase-admin");

let _vision;
function getVision() {
  if (!_vision) _vision = require("@google-cloud/vision");
  return _vision;
}

let _axios;
function getAxios() {
  if (!_axios) _axios = require("axios");
  return _axios;
}

let _sharp;
function getSharp() {
  if (!_sharp) _sharp = require('sharp');
  return _sharp;
}

async function scorePhotoForMenu(imageBuffer) {
    try {
        const vision = getVision();
        const visionClient = new vision.ImageAnnotatorClient();

        const [labelResult, textResult] = await Promise.all([
            visionClient.labelDetection(imageBuffer),
            visionClient.documentTextDetection(imageBuffer)
        ]);

        let score = 0;
        let detectedLabels = [];

        const labels = labelResult[0]?.labelAnnotations || [];
        const foodLabels = [
            "food", "dish", "cuisine", "meal", "recipe", "ingredient",
            "fast food", "snack", "dessert", "baked goods", "bread",
            "drink", "beverage", "juice", "coffee", "cake", "pastry",
            "noodle", "rice", "chicken", "meat", "seafood", "pizza",
            "menu", "tableware", "plate", "bowl"
        ];

        const documentLabels = ["document", "paper", "text", "font", "signage", "advertisement", "poster", "menu"];
        const blacklistLabels = [
            "furniture", "ceiling", "flooring", "floor", "interior design", "room",
            "building", "house", "outdoor structure", "fence", "bench", "plank",
            "tree", "plant", "sky", "wheel", "vehicle", "car", "tire"
        ];

        let hasDocumentLabel = false;
        let foodLabelCount = 0;

        labels.forEach(label => {
            const desc = label.description.toLowerCase();
            detectedLabels.push(desc);

            if (foodLabels.some(fl => desc.includes(fl))) {
                foodLabelCount++;
                score += 5;
            }

            if (documentLabels.some(dl => desc.includes(dl))) {
                hasDocumentLabel = true;
                score += 30;
            }

            if (blacklistLabels.some(bl => desc.includes(bl))) {
                score -= 50;
            }
        });

        if (detectedLabels.includes("menu")) {
            score += 100;
        }

        const fullTextAnnotation = textResult[0]?.fullTextAnnotation;
        let validPriceCount = 0;

        if (fullTextAnnotation && fullTextAnnotation.text) {
            const text = fullTextAnnotation.text.toLowerCase();
            console.log(`[Vision] Text detected (${text.length} chars): ${text.substring(0, 50).replace(/\n/g, ' ')}...`);

            score += 50;

            const keywords = [
                "menu", "harga", "paket", "makanan", "minuman", "price", "food", "drink", "daftar",
                "bakery", "pastry", "cake", "roti", "kue", "spesial", "promo", "rekomendasi",
                "porsi", "pcs", "topping", "level", "pedas", "original", "crispy",
                "nasi", "ayam", "mie", "soto", "bakso", "pecel", "ikan", "bebek", "goreng", "bakar",
                "es", "teh", "jeruk", "kopi", "susu", "jus", "espresso", "latte", "cappuccino"
            ];
            let keywordCount = 0;
            keywords.forEach(kw => {
                if (text.includes(kw)) keywordCount++;
            });
            score += Math.min(100, keywordCount * 10);

            const patterns = [
                /\brp\.?\s?\d{3,6}\b/i,
                /\b\d{1,3}\s?rb\b/i,
                /\b\d{1,3}\.\d{3}\b/,
                /\b\d{1,3}k\b/i
            ];
            validPriceCount = 0;
            patterns.forEach(regex => {
                const globalRegex = new RegExp(regex.source, 'gi');
                let match;
                while ((match = globalRegex.exec(text)) !== null) {
                    const priceStr = match[0].replace(/[^\d]/g, '');
                    const priceValue = parseInt(priceStr);
                    if (priceValue >= 1 && priceValue <= 500) {
                        validPriceCount++;
                    } else if (priceValue >= 1000 && priceValue <= 500000) {
                        validPriceCount++;
                    }
                }
            });

            score += validPriceCount * 40;

            if (validPriceCount >= 3) {
                score += 300;
            } else {
                score -= 300;
            }

            const lines = text.split('\n').filter(l => l.trim().length > 0);
            const shortLines = lines.filter(l => l.length < 30).length;
            if (lines.length > 5) {
                const density = shortLines / lines.length;
                if (density > 0.5) score += 50;
            }

            if (lines.length > 15) score += 50;

            if (foodLabelCount > 3 && !hasDocumentLabel && validPriceCount <= 1) {
                score -= 200;
            }
        } else {
            score -= 500;
        }

        console.log(`[Vision] Labels: ${detectedLabels.slice(0, 5).join(', ')} | Score: ${score} | Valid Prices: ${validPriceCount}`);
        return { score, labels: detectedLabels.slice(0, 5) };
    } catch (error) {
        console.error("Error scoring photo:", error);
        return { score: 0, error: error.message };
    }
}

async function processMerchantPhotoLogic(merchantId, merchantName, merchantAddress) {
    try {
        const configDoc = await admin.firestore().collection("settings").doc("configs").get();
        const apiKey = (configDoc.exists && configDoc.data().googleMaps?.apiKey)
            ? configDoc.data().googleMaps.apiKey
            : process.env.GOOGLE_MAPS_API_KEY;

        const baseUrl = "https://maps.googleapis.com/maps/api/place/textsearch/json";
        const cleanName = merchantName.replace(/[-(\[].*$/, "").trim();

        let placeId = null;
        if (merchantId.startsWith("google_")) {
            placeId = merchantId.replace("google_", "");
            console.log(`[Maps] Using existing Place ID from merchantId: ${placeId}`);
        }

        if (!placeId) {
            const queriesToTry = [
                `${merchantName} ${merchantAddress || ''}`.trim(),
                `${merchantName} Jawa Timur`,
                `${cleanName} ${merchantAddress || ''}`.trim(),
                cleanName
            ];

            for (const q of queriesToTry) {
                if (!q) continue;
                const axios = getAxios();
                const searchUrl = `${baseUrl}?query=${encodeURIComponent(q)}&key=${apiKey}`;
                const searchResponse = await axios.get(searchUrl);

                if (searchResponse.data.results && searchResponse.data.results.length > 0) {
                    const withPhotos = searchResponse.data.results.find(r => r.photos && r.photos.length > 0);
                    if (withPhotos) {
                        placeId = withPhotos.place_id;
                        break;
                    }
                }
            }
        }

        if (!placeId) {
            return { success: false, error: 'No places found on Google Maps.' };
        }

        console.log(`[Maps] Final Place ID for processing: ${placeId}`);

        const axios = getAxios();
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,photos,url&key=${apiKey}`;
        const detailsResponse = await axios.get(detailsUrl);
        const detailedPlace = detailsResponse.data.result;

        if (!detailedPlace || !detailedPlace.photos || detailedPlace.photos.length === 0) {
            return { success: false, error: 'Place found but no photos available in details.' };
        }

        const bucket = admin.storage().bucket();
        const processedPhotos = [];
        let mapsThumbnailUrl = "";

        const photosToProcess = detailedPlace.photos.slice(0, 10);
        console.log(`[Maps] Processing ${photosToProcess.length} photos for ${merchantName}`);

        for (let i = 0; i < photosToProcess.length; i++) {
            const photoReference = photosToProcess[i].photo_reference;
            const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${photoReference}&key=${apiKey}`;

            try {
                const axios = getAxios();
                const imageResponse = await axios.get(photoUrl, { responseType: 'arraybuffer' });
                const imageBuffer = Buffer.from(imageResponse.data, 'binary');

                const { score, labels } = await scorePhotoForMenu(imageBuffer);
                console.log(`[Vision] Merchant: ${merchantId}, Photo ${i} score: ${score} | labels: ${(labels || []).slice(0, 3).join(', ')}`);

                processedPhotos.push({
                    buffer: imageBuffer,
                    score: score,
                    originalIndex: i
                });

                if (i === 0) {
                    const sharp = getSharp();
                    const webpBuffer = await sharp(imageBuffer).webp({ quality: 80 }).toBuffer();
                    const mapsPath = `merchants/${merchantId}/maps_thumbnail.webp`;
                    const mapsFile = bucket.file(mapsPath);
                    await mapsFile.save(webpBuffer, { metadata: { contentType: 'image/webp' } });
                    await mapsFile.makePublic();
                    mapsThumbnailUrl = `https://storage.googleapis.com/${bucket.name}/${mapsPath}`;
                }
            } catch (err) {
                console.error(`Error processing photo ${i}:`, err.message);
            }
        }

        processedPhotos.sort((a, b) => b.score - a.score);

        const menuThumbnailUrls = [];
        const topPhotos = processedPhotos.filter(p => p.score >= 250).slice(0, 8);

        for (let i = 0; i < topPhotos.length; i++) {
            const photo = topPhotos[i];
            const sharp = getSharp();
            const webpBuffer = await sharp(photo.buffer).webp({ quality: 80 }).toBuffer();

            const menuPath = `merchants/${merchantId}/menu_${Date.now()}_${i}.webp`;
            const menuFile = bucket.file(menuPath);
            await menuFile.save(webpBuffer, { metadata: { contentType: 'image/webp' } });
            await menuFile.makePublic();
            menuThumbnailUrls.push(`https://storage.googleapis.com/${bucket.name}/${menuPath}`);
        }

        const updateData = {};
        if (mapsThumbnailUrl) updateData.image = mapsThumbnailUrl;
        if (menuThumbnailUrls.length > 0) {
            updateData.menu_thumbnails = menuThumbnailUrls;
        }

        await admin.firestore().collection('merchants').doc(merchantId).update(updateData);

        return {
            success: true,
            message: `Processed ${photosToProcess.length} photos. Found ${menuThumbnailUrls.length} menus.`,
            imageUrl: mapsThumbnailUrl,
            menuThumbnails: menuThumbnailUrls
        };
    } catch (error) {
        console.error("Error in processMerchantPhotoLogic:", error.message);
        return { success: false, error: error.message };
    }
}

module.exports = { scorePhotoForMenu, processMerchantPhotoLogic };
