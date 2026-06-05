/**
 * Batch scan all merchants - calls fetchMerchantPhotoFromMaps for each
 */
const https = require('https');
const http = require('http');

const ENDPOINT = "https://us-central1-gb-delivery-41bf6.cloudfunctions.net/fetchMerchantPhotoFromMaps";

// Read merchants from Firestore REST API
async function fetchMerchants() {
    const url = `https://firestore.googleapis.com/v1/projects/gb-delivery-41bf6/databases/(default)/documents/merchants?pageSize=200`;
    
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const json = JSON.parse(data);
                const merchants = (json.documents || []).map(doc => {
                    const fields = doc.fields || {};
                    return {
                        id: fields.id?.stringValue || doc.name.split('/').pop(),
                        name: fields.name?.stringValue || 'Unknown',
                        address: fields.address?.stringValue || ''
                    };
                });
                resolve(merchants);
            });
        }).on('error', reject);
    });
}

function callFunction(merchantId, merchantName, merchantAddress) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({ merchantId, merchantName, merchantAddress });
        
        const urlObj = new URL(ENDPOINT);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch {
                    resolve({ raw: data });
                }
            });
        });
        
        req.on('error', reject);
        req.setTimeout(120000); // 2 min timeout per merchant
        req.write(postData);
        req.end();
    });
}

async function main() {
    console.log("Fetching merchants from Firestore...");
    const merchants = await fetchMerchants();
    console.log(`Found ${merchants.length} merchants. Starting batch scan...\n`);

    let success = 0, failed = 0, menuFound = 0;

    for (let i = 0; i < merchants.length; i++) {
        const m = merchants[i];
        process.stdout.write(`[${i+1}/${merchants.length}] ${m.name.substring(0,30).padEnd(30)} `);
        
        try {
            const result = await callFunction(m.id, m.name, m.address);
            if (result.success) {
                const count = result.menuThumbnails?.length || 0;
                console.log(`✅ ${result.message}`);
                success++;
                if (count > 0) menuFound++;
            } else {
                console.log(`⚠️  ${result.error || 'No result'}`);
                failed++;
            }
        } catch (err) {
            console.log(`❌ ${err.message}`);
            failed++;
        }
    }

    console.log(`\n========== BATCH COMPLETE ==========`);
    console.log(`Total: ${merchants.length} | Success: ${success} | Failed: ${failed} | With Menu: ${menuFound}`);
}

main().catch(console.error);
