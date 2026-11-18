import { normalizeStirlingUrl, operationsOf } from './stirling.client';

describe('operationsOf', () => {
  const spec = {
    paths: {
      '/api/v1/misc/compress-pdf': {
        post: {
          tags: ['Misc'],
          summary: 'Compress a PDF',
          requestBody: {
            content: {
              'multipart/form-data': {
                schema: { $ref: '#/components/schemas/OptimizePdfRequest' },
              },
            },
          },
        },
      },
      '/api/v1/general/merge-pdfs': {
        post: {
          tags: ['General'],
          summary: 'Merge PDFs',
          requestBody: {
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['fileInput'],
                  properties: {
                    fileInput: {
                      type: 'array',
                      items: { type: 'string', format: 'binary' },
                    },
                    sortType: {
                      type: 'string',
                      enum: ['orderProvided', 'byFileName'],
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/admin/settings': {
        post: { requestBody: { content: { 'multipart/form-data': {} } } },
      },
      '/api/v1/info/status': { get: {} },
    },
    components: {
      schemas: {
        PDFFile: {
          type: 'object',
          properties: { fileInput: { type: 'string', format: 'binary' } },
        },
        OptimizePdfRequest: {
          allOf: [
            { $ref: '#/components/schemas/PDFFile' },
            {
              type: 'object',
              required: ['optimizeLevel'],
              properties: { optimizeLevel: { type: 'integer', default: 5 } },
            },
          ],
        },
      },
    },
  };

  it('lê as operações multipart de /api/v1, com os campos de ficheiro e os obrigatórios', () => {
    const ops = operationsOf(spec);
    expect(ops.map((op) => op.path)).toEqual([
      'general/merge-pdfs',
      'misc/compress-pdf',
    ]);
    const merge = ops[0];
    expect(merge.parameters).toEqual([
      expect.objectContaining({
        name: 'fileInput',
        required: true,
        file: { many: true },
      }),
      expect.objectContaining({
        name: 'sortType',
        enum: ['orderProvided', 'byFileName'],
      }),
    ]);
    const compress = ops[1];
    expect(compress.parameters).toEqual([
      expect.objectContaining({ name: 'fileInput', file: { many: false } }),
      expect.objectContaining({
        name: 'optimizeLevel',
        type: 'integer',
        required: true,
        default: 5,
      }),
    ]);
  });
});

describe('normalizeStirlingUrl', () => {
  it('tira a barra do fim e um /api colado', () => {
    expect(normalizeStirlingUrl(' https://pdf.lan/api/v1/ ')).toBe(
      'https://pdf.lan',
    );
  });
});
