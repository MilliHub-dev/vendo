import { inflateRawSync } from 'node:zlib';
import { ApiError } from '../../lib/errors.js';
import { docxMime } from './schema.js';
// Inspect a bounded ZIP directory and XML members. No extraction to disk or XML execution.
function docx(data: Buffer) {
    let end = -1;
    for (let i = data.length - 22; i >= Math.max(0, data.length - 65557); i--)
        if (data.readUInt32LE(i) === 0x06054b50) {
            end = i;
            break;
        }
    if (end < 0 || data.readUInt16LE(end + 4) !== 0 || data.readUInt16LE(end + 6) !== 0 || end + 22 + data.readUInt16LE(end + 20) !== data.length)
        return false;
    const count = data.readUInt16LE(end + 10), offset = data.readUInt32LE(end + 16), size = data.readUInt32LE(end + 12);
    if (!count || count > 256 || data.readUInt16LE(end + 8) !== count || offset + size !== end)
        return false;
    let pos = offset, total = 0;
    const entries = new Map<string, Buffer>();
    for (let n = 0; n < count; n++) {
        if (pos + 46 > end || data.readUInt32LE(pos) !== 0x02014b50)
            return false;
        const flags = data.readUInt16LE(pos + 8), method = data.readUInt16LE(pos + 10), compressed = data.readUInt32LE(pos + 20), plain = data.readUInt32LE(pos + 24), nameLen = data.readUInt16LE(pos + 28), extra = data.readUInt16LE(pos + 30), comment = data.readUInt16LE(pos + 32), local = data.readUInt32LE(pos + 42);
        total += plain;
        if (total > 16 * 1024 * 1024 || plain > 4 * 1024 * 1024 || (flags & 1) || ![0, 8].includes(method) || pos + 46 + nameLen + extra + comment > end)
            return false;
        const name = data.subarray(pos + 46, pos + 46 + nameLen).toString('utf8');
        if (entries.has(name) || name.startsWith('/') || name.includes('\\') || name.split('/').includes('..') || /vbaProject|embeddings\//i.test(name))
            return false;
        if (local + 30 > offset || data.readUInt32LE(local) !== 0x04034b50 || data.readUInt16LE(local + 8) !== method || data.readUInt16LE(local + 6) !== flags)
            return false;
        const start = local + 30 + data.readUInt16LE(local + 26) + data.readUInt16LE(local + 28);
        if (start + compressed > offset || !data.subarray(local + 30, local + 30 + data.readUInt16LE(local + 26)).equals(Buffer.from(name)))
            return false;
        const raw = data.subarray(start, start + compressed), content = method === 0 ? raw : inflateRawSync(raw, { maxOutputLength: 4 * 1024 * 1024 });
        if (content.length !== plain)
            return false;
        if (name.endsWith('.xml') || name.endsWith('.rels')) {
            const xml = content.toString('utf8');
            if (/<!DOCTYPE|<!ENTITY|macroEnabled/i.test(xml))
                return false;
        }
        entries.set(name, content);
        pos += 46 + nameLen + extra + comment;
    }
    return pos === end && Boolean(entries.get('[Content_Types].xml')?.toString().includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml')) && Boolean(entries.get('word/document.xml')?.toString().match(/<(?:\w+:)?document[\s>]/));
}
export function validateFile(base64: string, mime: string) { try {
    const data = Buffer.from(base64, 'base64');
    if (!data.length || data.length > 2097152 || data.toString('base64') !== base64)
        throw new Error();
    const valid = mime === 'image/png' ? data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : mime === 'image/jpeg' ? data.subarray(0, 3).equals(Buffer.from([255, 216, 255])) : mime === 'image/webp' ? data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP' : mime === 'application/pdf' ? data.subarray(0, 5).toString() === '%PDF-' : mime === docxMime && docx(data);
    if (!valid)
        throw new Error();
    return data;
}
catch {
    throw new ApiError(400, 'INVALID_FILE', 'Provide a valid JPEG, PNG, WebP, PDF or DOCX file up to 2 MiB.');
} }
export function extension(mime: string) { return mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : mime === 'application/pdf' ? 'pdf' : 'docx'; }
