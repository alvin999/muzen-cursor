import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(__dirname, 'wiki-taiwan.html'), 'utf8');

// 搜尋「歷史」標題和「臺灣歷史」
const hIdx = html.indexOf('id="歷史"');
const tableEnd = html.indexOf('</table>', hIdx);
console.log('tableEnd pos:', tableEnd);
console.log(html.substring(tableEnd, tableEnd + 1500));

