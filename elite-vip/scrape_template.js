const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs-extra');
const path = require('path');
const url = require('url');

const TARGET_URL = 'https://preview.iwedding.info/?template=644000ba4f8e0c7ddf09c709';
// We need the base URL for resolving relative links.
// Since TARGET_URL has query params, the base is effectively https://preview.iwedding.info/
const BASE_URL = 'https://preview.iwedding.info/';

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
        // Silently fail for non-critical assets to verify main flow first
        // console.error(`Failed to download ${fileUrl}: ${error.message}`);
    }
}

function resolveUrl(currentUrl, relativeUrl) {
    return url.resolve(currentUrl, relativeUrl);
}

function getFilename(fileUrl) {
    const parsed = url.parse(fileUrl);
    let pathname = parsed.pathname;
    if (pathname === '/' || pathname === '') pathname = 'index.html';
    const basename = path.basename(pathname);
    // If no extension, assume html if it looks like a page, or just keep name
    if (!path.extname(basename) && !basename.startsWith('.')) {
        // For now, don't append extension blindly unless we know
    }
    // Remove query params from filename on disk
    return basename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
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

    const processAsset = (elem, attr, subDir) => {
        let src = $(elem).attr(attr);
        if (!src) return;
        if (src.startsWith('data:') || src.startsWith('#')) return;

        // Resolve against BASE_URL because the page might use absolute paths relative to root
        // or relative paths.
        const fullUrl = resolveUrl(BASE_URL, src);

        // rudimentary check to see if it's an external social link or similar
        // We generally want to download assets from iwedding or biihappy domains for the template
        if (fullUrl.startsWith('http') && !fullUrl.includes('iwedding') && !fullUrl.includes('biihappy') && !fullUrl.includes('google')) {
            // careful about fonts/google
        }

        let filename = getFilename(fullUrl);
        const urlObj = url.parse(fullUrl);
        const ext = path.extname(urlObj.pathname);
        if (!filename.includes('.') && ext) filename += ext;

        // Force subdirectory for neatness
        const localPath = path.join(subDir, filename);
        const fullLocalPath = path.join(OUTPUT_DIR, localPath);

        $(elem).attr(attr, localPath.replace(/\\/g, '/'));
        downloadQueue.push(downloadFile(fullUrl, fullLocalPath));
    };

    console.log('Processing Assets...');
    $('link[rel="stylesheet"]').each((i, el) => processAsset(el, 'href', 'css'));
    $('script[src]').each((i, el) => processAsset(el, 'src', 'js'));
    $('img').each((i, el) => processAsset(el, 'src', 'images'));

    // Background images in style attributes? 
    // $('*[style*="url"]').each(...) - deferred for complexity

    console.log(`Downloading ${downloadQueue.length} assets...`);
    await Promise.all(downloadQueue);

    console.log('Saving index.html...');
    await fs.writeFile(path.join(OUTPUT_DIR, 'index.html'), $.html());

    console.log('Done!');
}

scrape();
