import { describe, expect, it } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';

import { isValidChecksum } from '../src/checksum';

const getFilter = async (filterPath: string): Promise<string> => {
    const filter = await fs.readFile(path.resolve(__dirname, filterPath), 'utf-8');
    return filter;
};

describe('isValidChecksum', () => {
    describe('when the filter does not have a checksum', () => {
        it('should return true, provided force equals false', async () => {
            const filterContent = '!some content';
            expect(isValidChecksum(filterContent)).toBe(true);
        });
        it('should return false, provided force equals true', async () => {
            const filterContent = '!some content';
            expect(isValidChecksum(filterContent, true)).toBe(false);
        });
    });

    describe('when the filter has a checksum', () => {
        it('should return true if valid', async () => {
            const filter = await getFilter('./fixtures/checksum/valid_1.txt');
            expect(isValidChecksum(filter, true)).toBe(true);
        });
        it('should return false if invalid', async () => {
            const filter = await getFilter('./fixtures/checksum/not_valid_1.txt');
            expect(isValidChecksum(filter, true)).toBe(false);
        });
    });
});
