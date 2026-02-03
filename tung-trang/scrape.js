const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs-extra');
const path = require('path');
const url = require('url');

const TARGET_URL = 'https://thanhtung-mytrang.iwedding.info/';
const OUTPUT_DIR = path.join(__dirname, 'dist');

async function downloadFile(fileUrl, outputPath) {
    try {
        const response = await axios({
            method: 'get',
            url: fileUrl,
            responseType: 'stream'
        });
        await fs.ensureDir(path.dirname(outputPath));
        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);
        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    } catch (error) {
        console.error(`Failed to download ${fileUrl}: ${error.message}`);
    }
}

function resolveUrl(baseUrl, relativeUrl) {
    return url.resolve(baseUrl, relativeUrl);
}

function isLocalAsset(link) {
    if (!link) return false;
    return !link.startsWith('http') || link.startsWith(TARGET_URL);
}

function getFilename(fileUrl) {
    const parsed = url.parse(fileUrl);
    let pathname = parsed.pathname;
    if (pathname.endsWith('/')) pathname += 'index.html';
    const basename = path.basename(pathname);
    // Simple sanitization
    return basename.replace(/[^a-zA-Z0-9.\-_]/g, '_') || 'asset_' + Date.now();
}

async function scrape() {
    console.log('Fetching main page...');
    await fs.ensureDir(OUTPUT_DIR);

    let html;
    try {
        const response = await axios.get(TARGET_URL);
        html = response.data;
    } catch (err) {
        console.error('Failed to fetch main page', err);
        return;
    }

    const $ = cheerio.load(html);
    const downloadQueue = [];

    // Helper to process assets
    const processAsset = (elem, attr, subDir) => {
        let src = $(elem).attr(attr);
        if (!src) return;

        // Skip data URIs or empty links
        if (src.startsWith('data:') || src.startsWith('#')) return;

        const fullUrl = resolveUrl(TARGET_URL, src);

        // We generally only want to download things that are hosted on the site or are critical static assets.
        // For simplicity, let's try to download everything that looks like a static asset.

        let filename = getFilename(fullUrl);
        // Handle query parameters in filename if needed, or better yet, hash it if duplicates
        // For now, simpler approach:
        const urlObj = url.parse(fullUrl);
        const ext = path.extname(urlObj.pathname).split('&')[0]; // simple hack

        if (!filename.includes('.')) filename += ext;

        const localPath = path.join(subDir, filename);
        const fullLocalPath = path.join(OUTPUT_DIR, localPath);

        // Update HTML reference
        $(elem).attr(attr, localPath.replace(/\\/g, '/'));

        downloadQueue.push(downloadFile(fullUrl, fullLocalPath));
    };

    console.log('Processing Styles...');
    $('link[rel="stylesheet"]').each((i, elem) => processAsset(elem, 'href', 'css'));

    console.log('Processing Scripts...');
    $('script[src]').each((i, elem) => processAsset(elem, 'src', 'js'));

    console.log('Processing Images...');
    $('img').each((i, elem) => processAsset(elem, 'src', 'images'));

    console.log('Processing Videos...');
    $('video source').each((i, elem) => processAsset(elem, 'src', 'media'));

    // Try to find inline usage of background-image (simple regex)
    // This is harder to patch perfectly in strings, so we might skip rewriting complex CSS for now
    // but we can try to at least download the images.

    console.log(`Downloading ${downloadQueue.length} assets...`);
    await Promise.all(downloadQueue);

    console.log('Saving index.html...');
    await fs.writeFile(path.join(OUTPUT_DIR, 'index.html'), $.html());

    console.log('Done!');
}

scrape();
