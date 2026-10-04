// Minimal package fixture; ZIP headers are generated independently of the validator.
export function docxFixture(overrides: Record<string, string> = {}) {
    const files = { '[Content_Types].xml': '<Types><Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml" PartName="/word/document.xml"/></Types>', 'word/document.xml': '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>', ...overrides };
    const parts: Buffer[] = [], directory: Buffer[] = [];
    let offset = 0;
    for (const [name, xml] of Object.entries(files)) {
        const n = Buffer.from(name), data = Buffer.from(xml);
        let crc = 0xffffffff;
        for (const b of data) {
            crc ^= b;
            for (let i = 0; i < 8; i++)
                crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
        }
        crc = (crc ^ 0xffffffff) >>> 0;
        const header = Buffer.alloc(30);
        header.writeUInt32LE(0x04034b50);
        header.writeUInt16LE(20, 4);
        header.writeUInt32LE(crc, 14);
        header.writeUInt32LE(data.length, 18);
        header.writeUInt32LE(data.length, 22);
        header.writeUInt16LE(n.length, 26);
        parts.push(header, n, data);
        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(data.length, 20);
        central.writeUInt32LE(data.length, 24);
        central.writeUInt16LE(n.length, 28);
        central.writeUInt32LE(offset, 42);
        directory.push(central, n);
        offset += 30 + n.length + data.length;
    }
    const d = Buffer.concat(directory), end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50);
    end.writeUInt16LE(directory.length / 2, 8);
    end.writeUInt16LE(directory.length / 2, 10);
    end.writeUInt32LE(d.length, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...parts, d, end]);
}
