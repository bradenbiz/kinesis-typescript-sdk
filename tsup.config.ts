import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    rest: 'src/rest.ts',
    withdrawal: 'src/withdrawal.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  // Split chunks so the `rest` entry doesn't statically pull in socket.io-client
  // code shared with the default `index` entry.
  splitting: true,
});
