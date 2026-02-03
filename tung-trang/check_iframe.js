const axios = require('axios');
const cheerio = require('cheerio');

const URL = 'https://biihappy.com/iwedding/template-preview/644000ba4f8e0c7ddf09c709';

async function check() {
    try {
        const res = await axios.get(URL);
        const $ = cheerio.load(res.data);
        console.log('IFRAMES FOUND:');
        $('iframe').each((i, el) => {
            console.log($(el).attr('src'));
        });
    } catch (e) {
        console.error(e);
    }
}
check();
