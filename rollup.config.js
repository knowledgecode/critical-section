import esbuild from 'rollup-plugin-esbuild';
import terser from '@rollup/plugin-terser';

export default () => {
  return [
    {
      input: 'src/index.ts',
      output: [
        { dir: 'dist', format: 'es' },
        { dir: 'dist', format: 'cjs', entryFileNames: '[name].cjs' }
      ],
      plugins: [
        esbuild({ minify: false, target: 'es2020' }),
        terser()
      ]
    }
  ];
};
